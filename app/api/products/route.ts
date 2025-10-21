import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "40", 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
  const sort = (url.searchParams.get("sort") as "bsr" | "reviews" | "rating" | "last_seen") || "bsr";
  const direction = (url.searchParams.get("dir") || "asc").toLowerCase() === "asc";
  const withImages = (url.searchParams.get("withImages") || "false").toLowerCase() === "true";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { global: { fetch } });
  let query = supabase
    .from("merch_products")
    .select(
      "asin,title,brand,image_url,bullet1,bullet2,merch_flag_source,bsr,bsr_category,rating,reviews_count,price_cents,url,last_seen"
    )
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%`);
  }

  if (withImages) {
    query = query.not("image_url", "is", null);
  }

  if (sort === "reviews") query = query.order("reviews_count", { ascending: direction });
  else if (sort === "rating") query = query.order("rating", { ascending: direction });
  else if (sort === "last_seen") query = query.order("last_seen", { ascending: direction });
  else query = query.order("bsr", { ascending: direction, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    const res = NextResponse.json([], { status: 200 });
    res.headers.set("x-error", error.message);
    return res;
  }

  return NextResponse.json(data ?? [], { status: 200 });
}
