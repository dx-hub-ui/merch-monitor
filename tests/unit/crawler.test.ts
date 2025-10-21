import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { moneyToCents, parseBSR, isMerch, merchSource } from "@/lib/crawler";

const html = `
<html>
  <body>
    <div id="bylineInfo">Brand Merch on Demand</div>
    <div id="productTitle">Test Tee</div>
    <div id="merchant-info">Sold by Merch on Demand</div>
    <div id="productDetails_techSpec_section_1">
      <tr><th>Manufacturer</th><td>Merch on Demand</td></tr>
    </div>
    <span>Best Sellers Rank #1,234 in Clothing</span>
  </body>
</html>`;

describe("crawler utils", () => {
  it("converts money strings to cents", () => {
    expect(moneyToCents("$12.99")).toBe(1299);
    expect(moneyToCents("USD 0.99")).toBe(99);
    expect(moneyToCents(null)).toBeNull();
  });

  it("parses BSR rank and category", () => {
    const $ = cheerio.load(html);
    expect(parseBSR($)).toEqual({ rank: 1234, cat: "Clothing" });
  });

  it("detects merch signals", () => {
    const $ = cheerio.load(html);
    expect(isMerch($)).toBe(true);
    expect(merchSource($)).toBe("badge/byline");
  });
});
