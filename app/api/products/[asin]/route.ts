import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { extractEntitlements } from "@/lib/billing/claims";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

const ALLOWED_WINDOWS = [7, 30, 60, 90] as const;

export async function GET(req: NextRequest, { params }: { params: { asin: string } }) {
  const asin = params.asin?.toUpperCase();
  if (!asin) {
    return NextResponse.json({ error: "Missing ASIN" }, { status: 400 });
  }

  const url = new URL(req.url);
  const daysParam = parseInt(url.searchParams.get("days") ?? "90", 10);
  const windowDays = ALLOWED_WINDOWS.includes(daysParam as (typeof ALLOWED_WINDOWS)[number]) ? daysParam : 90;
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entitlements = extractEntitlements(user);
  const maxHistoryDays = entitlements.limits.historyDays;
  const clampedWindow = Math.max(1, Math.min(windowDays, maxHistoryDays));
  const effectiveWindow = ALLOWED_WINDOWS.includes(clampedWindow as (typeof ALLOWED_WINDOWS)[number])
    ? clampedWindow
    : Math.min(maxHistoryDays, 7);
  const since = new Date(Date.now() - effectiveWindow * 24 * 60 * 60 * 1000).toISOString();

  const typedAsin = asin as Database["public"]["Tables"]["merch_products"]["Row"]["asin"];

  const productQuery = supabase.from("merch_products").select("*");
  const historyQuery = supabase
    .from("merch_products_history")
    .select("captured_at,price_cents,rating,reviews_count,bsr")
    .gte("captured_at", since)
    .order("captured_at", { ascending: true });

  const [{ data: product, error: productError }, { data: history, error: historyError }] = await Promise.all([
    (productQuery as unknown as {
      eq: (
        column: "asin",
        value: Database["public"]["Tables"]["merch_products"]["Row"]["asin"]
      ) => typeof productQuery;
      maybeSingle: typeof productQuery.maybeSingle;
    })
      .eq("asin", typedAsin)
      .maybeSingle(),
    (historyQuery as unknown as {
      eq: (
        column: "asin",
        value: Database["public"]["Tables"]["merch_products_history"]["Row"]["asin"]
      ) => typeof historyQuery;
    })
      .eq(
        "asin",
        typedAsin as Database["public"]["Tables"]["merch_products_history"]["Row"]["asin"]
      )
  ]);

  const typedProduct = product as Database["public"]["Tables"]["merch_products"]["Row"] | null;
  const typedHistory = (history ?? []) as Pick<
    Database["public"]["Tables"]["merch_products_history"]["Row"],
    "captured_at" | "price_cents" | "rating" | "reviews_count" | "bsr"
  >[];

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  if (!typedProduct) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  let enrichedProduct = typedProduct;

  if (enrichedProduct.bsr == null) {
    const metricQuery = supabase.from("merch_trend_metrics").select("asin,bsr_now");
    const { data: metric } = await (metricQuery as unknown as {
      eq: (
        column: "asin",
        value: Database["public"]["Tables"]["merch_trend_metrics"]["Row"]["asin"]
      ) => typeof metricQuery;
      maybeSingle: typeof metricQuery.maybeSingle;
    })
      .eq(
        "asin",
        typedAsin as Database["public"]["Tables"]["merch_trend_metrics"]["Row"]["asin"]
      )
      .maybeSingle();

    const typedMetric = metric as Pick<
      Database["public"]["Tables"]["merch_trend_metrics"]["Row"],
      "bsr_now"
    > | null;

    if (typedMetric?.bsr_now != null) {
      enrichedProduct = { ...enrichedProduct, bsr: typedMetric.bsr_now };
    }
  }

  const response = NextResponse.json(
    { product: enrichedProduct, history: typedHistory, window_days: effectiveWindow },
    { status: 200 }
  );
  response.headers.set("x-plan-tier", entitlements.planTier);
  return response;
}
