import { chromium, type Browser } from "playwright";
import * as cheerio from "cheerio";
import {
  type CrawlerSettings,
  DEFAULT_ZGBS_PATHS,
  type OverrideMap,
  type ProductType,
  DEFAULT_NEW_RELEASE_PATHS,
  DEFAULT_MOVERS_PATHS
} from "./crawler-settings";

const UA = "MerchWatcherBot/2.0 (+https://merchwatcher.com/contact)";
const BASE = "https://www.amazon.com";
const DP_PATH = "/dp/";
const MAX_LISTING_FETCH_ATTEMPTS = 5;
const RETRYABLE_LISTING_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type PriorityLevel = "P0" | "P1" | "P2" | "P3";

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

export type DiscoverySource = "best-sellers" | "new-releases" | "movers" | "search" | "variant" | "state";

export type DiscoveryCandidate = {
  asin: string;
  url: string;
  priority: PriorityLevel;
  source: DiscoverySource;
  page: number;
  path?: string;
  keyword?: string;
};

export type DelayRange = { min: number; max: number };

export type Product = {
  asin: string;
  title: string | null;
  brand: string | null;
  price_cents: number | null;
  rating: number | null;
  reviews_count: number | null;
  bsr: number | null;
  bsr_category: string | null;
  url: string;
  image_url: string | null;
  bullet1: string | null;
  bullet2: string | null;
  merch_flag_source: string | null;
  product_type: ProductType;
};

