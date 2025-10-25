import "dotenv/config";
import { createHash } from "crypto";
import { chromium } from "playwright";
import { Client } from "pg";

import {
  buildEffectiveSettings,
  CRAWLER_SETTINGS_FIELDS,
  DEFAULT_CRAWLER_SETTINGS,
  type CrawlerSettings,
  type OverrideMap
} from "@/lib/crawler-settings";
import {
  collectDiscoveryCandidates,
  computeJitteredDelay,
  normaliseCandidateQueue,
  parseProduct,
  type DiscoveryCandidate,
  type PriorityLevel,
  type DelayRange
} from "@/lib/crawler";
import type { Product } from "@/lib/crawler";
import {
  loadCrawlState,
  persistCrawlState,
  saveParsedProduct,
  type CrawlState,
  type CrawlStateUpdate
} from "./storage.js";

type QueueItem = DiscoveryCandidate & {
  nextDue: Date;
  stateNextDue: Date | null;
  state: CrawlState | null;
};

type PriorityMap<T> = Record<PriorityLevel, T>;

const PRIORITIES: PriorityLevel[] = ["P0", "P1", "P2", "P3"];
const CANONICAL_BASE = "https://www.amazon.com/dp/";

async function loadStoredSettings(pg: Client): Promise<Partial<CrawlerSettings>> {
  const columns = CRAWLER_SETTINGS_FIELDS.join(",");
  const { rows } = await pg.query(`select ${columns} from crawler_settings order by id asc limit 1`);
  const row = rows[0];
  if (!row) {
    return { ...DEFAULT_CRAWLER_SETTINGS };
  }
  return row as Partial<CrawlerSettings>;
}

function logEffectiveSettings(settings: CrawlerSettings, overrides: OverrideMap, meta: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ...meta,
      settings,
      overrides
    })
  );
}

function fingerprintProduct(product: Product | null): string | null {
  if (!product) return null;
  const hash = createHash("sha1");
  hash.update(
    JSON.stringify({
      title: product.title,
      brand: product.brand,
      price_cents: product.price_cents,
      rating: product.rating,
      reviews_count: product.reviews_count,
      bsr: product.bsr,
      bsr_category: product.bsr_category,
      bullet1: product.bullet1,
      bullet2: product.bullet2,
      merch_flag_source: product.merch_flag_source,
      product_type: product.product_type
    })
  );
  return hash.digest("hex");
}

function computeRecrawlWindows(settings: CrawlerSettings): PriorityMap<number> {
  return {
    P0: settings.recrawl_hours_p0 * 60 * 60 * 1000,
    P1: settings.recrawl_hours_p1 * 60 * 60 * 1000,
    P2: settings.recrawl_hours_p2 * 60 * 60 * 1000,
    P3: settings.recrawl_hours_p3 * 60 * 60 * 1000
  };
}

function computeBudgets(maxItems: number): { perPriority: PriorityMap<number>; variant: number } {
  const perPriority: PriorityMap<number> = {
    P0: Math.max(1, Math.floor(maxItems * 0.5)),
    P1: Math.max(1, Math.floor(maxItems * 0.4)),
    P2: Math.max(0, Math.floor(maxItems * 0.1)),
    P3: 0
  };

  let allocated = perPriority.P0 + perPriority.P1 + perPriority.P2;
  while (allocated > maxItems) {
    if (perPriority.P2 > 0) {
      perPriority.P2 -= 1;
      allocated -= 1;
      continue;
    }
    if (perPriority.P1 > 1) {
      perPriority.P1 -= 1;
      allocated -= 1;
      continue;
    }
    if (perPriority.P0 > 1) {
      perPriority.P0 -= 1;
      allocated -= 1;
      continue;
    }
    break;
  }

  perPriority.P3 = Math.max(0, maxItems - (perPriority.P0 + perPriority.P1 + perPriority.P2));
  const variantBudget = Math.max(1, Math.round(maxItems * 0.1));

  return { perPriority, variant: Math.min(variantBudget, maxItems) };
}

function delayRangeFromSettings(min: number, max: number): DelayRange {
  return { min, max } satisfies DelayRange;
}

