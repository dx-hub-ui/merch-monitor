import { chromium } from "playwright";
import * as cheerio from "cheerio";

const UA = "PersonalResearchBot/1.0 (+contact:youremail)";
const BASE = "https://www.amazon.com";

function moneyToCents(txt?: string|null) {
  if (!txt) return null;
  const m = txt.replace(/[^\d.]/g, "");
  return m ? Math.round(parseFloat(m) * 100) : null;
}
function parseBSR($: cheerio.CheerioAPI) {
  const text = $("body").text();
  const m = text.match(/Best Sellers Rank\s*#([\d,]+)\s*in\s*([^\(]+)/i);
  return m ? { rank: parseInt(m[1].replace(/,/g, ""), 10), cat: m[2].trim() } : { rank: null, cat: null };
}
function isMerch($: cheerio.CheerioAPI) {
  const s = $("#bylineInfo, .a-row, .po-badges, #detailBullets_feature_div").text().toLowerCase();
  return s.includes("merch on demand") || s.includes("merch by amazon");
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

export async function collectFromSearch(keyword: string, pages = 1): Promise<string[]> {
  const urls = new Set<string>();
  for (let p = 1; p <= pages; p++) {
    const q = new URLSearchParams({ k: keyword, i: "fashion", s: "featured-rank", page: String(p) });
    const html = await fetchHTML(`${BASE}/s?${q.toString()}`);
    const $ = cheerio.load(html);
    $("a.a-link-normal.s-no-outline, h2 a.a-link-normal").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      const full = new URL(href, BASE).toString().split("?")[0];
      if (full.includes("/dp/")) urls.add(full);
    });
    await new Promise(r => setTimeout(r, 4000));
  }
  return [...urls];
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

  const ratingNum = (() => {
    const m = ratingTxt?.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  })();

  const reviewsCount = (() => {
    const s = rcTxt?.replace(/[^\d]/g, "");
    return s ? parseInt(s, 10) : null;
  })();

  // image url
  const image_url =
    $("#imgTagWrapperId img").attr("src") ||
    $("#landingImage").attr("src") ||
    $('meta[property="og:image"]').attr("content") ||
    null;

  // bullet points 1 and 2
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
    bullet2
  };
}
