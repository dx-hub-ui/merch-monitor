import "dotenv/config";
import { Client } from "pg";
import {
  buildEffectiveSettings,
  CRAWLER_SETTINGS_FIELDS,
  DEFAULT_CRAWLER_SETTINGS,
  type CrawlerSettings,
  type OverrideMap
} from "@/lib/crawler-settings";
import { collectCandidateUrls, normaliseCandidateQueue, parseProduct } from "@/lib/crawler";
import { chromium } from "playwright";
import { saveParsedProduct } from "./storage.js";

const FETCH_DELAY_MS = 4000;

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

(async () => {
  const pg = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await pg.connect();

  const stored = await loadStoredSettings(pg);
  const { settings: effectiveSettings, overrides } = buildEffectiveSettings(stored, process.env);
  const candidates = normaliseCandidateQueue(await collectCandidateUrls(effectiveSettings));

  const browser = await chromium.launch({ headless: true });

  const seen = new Set<string>();
  const queue: string[] = [...candidates];
  let saved = 0;
  let processed = 0;

  while (queue.length && saved < effectiveSettings.max_items) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const parsed = await parseProduct(url, browser);
      processed += 1;
      if (parsed.product) {
        await saveParsedProduct(pg, parsed);
        saved += 1;
      }
      for (const variant of parsed.variants) {
        const canonical = `https://www.amazon.com/dp/${variant}`;
        if (!seen.has(canonical)) {
          queue.push(canonical);
        }
      }
    } catch (error) {
      console.warn(`Failed to process ${url}`, error);
    }
    await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS));
  }

  await browser.close();
  await pg.end();

  logEffectiveSettings(effectiveSettings, overrides, {
    candidates: candidates.length,
    processed,
    saved
  });
})();
