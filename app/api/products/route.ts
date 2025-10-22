import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_TYPES } from "@/lib/crawler-settings";
import { parseBsrFilters } from "@/lib/bsr";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { extractEntitlements } from "@/lib/billing/claims";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "40", 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
  const sort = (url.searchParams.get("sort") as "bsr" | "reviews" | "rating" | "last_seen") || "bsr";
  const direction = (url.searchParams.get("dir") || "asc").toLowerCase() === "asc";
  const withImages = (url.searchParams.get("withImages") || "false").toLowerCase() === "true";
  const typeFilter = url.searchParams.get("type");
  const normalisedType = typeFilter && PRODUCT_TYPES.includes(typeFilter as (typeof PRODUCT_TYPES)[number]) ? typeFilter : null;
  const { min: bsrMin, max: bsrMax } = parseBsrFilters(url.searchParams.get("bsrMin"), url.searchParams.get("bsrMax"));

  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entitlements = extractEntitlements(user);
  let query = supabase
    .from("merch_products")
    .select(
      "asin,title,brand,image_url,bullet1,bullet2,merch_flag_source,product_type,bsr,bsr_category,rating,reviews_count,price_cents,url,last_seen",
      { count: "exact" }
    )
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%`);
  }

  if (withImages) {
    query = query.not("image_url", "is", null);
  }

  if (normalisedType) {
    query = (query as unknown as {
      eq: (
        column: "product_type",
        value: Database["public"]["Tables"]["merch_products"]["Row"]["product_type"]
      ) => typeof query;
    }).eq(
      "product_type",
      normalisedType as Database["public"]["Tables"]["merch_products"]["Row"]["product_type"]
    );
  }

  if (bsrMin != null || bsrMax != null) {
    query = query.not("bsr", "is", null);
  }

  if (bsrMin != null) {
    query = query.gte("bsr", bsrMin);
  }

  if (bsrMax != null) {
    query = query.lte("bsr", bsrMax);
  }

  if (sort === "reviews") query = query.order("reviews_count", { ascending: direction });
  else if (sort === "rating") query = query.order("rating", { ascending: direction });
  else if (sort === "last_seen") query = query.order("last_seen", { ascending: direction });
  else query = query.order("bsr", { ascending: direction, nullsFirst: false });

  const { data, error, count } = await query;

  if (error) {
    const res = NextResponse.json({ products: [], total: 0 }, { status: 200 });
    res.headers.set("x-error", error.message);
    return res;
  }

  type ProductRow = Pick<
    Database["public"]["Tables"]["merch_products"]["Row"],
    | "asin"
    | "title"
    | "brand"
    | "image_url"
    | "bullet1"
    | "bullet2"
    | "merch_flag_source"
    | "product_type"
    | "bsr"
    | "bsr_category"
    | "rating"
    | "reviews_count"
    | "price_cents"
    | "url"
    | "last_seen"
  >;

  const products = (data ?? []) as ProductRow[];
  const total =
    count ?? (products.length < limit ? Math.max(offset + products.length, 0) : offset + products.length + 1);

  const respond = (body: { products: ProductRow[]; total: number }) => {
    const response = NextResponse.json(body, { status: 200 });
    response.headers.set("x-plan-tier", entitlements.planTier);
    return response;
  };

  const missingBsrAsins = products.filter(product => product.bsr == null).map(product => product.asin);

  let resolvedProducts = products;

  if (missingBsrAsins.length) {
    const metricsQuery = supabase.from("merch_trend_metrics").select("asin,bsr_now");
    const { data: metrics } = await (metricsQuery as unknown as {
      in: (column: "asin", values: string[]) => typeof metricsQuery;
    })
      .in("asin", missingBsrAsins);

    const typedMetrics = (metrics ?? []) as Pick<
      Database["public"]["Tables"]["merch_trend_metrics"]["Row"],
      "asin" | "bsr_now"
    >[];

    if (typedMetrics.length) {
      const bsrByAsin = new Map(typedMetrics.map(metric => [metric.asin, metric.bsr_now] as const));
      resolvedProducts = products.map(product => ({
        ...product,
        bsr: product.bsr ?? bsrByAsin.get(product.asin) ?? null
      }));
    }
  }

  const response = NextResponse.json(resolvedProducts, { status: 200 });
  response.headers.set("x-plan-tier", entitlements.planTier);
  return response;
}
