import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get("limit") || "25", 10), 1), 100);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch } });
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

  return NextResponse.json(data ?? [], { status: 200 });
}