export type ParsedProduct = {
  product: Product | null;
  variants: string[];
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

export function computeJitteredDelay(range: DelayRange) {
  const base = randomInRange(range.min, range.max);
  const jitter = 1 + randomInRange(0.2, 0.4);
  return Math.round(base * jitter);
}

function computeListingRetryDelay(attempt: number, status?: number) {
  const normalisedAttempt = Math.max(1, attempt);
  const baseForStatus =
    status === 429
      ? 4000
      : status === 503
        ? 2500
        : 1500;
  const maxForStatus = status === 429 ? 20000 : status === 503 ? 15000 : 10000;
  const backoff = Math.min(maxForStatus, baseForStatus * Math.pow(2, normalisedAttempt - 1));
  const jitterMultiplier = 1 + randomInRange(0.2, 0.4);
  return Math.round(backoff * jitterMultiplier);
}

function toCandidate(
  href: string | undefined,
  meta: Omit<DiscoveryCandidate, "asin" | "url">
): DiscoveryCandidate | null {
  if (!href) return null;
  const absolute = href.startsWith("http") ? href : `${BASE}${href}`;
  const canonical = canonicalizeUrl(absolute);
  if (!canonical) return null;
  const asin = extractAsin(canonical);
  if (!asin) return null;
  return {
    ...meta,
    asin,
    url: canonical
  };
}

function resolveListingUrl(path: string, pageParam: string, page: number) {
  try {
    const url = path.startsWith("http") ? new URL(path) : new URL(path, BASE);
    if (pageParam) {
      url.searchParams.set(pageParam, String(page));
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normaliseMoneyInput(txt: string) {
  const stripped = txt.replace(/[^\d.,-]/g, "").trim();
  if (!stripped) return null;

  const hasComma = stripped.includes(",");
  const hasDot = stripped.includes(".");

  // Prices may come in formats such as:
  // - "1,234.56" (US)
  // - "1.234,56" (EU)
  // - "12,34"   (EU without thousands separator)
  let normalised = stripped;
  if (hasComma && hasDot) {
    if (stripped.lastIndexOf(",") > stripped.lastIndexOf(".")) {
      normalised = stripped.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalised = stripped.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalised = stripped.replace(/,/g, ".");
  } else {
    normalised = stripped.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(normalised);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function moneyToCents(txt?: string | null) {
  if (!txt) return null;
  const parsed = normaliseMoneyInput(txt);
  return parsed != null ? Math.round(parsed * 100) : null;
}

export function parseBSR($: cheerio.CheerioAPI) {
  const sources = [
    "#productDetails_detailBullets_sections1",
    "#detailBulletsWrapper_feature_div",
    "#prodDetails",
    "#detailBullets_feature_div",
    "body"
  ];

  for (const selector of sources) {
    const text = $(selector).text();
    if (!text) continue;
    const normalised = text.replace(/\s+/g, " ").trim();
    const match = normalised.match(/Best Sellers Rank\s*(?::|#)?\s*#?([\d,]+)\s*in\s*([^#(]+)/i);
    if (!match) continue;

    const category = match[2]
      .split("(")[0]
      .split(" #")[0]
      .replace(/\s+/g, " ")
      .trim();

    const rank = parseInt(match[1].replace(/,/g, ""), 10);
    if (!Number.isFinite(rank)) continue;

    return { rank, cat: category || null };
  }

  return { rank: null, cat: null };
}

export function extractFeatureBullets($: cheerio.CheerioAPI): string[] {
  const bullets: string[] = [];
  const seen = new Set<string>();
  const selectors = [
    "#feature-bullets li span.a-list-item",
    "#feature-bullets li"
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      if ($(el).closest(".aok-hidden").length) return;
      const text = $(el)
        .text()
        .replace(/\s+/g, " ")
        .replace(/^[•\-–]\s*/, "")
        .trim();
      if (!text) return;
      if (/^(about this item|from the brand)$/i.test(text)) return;
      if (seen.has(text)) return;
      seen.add(text);
      bullets.push(text);
    });
    if (bullets.length) break;
  }

  return bullets;
}

export function extractAsin(input: string | null | undefined): string | null {
  if (!input) return null;
  const match = input.toUpperCase().match(/([A-Z0-9]{10})(?=[^A-Z0-9]|$)/);
  return match ? match[1] : null;
}

export function canonicalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url, BASE);
    if (!/amazon\.com$/i.test(parsed.hostname)) {
      return null;
    }
    const asin = extractAsin(parsed.pathname);
    if (!asin) return null;
    return `${BASE}${DP_PATH}${asin}`;
  } catch {
    return null;
  }
}

export function harvestVariantAsins($: cheerio.CheerioAPI, baseAsin: string | null): string[] {
  const variants = new Set<string>();
  const register = (value: string | null | undefined) => {
    const asin = extractAsin(value);
    if (asin && asin !== baseAsin) {
      variants.add(asin);
    }
  };

  $('[data-dp-url]').each((_, el) => {
    register($(el).attr('data-dp-url'));
  });

  $('[data-asin]').each((_, el) => {
    register($(el).attr('data-asin'));
  });

  $('[data-csa-c-asin]').each((_, el) => {
    register($(el).attr('data-csa-c-asin'));
  });

  const twisterJson = $("#twister").attr("data-twister-json");
  if (twisterJson) {
    try {
      const parsed = JSON.parse(twisterJson);
      const possibleAsins = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of possibleAsins) {
        if (entry && typeof entry === "object") {
          register((entry as Record<string, unknown>).asin as string | undefined);
          const child = (entry as Record<string, unknown>).childAsins;
          if (Array.isArray(child)) {
            for (const asin of child) register(String(asin));
          }
        }
      }
    } catch {}
  }

  $('script').each((_, el) => {
    const text = $(el).contents().text();
    if (!text || text.length > 100_000) return;
    const regex = /"asin"\s*:\s*"([A-Z0-9]{10})"/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      register(match[1]);
    }
  });

  return Array.from(variants);
}

function collectText($: cheerio.CheerioAPI, selectors: string[]): string[] {
  const values: string[] = [];
  for (const selector of selectors) {
    $(selector)
      .each((_, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (text) values.push(text);
      });
  }
  return values;
}

function extractBreadcrumbSegments($: cheerio.CheerioAPI) {
  const segments = collectText($, [
    "#wayfinding-breadcrumbs_feature_div li",
    "#wayfinding-breadcrumbs_container li",
    ".a-breadcrumb a",
    "#nav-subnav a",
    "#nav-subnav-content a"
  ]);
  const cleaned = new Set(
    segments
      .map(segment => segment.replace(/[›|>]/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
  );
  return Array.from(cleaned);
}

function hasFashionContext($: cheerio.CheerioAPI) {
  const breadcrumbs = extractBreadcrumbSegments($);
  if (!breadcrumbs.length) return false;
  return breadcrumbs.some(segment => /\b(fashion|novelty)\b/i.test(segment));
}

function detectMerchSignal($: cheerio.CheerioAPI): { source: string | null; context: boolean } {
  const context = hasFashionContext($);

  const images = $('img[alt*="Merch" i], img[src*="merch" i]');
  const logo = images.toArray().some(img => {
    const alt = $(img).attr("alt")?.toLowerCase() ?? "";
    const src = $(img).attr("src")?.toLowerCase() ?? "";
    return alt.includes("merch on demand") || (src.includes("merch") && src.includes("demand"));
  });
  if (!context && !logo) {
    return { source: null, context };
  }

  if (logo) {
    return { source: "logo", context };
  }

  const textFrom = (selector: string) =>
    $(selector)
      .map((_, el) => $(el).text().toLowerCase())
      .get()
      .join(" ");

  const badgeText = textFrom("#bylineInfo, #brand, .po-badges, #centerCol, #titleSection");
  if (badgeText.includes("merch on demand") || badgeText.includes("merch by amazon")) {
    return { source: "badge/byline", context };
  }

  const merchantText = textFrom("#merchant-info, #tabular-buybox, #sellerProfileTriggerId, #shipsFromSoldBy_feature_div");
  if (merchantText.includes("sold by merch on demand") || merchantText.includes("merch on demand")) {
    return { source: "seller", context };
  }

  const detailsText = textFrom(
    "#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, #detailBulletsWrapper_feature_div, #prodDetails"
  );
  if (/manufacturer\s*:?.*merch on demand/i.test(detailsText) || /brand\s*:?.*merch on demand/i.test(detailsText)) {
    return { source: "manufacturer", context };
  }

  let jsonSignal = false;
  $('script[type="application/ld+json"]').each((_, script) => {
    if (jsonSignal) return;
    const raw = $(script).contents().text();
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") {
          const meta = item as Record<string, unknown>;
          const rawBrand = (meta.brand ?? meta.manufacturer) as unknown;
          let name = "";
          if (typeof rawBrand === "string") {
            name = rawBrand;
          } else if (
            rawBrand &&
            typeof rawBrand === "object" &&
            "name" in rawBrand &&
            typeof (rawBrand as { name?: unknown }).name === "string"
          ) {
            name = (rawBrand as { name: string }).name;
          }
          if (name) {
            const normalised = name.toLowerCase();
            if (normalised.includes("merch on demand") || normalised.includes("merch by amazon")) {
              jsonSignal = true;
              break;
            }
          }
        }
      }
    } catch {}
  });
  if (jsonSignal) {
    return { source: "jsonld", context };
  }

  return { source: null, context };
}

export function classifyProductType(parts: {
  title?: string | null;
  bullet1?: string | null;
  bullet2?: string | null;
  breadcrumbs?: string[];
  variations?: string[];
}): ProductType {
  const tokens = [parts.title, parts.bullet1, parts.bullet2, ...(parts.breadcrumbs ?? []), ...(parts.variations ?? [])]
    .filter(Boolean)
    .map(text => text!.toLowerCase());

  const includes = (needle: string | RegExp) =>
    tokens.some(token => (typeof needle === "string" ? token.includes(needle) : needle.test(token)));

  if (includes("hoodie")) return "hoodie";
  if (includes("sweatshirt") || includes("crewneck")) return "sweatshirt";
  if (includes(/long[ -]?sleeve/)) return "long-sleeve";
  if (includes("raglan")) return "raglan";
  if (includes(/v[- ]?neck/)) return "v-neck";
  if (includes(/tank[ -]?top/) || includes(/sleeveless/)) return "tank-top";
  if (includes("t-shirt") || includes("tee") || includes("shirt")) return "tshirt";
  return "tshirt";
}

async function fetchListing(url: string): Promise<cheerio.CheerioAPI> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_LISTING_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml"
        }
      });

      if (!response.ok) {
        const error: Error & { status?: number } = new Error(
          `Failed to load listing ${url}: ${response.status}`
        );
        error.status = response.status;

        if (RETRYABLE_LISTING_STATUS_CODES.has(response.status) && attempt < MAX_LISTING_FETCH_ATTEMPTS) {
          lastError = error;
          await delay(computeListingRetryDelay(attempt, response.status));
          continue;
        }

        throw error;
      }

      const html = await response.text();
      const lowerHtml = html.toLowerCase();
      if (
        /\/errors\/validatecaptcha/i.test(response.url) ||
        lowerHtml.includes("type the characters you see") ||
        lowerHtml.includes("enter the characters you see")
      ) {
        throw new Error(`captcha encountered on listing ${url}`);
      }

      return cheerio.load(html);
    } catch (error) {
      lastError = error;

      if (error instanceof Error && error.message.includes("captcha encountered")) {
        throw error;
      }

      const status = (error as { status?: number }).status;
      if (status && !RETRYABLE_LISTING_STATUS_CODES.has(status)) {
        throw error instanceof Error ? error : new Error(String(error));
      }

      if (attempt < MAX_LISTING_FETCH_ATTEMPTS) {
        await delay(computeListingRetryDelay(attempt, status));
        continue;
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Failed to load listing ${url}: ${String(error)}`);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Failed to load listing ${url}: unknown error`);
}

