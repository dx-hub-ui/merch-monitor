import { chromium } from "playwright";
import * as cheerio from "cheerio";

const UA = "MerchWatcherBot/1.0 (+https://merchwatcher.com/contact)";
const BASE = "https://www.amazon.com";

export function moneyToCents(txt?: string | null) {
  if (!txt) return null;
  const m = txt.replace(/[^\d.]/g, "");
  return m ? Math.round(parseFloat(m) * 100) : null;
}
export function parseBSR($: cheerio.CheerioAPI) {
  const text = $("body").text();
  const m = text.match(/Best Sellers Rank\s*#([\d,]+)\s*in\s*([^\(]+)/i);
  return m ? { rank: parseInt(m[1].replace(/,/g, ""), 10), cat: m[2].trim() } : { rank: null, cat: null };
}

// strict merch predicate
export function isMerch($: cheerio.CheerioAPI) {
  const t = (sel: string) => $(sel).text().toLowerCase();
  const byline = t("#bylineInfo, #brand, .po-badges, #detailBullets_feature_div, #centerCol");
  const badge = byline.includes("merch on demand") || byline.includes("merch by amazon");
  const merchantInfo = t("#merchant-info, #tabular-buybox, #shipsFromSoldBy_feature_div");
  const seller = merchantInfo.includes("sold by merch on demand") || merchantInfo.includes("seller: merch on demand");
  const details = t("#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, #detailBulletsWrapper_feature_div");
  const manufacturer = /manufacturer\s*:?\s*merch on demand/i.test(details) || /brand\s*:?\s*merch on demand/i.test(details);
  let jsonBrand = false;
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const obj = JSON.parse($(s).contents().text());
      const arr = Array.isArray(obj) ? obj : [obj];
      for (const x of arr) {
        const b = (x?.brand?.name || x?.brand || x?.manufacturer || "").toString().toLowerCase();
        if (b.includes("merch on demand") || b.includes("merch by amazon")) { jsonBrand = true; break; }
      }
    } catch {}
  });
  return badge || seller || manufacturer || jsonBrand;
}
export function merchSource($: cheerio.CheerioAPI): string | null {
  const t = (sel: string) => $(sel).text().toLowerCase();
  if (t("#bylineInfo, #brand, .po-badges, #centerCol").includes("merch on demand") || t("#bylineInfo").includes("merch by amazon")) return "badge/byline";
  if (t("#merchant-info, #tabular-buybox, #shipsFromSoldBy_feature_div").includes("sold by merch on demand")) return "seller";
  const det = t("#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, #detailBulletsWrapper_feature_div");
  if (/manufacturer\s*:?\s*merch on demand/i.test(det) || /brand\s*:?\s*merch on demand/i.test(det)) return "manufacturer";
  let ld = "";
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const obj = JSON.parse($(s).contents().text());
      const arr = Array.isArray(obj) ? obj : [obj];
      for (const x of arr) {
        const b = (x?.brand?.name || x?.brand || x?.manufacturer || "").toString().toLowerCase();
        if (b.includes("merch on demand") || b.includes("merch by amazon")) { ld = "jsonld"; break; }
      }
    } catch {}
  });
  return ld || null;
}

export async function fetchHTML(url: string) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();
  await page.route("**/*.{png,jpg,jpeg,gif,webp,mp4,svg}", r => r.abort());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const html = await page.content();
  await browser.close();
  return html;
}

/**
 * Discover product URLs from Amazon Best Sellers (zgbs) pages.
 * Configure paths via env ZGBS_PATHS (comma-separated). Defaults target Fashion subtrees.
 */
export async function collectFromZgbs(maxUrls = 600, pagesPerPath = 5): Promise<string[]> {
  const defaults = [
    "/Best-Sellers/zgbs", // global
    "/Best-Sellers-Clothing-Shoes-Jewelry/zgbs/fashion",
    "/Best-Sellers-Mens-Fashion/zgbs/fashion/7147441011",
    "/Best-Sellers-Womens-Fashion/zgbs/fashion/7147440011",
    "/Best-Sellers-Boys-Fashion/zgbs/fashion/7147443011",
    "/Best-Sellers-Girls-Fashion/zgbs/fashion/7147442011",
    "/Best-Sellers-Novelty-More/zgbs/fashion/12035955011",
    "/Best-Sellers-Mens-Fashion-T-Shirts/zgbs/fashion/1040658",
    "/Best-Sellers-Womens-Fashion-T-Shirts/zgbs/fashion/1258644011"
  ];
  const raw = process.env.ZGBS_PATHS?.split(",").map(s => s.trim()).filter(Boolean);
  const paths = raw && raw.length ? raw : defaults;

  const urls = new Set<string>();
  for (const path of paths) {
    for (let p = 1; p <= pagesPerPath; p++) {
      const url = `${BASE}${path}?pg=${p}`;
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      $('a.a-link-normal[href*="/dp/"]').each((_, a) => {
        const href = $(a).attr("href");
        if (!href) return;
        const full = new URL(href, BASE).toString().split("?")[0];
        if (full.includes("/dp/")) urls.add(full);
      });
      await new Promise(r => setTimeout(r, 2500));
      if (urls.size >= maxUrls) return Array.from(urls).slice(0, maxUrls);
    }
  }
  return Array.from(urls).slice(0, maxUrls);
}

export type Product = {
  asin: string | null;
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
};

export async function parseProduct(url: string): Promise<Product | null> {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  if (!isMerch($)) return null;

  const asinMatch = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
  const title = $("#productTitle").text().trim() || null;
  const brand = $("#bylineInfo").text().trim() || null;
  const price = $("#corePrice_feature_div .a-offscreen, .a-price .a-offscreen").first().text().trim() || null;

  const ratingTxt: string | undefined =
    $("span[data-hook='rating-out-of-text'], i.a-icon-star span.a-icon-alt").first().text() || undefined;
  const rcTxt: string | undefined =
    ($("#acrCustomerReviewText").first().text() ||
      $("a[data-hook='see-all-reviews-link-foot']").first().text()) || undefined;

  const ratingNum = (() => { const m = ratingTxt?.match(/[\d.]+/); return m ? parseFloat(m[0]) : null; })();
  const reviewsCount = (() => { const s = rcTxt?.replace(/[^\d]/g, ""); return s ? parseInt(s, 10) : null; })();

  const image_url =
    $("#imgTagWrapperId img").attr("src") ||
    $("#landingImage").attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  const bullets = $("#feature-bullets li:not(.aok-hidden)")
    .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const bullet1 = bullets[0] ?? null;
  const bullet2 = bullets[1] ?? null;

  const { rank, cat } = parseBSR($);

  return {
    asin: asinMatch ? asinMatch[1].toUpperCase() : null,
    title,
    brand,
    price_cents: moneyToCents(price),
    rating: ratingNum,
    reviews_count: reviewsCount,
    bsr: rank,
    bsr_category: cat,
    url,
    image_url,
    bullet1,
    bullet2,
    merch_flag_source: merchSource($)
  };
}
