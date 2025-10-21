import { chromium } from "playwright";
import * as cheerio from "cheerio";

const UA = "PersonalResearchBot/1.0 (+contact:youremail)";
const BASE = "https://www.amazon.com";

function moneyToCents(txt?: string|null) {
  if (!txt) return null;
  const m = txt.replace(/[^\d.]/g,"");
  return m ? Math.round(parseFloat(m)*100) : null;
}
function parseBSR($: cheerio.CheerioAPI) {
  const text = $("body").text();
  const m = text.match(/Best Sellers Rank\s*#([\d,]+)\s*in\s*([^\(]+)/i);
  return m ? { rank: parseInt(m[1].replace(/,/g,""),10), cat: m[2].trim() } : { rank:null, cat:null };
}
function isMerch($: cheerio.CheerioAPI) {
  const s = $("#bylineInfo, .a-row, .po-badges, #detailBullets_feature_div").text().toLowerCase();
  return s.includes("merch on demand") || s.includes("merch by amazon");
}

export async function fetchHTML(url: string) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();
  await page.route("**/*.{png,jpg,jpeg,gif,webp,mp4,svg}", r=>r.abort());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const html = await page.content();
  await browser.close();
  return html;
}

export async function collectFromSearch(keyword: string, pages=1): Promise<string[]> {
  const urls = new Set<string>();
  for (let p=1;p<=pages;p++){
    const q = new URLSearchParams({ k: keyword, i:"fashion", s:"featured-rank", page:String(p) });
    const html = await fetchHTML(`${BASE}/s?${q.toString()}`);
    const $ = cheerio.load(html);
    $("a.a-link-normal.s-no-outline, h2 a.a-link-normal").each((_,a)=>{
      const href = $(a).attr("href");
      if (!href) return;
      const full = new URL(href, BASE).toString().split("?")[0];
      if (full.includes("/dp/")) urls.add(full);
    });
    await new Promise(r=>setTimeout(r, 4000));
  }
  return [...urls];
}

export type Product = {
  asin:string|null; title:string|null; brand:string|null; price_cents:number|null;
  rating:number|null; reviews_count:number|null; bsr:number|null; bsr_category:string|null; url:string;
};

export async function parseProduct(url: string): Promise<Product|null> {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  if (!isMerch($)) return null;
  const asinMatch = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
  const title = $("#productTitle").text().trim() || null;
  const brand = $("#bylineInfo").text().trim() || null;
  const price = $("#corePrice_feature_div .a-offscreen, .a-price .a-offscreen").first().text().trim() || null;
  const ratingTxt = $("span[data-hook='rating-out-of-text'], i.a-icon-star span.a-icon-alt").first().text();
  const rcTxt = $("#acrCustomerReviewText, a[data-hook='see-all-reviews-link-foot']").first().text();
  const { rank, cat } = parseBSR($);
  return {
    asin: asinMatch ? asinMatch[1].toUpperCase() : null,
    title, brand,
    price_cents: moneyToCents(price),
    rating: ratingTxt ? parseFloat((ratingTxt.match(/[\d.]+/)||[])[0]) : null,
    reviews_count: rcTxt ? parseInt(rcTxt.replace(/[^\d]/g,"")||"0",10) : null,
    bsr: rank, bsr_category: cat, url
  };
}