type ListingCollectorOptions = {
  paths: string[];
  maxPages: number;
  source: Exclude<DiscoverySource, "search" | "variant" | "state">;
  priorityForPage: (page: number) => PriorityLevel;
  perPageDelay: DelayRange;
  maxResults: number;
  pageParam?: string;
};

async function collectListingCandidates(options: ListingCollectorOptions): Promise<DiscoveryCandidate[]> {
  const {
    paths,
    maxPages,
    source,
    priorityForPage,
    perPageDelay,
    maxResults,
    pageParam = "pg"
  } = options;
  const results: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    for (let page = 1; page <= maxPages; page += 1) {
      const listUrl = resolveListingUrl(path, pageParam, page);
      if (!listUrl) continue;
      try {
        const $ = await fetchListing(listUrl);
        $('a[href*="/dp/"]').each((_, anchor) => {
          if (results.length >= maxResults) return false;
          const candidate = toCandidate($(anchor).attr("href"), {
            priority: priorityForPage(page),
            source,
            page,
            path
          });
          if (!candidate) return;
          if (seen.has(candidate.asin)) return;
          seen.add(candidate.asin);
          results.push(candidate);
        });
      } catch (error) {
        console.warn(`Failed to load ${listUrl}`, error);
      }
      if (results.length >= maxResults) {
        return results;
      }
      await delay(computeJitteredDelay(perPageDelay));
    }
  }

  return results;
}

