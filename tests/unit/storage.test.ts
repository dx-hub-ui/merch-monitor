import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/crawler";
import { resolveSnapshotFields } from "@/crawler/storage";

describe("resolveSnapshotFields", () => {
  const baseProduct: Product = {
    asin: "B000TEST01",
    title: "Test",
    brand: "Brand",
    price_cents: 1999,
    rating: 4.5,
    reviews_count: 100,
    bsr: 1200,
    bsr_category: "Clothing",
    url: "https://www.amazon.com/dp/B000TEST01",
    image_url: null,
    bullet1: null,
    bullet2: null,
    merch_flag_source: "badge/byline",
    product_type: "tshirt"
  };

  it("retains the previous BSR when the crawler could not parse a new value", () => {
    const snapshot = resolveSnapshotFields(
      { bsr: 1400, bsr_category: "Clothing", merch_flag_source: "logo", product_type: "hoodie" },
      { ...baseProduct, bsr: null, bsr_category: null, merch_flag_source: null }
    );

    expect(snapshot.bsr).toBe(1400);
    expect(snapshot.bsr_category).toBe("Clothing");
    expect(snapshot.merch_flag_source).toBe("logo");
    expect(snapshot.product_type).toBe("tshirt");
  });

  it("prefers fresh BSR data when available", () => {
    const snapshot = resolveSnapshotFields(
      { bsr: 2000, bsr_category: "Old", merch_flag_source: "badge", product_type: "hoodie" },
      { ...baseProduct, bsr: 900, bsr_category: null }
    );

    expect(snapshot.bsr).toBe(900);
    expect(snapshot.bsr_category).toBe("Old");
    expect(snapshot.merch_flag_source).toBe("badge/byline");
    expect(snapshot.product_type).toBe("tshirt");
  });
});
