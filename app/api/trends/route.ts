import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { extractEntitlements } from "@/lib/billing/claims";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("limit") || "25", 10), 1), 100);
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entitlements = extractEntitlements(user);
  const { data, error } = await supabase
    .from("merch_trend_metrics")
    .select(
      "asin,momentum,bsr_now,bsr_24h,bsr_7d,reviews_now,reviews_24h,reviews_7d,rating_now,updated_at,merch_products(asin,title,brand,image_url,url,bsr_category,price_cents)"
    )
    .order("momentum", { ascending: false })
    .limit(limit);

  if (error) {
    const response = NextResponse.json([], { status: 200 });
    response.headers.set("x-error", error.message);
    return response;
  }

  const response = NextResponse.json(data ?? [], { status: 200 });
  response.headers.set("x-plan-tier", entitlements.planTier);
  return response;
}