async function getPlaywrightBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function fetchHTML(url: string, browser?: Browser) {
  const instance = browser ?? (await getPlaywrightBrowser());
  let lastError: unknown = null;

  const looksLikeCaptcha = (finalUrl: string, html: string) => {
    const lowerHtml = html.toLowerCase();
    return (
      /\/errors\/validatecaptcha/i.test(finalUrl) ||
      lowerHtml.includes("type the characters you see") ||
      lowerHtml.includes("enter the characters you see") ||
      /<title>\s*robot check\s*<\/title>/i.test(html)
    );
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const context = await instance.newContext({ userAgent: UA, locale: "en-US" });
    try {
      const page = await context.newPage();
      await page.route("**/*.{png,jpg,jpeg,gif,webp,mp4,svg,woff,woff2,ttf}", route => route.abort());
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const html = await page.content();
      const finalUrl = page.url();
      await context.close();
      if (looksLikeCaptcha(finalUrl, html)) {
        const error = new Error(`captcha detected for ${finalUrl}`);
        error.name = "CaptchaError";
        throw error;
      }
      if (!browser) {
        await instance.close();
      }
      return { html, finalUrl };
    } catch (error) {
      lastError = error;
      await context.close();
      const isCaptcha = (error as Error | undefined)?.name === "CaptchaError";
      if (isCaptcha || attempt === 3) {
        if (!browser) {
          await instance.close();
        }
        throw error;
      }
      const backoff = Math.min(60_000, 5_000 * Math.pow(2, attempt - 1));
      await delay(backoff + Math.floor(Math.random() * 1_000));
    }
  }

  if (!browser) {
    await instance.close();
  }
  throw lastError ?? new Error("Failed to fetch HTML");
}

