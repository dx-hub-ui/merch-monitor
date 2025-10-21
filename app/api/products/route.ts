import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "edge";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);
  const sort = url.searchParams.get("sort") || "bsr"; // bsr|reviews|rating|last_seen
  const dir = (url.searchParams.get("dir") || "asc").toLowerCase() === "desc" ? false : true;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const cols = "asin,title,brand,image_url,bullet1,bullet2,merch_flag_source,bsr,bsr_category,rating,reviews_count,price_cents,url,last_seen";
  let query = supabase
    .from("merch_products")
    .select(cols)
    .or(`title.ilike.%${q}%,brand.ilike.%${q}%`)
    .limit(limit);

  // order
  if (sort === "reviews") query = query.order("reviews_count", { ascending: !dir });
  else if (sort === "rating") query = query.order("rating", { ascending: !dir });
  else if (sort === "last_seen") query = query.order("last_seen", { ascending: !dir });
  else query = query.order("bsr", { ascending: dir, nullsFirst: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