function createQueueItem(candidate: DiscoveryCandidate, state: CrawlState | null, now: Date): QueueItem {
  const stateNextDue = state?.next_due ?? null;
  const immediateSources = new Set(["best-sellers", "new-releases", "movers", "search", "variant"]);
  const nextDue = immediateSources.has(candidate.source) ? now : stateNextDue ?? now;
  return {
    ...candidate,
    nextDue,
    stateNextDue,
    state
  };
}

function isValidSource(value: string | null | undefined): DiscoveryCandidate["source"] {
  const allowed = new Set<DiscoveryCandidate["source"]>([
    "best-sellers",
    "new-releases",
    "movers",
    "search",
    "variant",
    "state"
  ]);
  return allowed.has(value as DiscoveryCandidate["source"]) ? (value as DiscoveryCandidate["source"]) : "state";
}

function computeFreshnessSla(states: Map<string, CrawlState>, recrawlWindows: PriorityMap<number>) {
  const now = Date.now();
  const totals: PriorityMap<number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const within: PriorityMap<number> = { P0: 0, P1: 0, P2: 0, P3: 0 };

  for (const state of states.values()) {
    if (state.inactive || !state.last_seen_at) continue;
    const priority = state.priority;
    totals[priority] += 1;
    const diff = now - state.last_seen_at.getTime();
    if (diff <= recrawlWindows[priority]) {
      within[priority] += 1;
    }
  }

  return PRIORITIES.reduce<Record<PriorityLevel, number | null>>((acc, priority) => {
    acc[priority] = totals[priority] ? Math.round((within[priority] / totals[priority]) * 1000) / 10 : null;
    return acc;
  }, { P0: null, P1: null, P2: null, P3: null });
}