function buildSearchUrl(settings: CrawlerSettings, keyword: string, page: number) {
  const params = new URLSearchParams();
  params.set("k", keyword);
  params.set("page", String(page));
  params.set("i", settings.search_category || "aps");
  if (settings.search_sort) params.set("s", settings.search_sort);
  if (settings.search_rh) params.set("rh", settings.search_rh);

  const hiddenKeywords = [
    ...settings.hidden_include,
    ...settings.hidden_exclude.map(term => (term.startsWith("-") ? term : `-${term}`))
  ]
    .map(term => term.trim())
    .filter(Boolean);
  if (hiddenKeywords.length) {
    params.set("hidden-keywords", hiddenKeywords.join(" "));
  }

  return `${BASE}/s?${params.toString()}`;
}

type SearchCollectorOptions = {
  settings: CrawlerSettings;
  perPageDelay: DelayRange;
  maxResults: number;
};

async function collectSearchCandidates({ settings, perPageDelay, maxResults }: SearchCollectorOptions): Promise<DiscoveryCandidate[]> {
  if (!settings.use_search || !settings.search_keywords.length) return [];
  const results: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const keyword of settings.search_keywords) {
    for (let page = 1; page <= settings.search_pages; page += 1) {
      const listUrl = buildSearchUrl(settings, keyword, page);
      try {
        const $ = await fetchListing(listUrl);
        $('a[href*="/dp/"]').each((_, anchor) => {
          if (results.length >= maxResults) return false;
          const candidate = toCandidate($(anchor).attr("href"), {
            priority: page <= 2 ? "P2" : "P3",
            source: "search",
            page,
            keyword
          });
          if (!candidate) return;
          if (seen.has(candidate.asin)) return;
          seen.add(candidate.asin);
          results.push(candidate);
        });
      } catch (error) {
        console.warn(`Failed to load ${listUrl}`, error);
      }
      if (results.length >= maxResults) {
        return results;
      }
      await delay(computeJitteredDelay(perPageDelay));
    }
  }

  return results;
}

export async function collectDiscoveryCandidates(
  settings: CrawlerSettings,
  options: { maxResults?: number; perPageDelay: DelayRange }
): Promise<DiscoveryCandidate[]> {
  const maxResults = options.maxResults ?? Math.max(settings.max_items_per_run * 5, 500);
  const perPageDelay = options.perPageDelay;
  const results: DiscoveryCandidate[] = [];

  const append = (candidates: DiscoveryCandidate[]) => {
    for (const candidate of candidates) {
      if (results.length >= maxResults) break;
      results.push(candidate);
    }
  };

  if (settings.use_best_sellers && results.length < maxResults) {
    const paths = settings.zgbs_paths.length ? settings.zgbs_paths : DEFAULT_ZGBS_PATHS;
    append(
      await collectListingCandidates({
        paths,
        maxPages: settings.zgbs_pages,
        source: "best-sellers",
        priorityForPage: page => (page <= 5 ? "P1" : "P3"),
        perPageDelay,
        maxResults: maxResults - results.length,
        pageParam: "pg"
      })
    );
  }

  if (settings.use_new_releases && results.length < maxResults) {
    const paths = settings.new_paths.length ? settings.new_paths : DEFAULT_NEW_RELEASE_PATHS;
    append(
      await collectListingCandidates({
        paths,
        maxPages: settings.new_pages,
        source: "new-releases",
        priorityForPage: page => (page <= 2 ? "P0" : "P3"),
        perPageDelay,
        maxResults: maxResults - results.length,
        pageParam: "page"
      })
    );
  }

  if (settings.use_movers && results.length < maxResults) {
    const paths = settings.movers_paths.length ? settings.movers_paths : DEFAULT_MOVERS_PATHS;
    append(
      await collectListingCandidates({
        paths,
        maxPages: settings.movers_pages,
        source: "movers",
        priorityForPage: page => (page <= 2 ? "P0" : "P3"),
        perPageDelay,
        maxResults: maxResults - results.length,
        pageParam: "page"
      })
    );
  }

  if (settings.use_search && results.length < maxResults) {
    append(
      await collectSearchCandidates({
        settings,
        perPageDelay,
        maxResults: maxResults - results.length
      })
    );
  }

  return results;
}

