import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Client } from "pg";
import { upsertProduct, saveParsedProduct } from "@/crawler/storage";
import type { Product } from "@/lib/crawler";

describe("crawler storage", () => {
  const query = vi.fn();
  const pg = { query: query as unknown as Client["query"] } as unknown as Client;

  const product: Product = {
    asin: "B000TEST00",
    title: "Test Shirt",
    brand: "Brand",
    price_cents: 1999,
    rating: 4.5,
    reviews_count: 120,
    bsr: 1000,
    bsr_category: "Clothing",
    url: "https://www.amazon.com/dp/B000TEST00",
    image_url: "https://images.test",
    bullet1: "First",
    bullet2: "Second",
    merch_flag_source: "logo",
    product_type: "tshirt"
  };

  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] } as never);
  });

  it("upserts products with product_type and merch_flag_source", async () => {
    await upsertProduct(pg, product);
    expect(query).toHaveBeenCalledTimes(3);
    const upsertCall = query.mock.calls[1];
    expect(upsertCall[0]).toContain("product_type");
    expect(upsertCall[1]).toContain("tshirt");
    const historyCall = query.mock.calls[2];
    expect(historyCall[0]).toContain("product_type");
    expect(historyCall[1]).toContain("logo");
  });

  it("saves parsed products when present", async () => {
    await saveParsedProduct(pg, { product, variants: [] });
    expect(query).toHaveBeenCalled();
  });

  it("skips saving when parsed product is null", async () => {
    await saveParsedProduct(pg, { product: null, variants: [] });
    expect(query).not.toHaveBeenCalled();
  });
});