function formatFreshnessHours(value: number | null) {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

async function persistVariantCandidate(
  pg: Client,
  asin: string,
  stateMap: Map<string, CrawlState>,
  now: Date
) {
  const existing = stateMap.get(asin) ?? null;
  const update: CrawlStateUpdate = {
    asin,
    priority: "P3",
    next_due: now,
    last_hash: existing?.last_hash ?? null,
    unchanged_runs: existing?.unchanged_runs ?? 0,
    fail_count: existing?.fail_count ?? 0,
    inactive: false,
    discovery: "variant",
    last_seen_at: existing?.last_seen_at ?? null
  };
  await persistCrawlState(pg, update);
  stateMap.set(asin, {
    asin,
    priority: update.priority,
    next_due: update.next_due,
    last_hash: update.last_hash,
    unchanged_runs: update.unchanged_runs,
    fail_count: update.fail_count,
    inactive: update.inactive,
    discovery: update.discovery,
    last_seen_at: update.last_seen_at
  });
}

function selectQueue(
  now: Date,
  discovery: DiscoveryCandidate[],
  stateMap: Map<string, CrawlState>
): { queue: QueueItem[]; counts: PriorityMap<number> } {
  const seen = new Set<string>();
  const counts: PriorityMap<number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const queue: QueueItem[] = [];

  for (const candidate of discovery) {
    if (seen.has(candidate.asin)) continue;
    seen.add(candidate.asin);
    const state = stateMap.get(candidate.asin) ?? null;
    const item = createQueueItem(candidate, state, now);
    queue.push(item);
    counts[item.priority] += 1;
  }

  for (const [asin, state] of stateMap.entries()) {
    if (seen.has(asin)) continue;
    if (state.inactive) continue;
    if (state.next_due > now) continue;
    const candidate: DiscoveryCandidate = {
      asin,
      url: `${CANONICAL_BASE}${asin}`,
      priority: state.priority,
      source: isValidSource(state.discovery),
      page: 0
    };
    const item = createQueueItem(candidate, state, now);
    queue.push(item);
    counts[item.priority] += 1;
  }

  queue.sort((a, b) => {
    const priorityDiff = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return a.nextDue.getTime() - b.nextDue.getTime();
  });

  return { queue, counts };
}

function shouldProcess(item: QueueItem, now: Date) {
  if (item.source === "state") {
    if (item.state?.inactive) return false;
    return !item.state || item.state.next_due <= now;
  }
  return true;
}

(async () => {
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await pg.connect();

  const stored = await loadStoredSettings(pg);
  const { settings: effectiveSettings, overrides } = buildEffectiveSettings(stored, process.env);
  const stateMap = await loadCrawlState(pg);

  const perPageDelay = delayRangeFromSettings(
    effectiveSettings.per_page_delay_ms_min,
    effectiveSettings.per_page_delay_ms_max
  );
  const perProductDelay = delayRangeFromSettings(
    effectiveSettings.per_product_delay_ms_min,
    effectiveSettings.per_product_delay_ms_max
  );

  const discovery = normaliseCandidateQueue(
    await collectDiscoveryCandidates(effectiveSettings, {
      maxResults: Math.max(effectiveSettings.max_items_per_run * 5, 500),
      perPageDelay
    })
  );

  const now = new Date();
  const { queue: initialQueue, counts: discoveryCounts } = selectQueue(now, discovery, stateMap);
  const recrawlWindows = computeRecrawlWindows(effectiveSettings);
  const { perPriority: budgets, variant: variantBudget } = computeBudgets(
    effectiveSettings.max_items_per_run
  );

  const browser = await chromium.launch({ headless: true });

  const seen = new Set<string>();
  const queue: QueueItem[] = [...initialQueue];
  const enqueued = new Set(queue.map(item => item.asin));
  const processedCounts: PriorityMap<number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  let variantProcessed = 0;

  let processed = 0;
  let saved = 0;
  let inserted = 0;
  let skippedNonMerch = 0;
  let totalFetchMs = 0;
  const startTime = Date.now();

  while (queue.length && processed < effectiveSettings.max_items_per_run) {
    const candidate = queue.shift()!;
    enqueued.delete(candidate.asin);
    if (seen.has(candidate.asin)) continue;
    if (!shouldProcess(candidate, now)) continue;
    const isVariant = candidate.source === "variant";
    const priorityLimitReached = processedCounts[candidate.priority] >= budgets[candidate.priority];
    if (!isVariant && priorityLimitReached) continue;
    if (isVariant && variantProcessed >= variantBudget) continue;

    seen.add(candidate.asin);
    processed += 1;
    processedCounts[candidate.priority] += 1;
    if (isVariant) {
      variantProcessed += 1;
    }

    const fetchStart = Date.now();
    let parsed;
    try {
      parsed = await parseProduct(candidate.url, browser);
    } catch (error) {
      console.warn(`Failed to process ${candidate.url}`, error);
      const existing = stateMap.get(candidate.asin) ?? null;
      const backoff = existing ? Math.min(existing.unchanged_runs + 1, 3) : 1;
      const nextDue = new Date(now.getTime() + recrawlWindows[candidate.priority] * backoff);
      const update: CrawlStateUpdate = {
        asin: candidate.asin,
        priority: existing?.priority ?? candidate.priority,
        next_due: nextDue,
        last_hash: existing?.last_hash ?? null,
        unchanged_runs: existing?.unchanged_runs ?? 0,
        fail_count: (existing?.fail_count ?? 0) + 1,
        inactive: false,
        discovery: candidate.source,
        last_seen_at: existing?.last_seen_at ?? null
      };
      await persistCrawlState(pg, update);
      stateMap.set(candidate.asin, {
        asin: candidate.asin,
        priority: update.priority,
        next_due: update.next_due,
        last_hash: update.last_hash,
        unchanged_runs: update.unchanged_runs,
        fail_count: update.fail_count,
        inactive: update.inactive,
        discovery: update.discovery,
        last_seen_at: update.last_seen_at
      });
      totalFetchMs += Date.now() - fetchStart;
      await new Promise(resolve => setTimeout(resolve, computeJitteredDelay(perProductDelay)));
      continue;
    }

    totalFetchMs += Date.now() - fetchStart;

    const fingerprint = fingerprintProduct(parsed.product);
    const existingState = stateMap.get(candidate.asin) ?? null;
    const freshnessHours = existingState?.last_seen_at
      ? (now.getTime() - existingState.last_seen_at.getTime()) / (60 * 60 * 1000)
      : null;

    if (!parsed.product) {
      skippedNonMerch += 1;
      const failCount = (existingState?.fail_count ?? 0) + 1;
      const nextDue = new Date(now.getTime() + recrawlWindows.P3 * Math.min(failCount, 3));
      const update: CrawlStateUpdate = {
        asin: candidate.asin,
        priority: "P3",
        next_due: nextDue,
        last_hash: fingerprint,
        unchanged_runs: 0,
        fail_count: failCount,
        inactive: failCount >= 2,
        discovery: candidate.source,
        last_seen_at: existingState?.last_seen_at ?? null
      };
      await persistCrawlState(pg, update);
      stateMap.set(candidate.asin, {
        asin: candidate.asin,
        priority: update.priority,
        next_due: update.next_due,
        last_hash: update.last_hash,
        unchanged_runs: update.unchanged_runs,
        fail_count: update.fail_count,
        inactive: update.inactive,
        discovery: update.discovery,
        last_seen_at: update.last_seen_at
      });
      console.log(
        JSON.stringify({
          event: "skip_non_merch",
          asin: candidate.asin,
          priority: candidate.priority,
          source: candidate.source,
          freshness_hours: formatFreshnessHours(freshnessHours)
        })
      );
      await new Promise(resolve => setTimeout(resolve, computeJitteredDelay(perProductDelay)));
      continue;
    }

    const saveResult = await saveParsedProduct(pg, parsed);
    if (saveResult.saved) {
      saved += 1;
      if (saveResult.inserted) {
        inserted += 1;
      }
      console.log(
        JSON.stringify({
          event: saveResult.inserted ? "insert" : "update",
          asin: parsed.product.asin,
          priority: candidate.priority,
          source: candidate.source,
          freshness_hours: formatFreshnessHours(freshnessHours),
          merch_flag_source: parsed.product.merch_flag_source
        })
      );
    }

    const unchangedRuns = fingerprint && fingerprint === existingState?.last_hash ? (existingState?.unchanged_runs ?? 0) + 1 : 0;
    const backoffMultiplier = Math.min(4, Math.pow(2, unchangedRuns));
    const nextDue = new Date(now.getTime() + recrawlWindows[candidate.priority] * backoffMultiplier);
    const update: CrawlStateUpdate = {
      asin: parsed.product.asin,
      priority: candidate.priority,
      next_due: nextDue,
      last_hash: fingerprint,
      unchanged_runs: unchangedRuns,
      fail_count: 0,
      inactive: false,
      discovery: candidate.source,
      last_seen_at: now
    };
    await persistCrawlState(pg, update);
    stateMap.set(parsed.product.asin, {
      asin: parsed.product.asin,
      priority: update.priority,
      next_due: update.next_due,
      last_hash: update.last_hash,
      unchanged_runs: update.unchanged_runs,
      fail_count: update.fail_count,
      inactive: update.inactive,
      discovery: update.discovery,
      last_seen_at: update.last_seen_at
    });

    for (const variant of parsed.variants) {
      const canonical = `${CANONICAL_BASE}${variant}`;
      if (seen.has(variant)) continue;
      if (enqueued.has(variant)) continue;
      await persistVariantCandidate(pg, variant, stateMap, now);
      enqueued.add(variant);
      queue.push({
        asin: variant,
        url: canonical,
        priority: "P3",
        source: "variant",
        page: 0,
        nextDue: now,
        stateNextDue: now,
        state: stateMap.get(variant) ?? null
      });
    }

    await new Promise(resolve => setTimeout(resolve, computeJitteredDelay(perProductDelay)));
  }

  await browser.close();
  await pg.end();

  const freshness = computeFreshnessSla(stateMap, recrawlWindows);
  const summary = {
    candidates: initialQueue.length,
    fetched: processed,
    saved,
    inserted,
    updated: saved - inserted,
    skipped_non_merch: skippedNonMerch,
    p_counts: processedCounts,
    discovery_counts: discoveryCounts,
    variant_budget: variantBudget,
    variant_processed: variantProcessed,
    avg_ms_per_fetch: processed ? Math.round(totalFetchMs / processed) : 0,
    duration_ms: Date.now() - startTime,
    freshness_within_sla: freshness,
    run_mode: process.env.CRAWLER_RUN_MODE ?? null
  };

  logEffectiveSettings(effectiveSettings, overrides, summary);
})();
