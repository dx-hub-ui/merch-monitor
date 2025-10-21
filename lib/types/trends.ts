import type { Database } from "../supabase/types";

type TrendMetricsRow = Database["public"]["Tables"]["merch_trend_metrics"]["Row"];
type ProductRow = Database["public"]["Tables"]["merch_products"]["Row"];

export type TrendRecord = TrendMetricsRow & {
  merch_products: Pick<ProductRow, "asin" | "title" | "brand" | "image_url" | "url" | "bsr_category" | "price_cents"> | null;
};

export type RawTrendRecord = TrendMetricsRow & {
  merch_products: ProductRow | ProductRow[] | null;
};

export function normaliseTrendRecord(record: RawTrendRecord): TrendRecord {
  const relatedProduct = Array.isArray(record.merch_products)
    ? record.merch_products[0] ?? null
    : record.merch_products;

  return {
    ...record,
    merch_products: relatedProduct
      ? {
          asin: relatedProduct.asin,
          title: relatedProduct.title,
          brand: relatedProduct.brand,
          image_url: relatedProduct.image_url,
          url: relatedProduct.url,
          bsr_category: relatedProduct.bsr_category,
          price_cents: relatedProduct.price_cents
        }
      : null
  };
}
