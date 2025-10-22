import { chromium, type Browser } from "playwright";
import * as cheerio from "cheerio";
import { type CrawlerSettings, DEFAULT_ZGBS_PATHS, type OverrideMap, type ProductType } from "./crawler-settings";

const UA = "MerchWatcherBot/2.0 (+https://merchwatcher.com/contact)";
const BASE = "https://www.amazon.com";
const DP_PATH = "/dp/";

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

const CONTEXT_KEYWORDS = [
  "fashion",
  "clothing",
  "apparel",
  "novelty",
  "shirt",
  "tshirt",
  "t-shirt",
  "hoodie",
  "sweatshirt"
];

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function moneyToCents(txt?: string | null) {
  if (!txt) return null;
  const m = txt.replace(/[^\d.]/g, "");
  return m ? Math.round(parseFloat(m) * 100) : null;
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

function hasFashionContext($: cheerio.CheerioAPI) {
  const segments = collectText($, [
    "#wayfinding-breadcrumbs_feature_div",
    "#wayfinding-breadcrumbs_container",
    ".a-breadcrumb",
    "#nav-subnav",
    "#nav-subnav-content"
  ]);
  const combined = segments.join(" ").toLowerCase();
  return CONTEXT_KEYWORDS.some(keyword => combined.includes(keyword));
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
  const response = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml"
    }
  });
  const html = await response.text();
  return cheerio.load(html);
}

async function getPlaywrightBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function fetchHTML(url: string, browser?: Browser) {
  const instance = browser ?? (await getPlaywrightBrowser());
  const context = await instance.newContext({ userAgent: UA, locale: "en-US" });
  const page = await context.newPage();
  await page.route("**/*.{png,jpg,jpeg,gif,webp,mp4,svg,woff,woff2,ttf}", route => route.abort());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const html = await page.content();
  const finalUrl = page.url();
  await context.close();
  if (!browser) {
    await instance.close();
  }
  return { html, finalUrl };
}

export async function collectFromZgbs(settings: CrawlerSettings, maxUrls: number): Promise<string[]> {
  if (!settings.use_best_sellers) return [];
  const paths = settings.zgbs_paths.length ? settings.zgbs_paths : DEFAULT_ZGBS_PATHS;
  const urls = new Set<string>();

  for (const path of paths) {
    for (let pageIndex = 1; pageIndex <= settings.zgbs_pages; pageIndex += 1) {
      const listUrl = `${BASE}${path}?pg=${pageIndex}`;
      try {
        const $ = await fetchListing(listUrl);
        $('a[href*="/dp/"]').each((_, anchor) => {
          const href = $(anchor).attr("href");
          if (!href) return;
          const canonical = canonicalizeUrl(href.startsWith("http") ? href : `${BASE}${href}`);
          if (canonical) urls.add(canonical);
        });
      } catch (error) {
        console.warn(`Failed to load ${listUrl}`, error);
      }
      if (urls.size >= maxUrls) return Array.from(urls).slice(0, maxUrls);
      await delay(2000);
    }
  }

  return Array.from(urls).slice(0, maxUrls);
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

export async function collectFromSearch(settings: CrawlerSettings, maxUrls: number): Promise<string[]> {
  if (!settings.use_search || !settings.search_keywords.length) return [];
  const urls = new Set<string>();

  for (const keyword of settings.search_keywords) {
    for (let page = 1; page <= settings.search_pages; page += 1) {
      const listUrl = buildSearchUrl(settings, keyword, page);
      try {
        const $ = await fetchListing(listUrl);
        $('a[href*="/dp/"]').each((_, anchor) => {
          const href = $(anchor).attr("href");
          if (!href) return;
          const canonical = canonicalizeUrl(href.startsWith("http") ? href : `${BASE}${href}`);
          if (canonical) urls.add(canonical);
        });
      } catch (error) {
        console.warn(`Failed to load ${listUrl}`, error);
      }
      if (urls.size >= maxUrls) return Array.from(urls).slice(0, maxUrls);
      await delay(2000);
    }
  }

  return Array.from(urls).slice(0, maxUrls);
}

export async function collectCandidateUrls(settings: CrawlerSettings): Promise<string[]> {
  const budget = Math.max(settings.max_items * 4, settings.max_items + 50);
  const [zgbs, search] = await Promise.all([
    collectFromZgbs(settings, budget),
    collectFromSearch(settings, budget)
  ]);
  const combined = new Set<string>([...zgbs, ...search]);
  return Array.from(combined);
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

export function normaliseCandidateQueue(urls: string[]): string[] {
  const unique = new Set<string>();
  for (const url of urls) {
    const canonical = canonicalizeUrl(url);
    if (canonical) unique.add(canonical);
  }
  return Array.from(unique);
}

export type EffectiveSettingsLog = {
  settings: CrawlerSettings;
  overrides: OverrideMap;
};