export function merchSource($: cheerio.CheerioAPI): string | null {
  const { source, context } = detectMerchSignal($);
  if (!context) return null;
  return source;
}

export function isMerch($: cheerio.CheerioAPI) {
  const { source, context } = detectMerchSignal($);
  return Boolean(context && source);
}

export async function parseProduct(url: string, browser?: Browser): Promise<ParsedProduct> {
  const { html, finalUrl } = await fetchHTML(url, browser);
  const $ = cheerio.load(html);
  const asin = extractAsin(finalUrl) || extractAsin($("#ASIN").attr("value")) || extractAsin(url);
  const variants = harvestVariantAsins($, asin);

  if (!isMerch($)) {
    return { product: null, variants };
  }

  if (!asin) {
    return { product: null, variants };
  }

  const title = $("#productTitle").text().trim() || null;
  const brand = $("#bylineInfo").text().trim() || null;
  const price = $("#corePrice_feature_div .a-offscreen, .a-price .a-offscreen").first().text().trim() || null;

  const ratingTxt =
    $("span[data-hook='rating-out-of-text'], i.a-icon-star span.a-icon-alt").first().text().trim() || null;
  const ratingMatch = ratingTxt?.match(/\d+(?:\.\d+)?/);
  const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

  const reviewsTxt =
    $("#acrCustomerReviewText, a[data-hook='see-all-reviews-link-foot']").first().text().replace(/[^\d]/g, "");
  const reviews_count = reviewsTxt ? parseInt(reviewsTxt, 10) : null;

  const image_url =
    $("#imgTagWrapperId img").attr("src") ||
    $("#landingImage").attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const bullets = extractFeatureBullets($);
  const bullet1 = bullets[0] ?? null;
  const bullet2 = bullets[1] ?? null;

  const breadcrumbs = collectText($, ["#wayfinding-breadcrumbs_feature_div li", ".a-breadcrumb a"]);
  const variationLabels = collectText($, ["#twister-plus-inline-twister-dim-values li", "[data-dp-url]"]);

  const product_type = classifyProductType({
    title,
    bullet1,
    bullet2,
    breadcrumbs,
    variations: variationLabels
  });

  const { rank: bsr, cat: bsr_category } = parseBSR($);
  const merch_flag_source = merchSource($);

  return {
    product: {
      asin,
      title,
      brand,
      price_cents: moneyToCents(price),
      rating: Number.isFinite(rating) ? rating : null,
      reviews_count,
      bsr,
      bsr_category,
      url: canonicalizeUrl(finalUrl) ?? canonicalizeUrl(url) ?? `${BASE}${DP_PATH}${asin}`,
      image_url,
      bullet1,
      bullet2,
      merch_flag_source,
      product_type
    },
    variants
  };
}

export function normaliseCandidateQueue(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const byAsin = new Map<string, DiscoveryCandidate>();

  for (const candidate of candidates) {
    const canonical = canonicalizeUrl(candidate.url);
    if (!canonical) continue;
    const asin = extractAsin(canonical);
    if (!asin) continue;
    const enriched: DiscoveryCandidate = { ...candidate, asin, url: canonical };
    const existing = byAsin.get(asin);
    if (!existing) {
      byAsin.set(asin, enriched);
      continue;
    }
    const existingScore = PRIORITY_ORDER[existing.priority];
    const incomingScore = PRIORITY_ORDER[enriched.priority];
    if (incomingScore < existingScore) {
      byAsin.set(asin, enriched);
    } else if (incomingScore === existingScore) {
      const existingPage = existing.page ?? Number.POSITIVE_INFINITY;
      const incomingPage = enriched.page ?? Number.POSITIVE_INFINITY;
      if (incomingPage < existingPage) {
        byAsin.set(asin, enriched);
      }
    }
  }

  return Array.from(byAsin.values());
}

export type EffectiveSettingsLog = {
  settings: CrawlerSettings;
  overrides: OverrideMap;
};
