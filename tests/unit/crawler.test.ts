import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  canonicalizeUrl,
  classifyProductType,
  extractFeatureBullets,
  harvestVariantAsins,
  isMerch,
  merchSource,
  moneyToCents,
  parseBSR
} from "@/lib/crawler";

const baseHtml = `
<html>
  <body>
    <div id="wayfinding-breadcrumbs_feature_div">
      <li>Clothing</li>
      <li>Novelty</li>
    </div>
    <div id="productTitle">Test Tee</div>
    <div id="bylineInfo">Brand Merch on Demand</div>
    <div id="merchant-info">Sold by Merch on Demand</div>
    <div id="productDetails_techSpec_section_1">
      <tr><th>Manufacturer</th><td>Merch on Demand</td></tr>
    </div>
    <span>Best Sellers Rank #1,234 in Clothing</span>
  </body>
</html>`;

const logoHtml = `
<html>
  <body>
    <div id="wayfinding-breadcrumbs_feature_div"><li>Fashion</li></div>
    <img alt="Amazon Merch on Demand" src="https://images-na.ssl-images-amazon.com/merch/logo.png" />
  </body>
</html>`;

const variantHtml = `
<html>
  <body>
    <div id="twister" data-twister-json='{"asin":"B000TEST01","childAsins":["B000TEST02"]}'></div>
    <div data-dp-url="/dp/B000TEST03"></div>
    <script type="application/json">{"asin":"B000TEST04"}</script>
  </body>
</html>`;

const detailBulletsHtml = `
<html>
  <body>
    <div id="detailBulletsWrapper_feature_div">
      <ul>
        <li><span>Best Sellers Rank: #2,345 in Clothing, Shoes &amp; Jewelry (See Top 100 in Clothing, Shoes &amp; Jewelry)</span></li>
        <li><span>#32 in Men's Fashion Hoodies &amp; Sweatshirts</span></li>
      </ul>
    </div>
  </body>
</html>`;

const bulletHtml = `
<html>
  <body>
    <div id="feature-bullets">
      <ul>
        <li role="presentation"><span class="a-list-item">About this item</span></li>
        <li class="aok-hidden"><span class="a-list-item">Hidden text</span></li>
        <li><span class="a-list-item">Soft cotton fabric</span></li>
        <li><span class="a-list-item">Printed in the USA</span></li>
      </ul>
    </div>
  </body>
</html>`;

describe("crawler helpers", () => {
  it("converts money strings to cents", () => {
    expect(moneyToCents("$12.99")).toBe(1299);
    expect(moneyToCents("USD 0.99")).toBe(99);
    expect(moneyToCents(null)).toBeNull();
  });

  it("parses BSR rank and category", () => {
    const $ = cheerio.load(baseHtml);
    expect(parseBSR($)).toEqual({ rank: 1234, cat: "Clothing" });
  });

  it("parses BSR from detail bullets layout", () => {
    const $ = cheerio.load(detailBulletsHtml);
    expect(parseBSR($)).toEqual({ rank: 2345, cat: "Clothing, Shoes & Jewelry" });
  });

  it("normalises Amazon URLs", () => {
    expect(canonicalizeUrl("https://www.amazon.com/gp/product/B000TEST99?th=1")).toBe(
      "https://www.amazon.com/dp/B000TEST99"
    );
    expect(canonicalizeUrl("https://www.amazon.co.uk/dp/B000TEST99")).toBeNull();
  });

  it("detects merch pages via multiple signals", () => {
    const withBadge = cheerio.load(baseHtml);
    expect(isMerch(withBadge)).toBe(true);
    expect(merchSource(withBadge)).toBe("badge/byline");

    const withLogo = cheerio.load(logoHtml);
    expect(isMerch(withLogo)).toBe(true);
    expect(merchSource(withLogo)).toBe("logo");

    const nonMerch = cheerio.load("<html><body><div id='productTitle'>Generic Shirt</div></body></html>");
    expect(isMerch(nonMerch)).toBe(false);
    expect(merchSource(nonMerch)).toBeNull();
  });

  it("harvests variant ASINs", () => {
    const $ = cheerio.load(variantHtml);
    const variants = harvestVariantAsins($, "B000TEST01");
    expect(new Set(variants)).toEqual(new Set(["B000TEST02", "B000TEST03", "B000TEST04"]));
  });

  it("extracts feature bullets while skipping headings", () => {
    const $ = cheerio.load(bulletHtml);
    expect(extractFeatureBullets($)).toEqual(["Soft cotton fabric", "Printed in the USA"]);
  });

  it("classifies product types", () => {
    expect(
      classifyProductType({
        title: "Graphic Hoodie",
        bullet1: null,
        bullet2: null,
        breadcrumbs: ["Clothing"],
        variations: []
      })
    ).toBe("hoodie");
    expect(
      classifyProductType({
        title: "Premium Long Sleeve Tee",
        bullet1: null,
        bullet2: null,
        breadcrumbs: [],
        variations: []
      })
    ).toBe("long-sleeve");
    expect(
      classifyProductType({
        title: "", 
        bullet1: "Soft raglan baseball shirt",
        bullet2: null,
        breadcrumbs: [],
        variations: []
      })
    ).toBe("raglan");
    expect(
      classifyProductType({
        title: "Vintage Merch",
        bullet1: null,
        bullet2: null,
        breadcrumbs: [],
        variations: []
      })
    ).toBe("tshirt");
  });
});
