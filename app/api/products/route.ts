import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);
  const sort = url.searchParams.get("sort") || "bsr"; // bsr|reviews|rating|last_seen
  const asc = (url.searchParams.get("dir") || "asc").toLowerCase() === "asc";

  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPA_URL || !SUPA_KEY) {
    // Return empty array so UI never breaks
    return NextResponse.json([], { status: 200 });
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY);
  const cols =
    "asin,title,brand,image_url,bullet1,bullet2,merch_flag_source,bsr,bsr_category,rating,reviews_count,price_cents,url,last_seen";

  let query = supabase.from("merch_products").select(cols).limit(limit);

  if (q.length > 0) {
    query = query.or(`title.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  if (sort === "reviews") query = query.order("reviews_count", { ascending: asc });
  else if (sort === "rating") query = query.order("rating", { ascending: asc });
  else if (sort === "last_seen") query = query.order("last_seen", { ascending: asc });
  else query = query.order("bsr", { ascending: asc, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    // Do not 500 the UI. Return [] and attach debug header.
    const res = NextResponse.json([], { status: 200 });
    res.headers.set("x-error", error.message);
    return res;
  }
  return NextResponse.json(data ?? [], { status: 200 });
}
