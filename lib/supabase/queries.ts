import { createServerSupabaseClient } from "./server";
import type { Database } from "./types";

export async function getSession() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }
  return session;
}

export async function fetchProducts(params: {
  search?: string;
  sort?: "bsr" | "reviews" | "rating" | "last_seen";
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
  withImages?: boolean;
}): Promise<Database["public"]["Tables"]["merch_products"]["Row"][]> {
  const supabase = createServerSupabaseClient();
  const { search = "", sort = "bsr", direction = "asc", limit = 40, offset = 0, withImages = false } = params;
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
  const ascending = direction === "asc";
  if (sort === "reviews") query = query.order("reviews_count", { ascending });
  else if (sort === "rating") query = query.order("rating", { ascending });
  else if (sort === "last_seen") query = query.order("last_seen", { ascending });
  else query = query.order("bsr", { ascending, nullsFirst: false });

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchTrends(limit = 50) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("merch_trend_metrics")
    .select(
      "asin,momentum,bsr_now,bsr_24h,bsr_7d,reviews_now,reviews_24h,reviews_7d,rating_now,updated_at,merch_products(title,brand,image_url,url,bsr_category,price_cents)"
    )
    .order("momentum", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductDetail(asin: string) {
  const supabase = createServerSupabaseClient();
  const [{ data: product, error: productError }, { data: history, error: historyError }, { data: embedding, error: embeddingError }]
 = await Promise.all([
    supabase.from("merch_products").select("*").eq("asin", asin).maybeSingle(),
    supabase
      .from("merch_products_history")
      .select("captured_at,price_cents,rating,reviews_count,bsr")
      .eq("asin", asin)
      .order("captured_at", { ascending: true }),
    supabase.from("merch_embeddings").select("embedding").eq("asin", asin).maybeSingle()
  ]);

  if (productError) throw productError;
  if (!product) return null;
  if (historyError) throw historyError;
  if (embeddingError) throw embeddingError;

  let similar: { asin: string; content: string; score: number }[] = [];
  const vector = embedding?.embedding as number[] | null | undefined;
  if (vector && vector.length) {
    const { data: results, error } = await supabase.rpc("semantic_search_merch", {
      query_vec: vector,
      k: 12
    });
    if (error) throw error;
    similar = (results ?? []).filter(item => item.asin !== asin);
  }

  return { product, history: history ?? [], similar };
}
