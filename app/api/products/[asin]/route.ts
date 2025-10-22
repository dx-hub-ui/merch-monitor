import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { extractEntitlements } from "@/lib/billing/claims";

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

  const [{ data: product, error: productError }, { data: history, error: historyError }] = await Promise.all([
    supabase.from("merch_products").select("*").eq("asin", asin).maybeSingle(),
    supabase
      .from("merch_products_history")
      .select("captured_at,price_cents,rating,reviews_count,bsr")
      .eq("asin", asin)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
  ]);

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }

  let enrichedProduct = product;

  if (enrichedProduct.bsr == null) {
    const { data: metric } = await supabase
      .from("merch_trend_metrics")
      .select("asin,bsr_now")
      .eq("asin", asin)
      .maybeSingle();

    if (metric?.bsr_now != null) {
      enrichedProduct = { ...enrichedProduct, bsr: metric.bsr_now };
    }
  }

  const response = NextResponse.json({ product: enrichedProduct, history: history ?? [], window_days: effectiveWindow }, { status: 200 });
  response.headers.set("x-plan-tier", entitlements.planTier);
  return response;
}
