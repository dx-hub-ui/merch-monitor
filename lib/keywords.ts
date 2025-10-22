import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./supabase/server";
import type { Database, Json } from "./supabase/types";

export const DEFAULT_KEYWORD_ALIAS = "us";

type Supabase = SupabaseClient<Database, "public">;

type KeywordMetricsRow = Database["public"]["Tables"]["keyword_metrics_daily"]["Row"];
type KeywordSerpRow = Database["public"]["Tables"]["keyword_serp_snapshot"]["Row"];
type KeywordSuggestionRow = Database["public"]["Tables"]["keyword_suggestions"]["Row"];
type KeywordListRow = Database["public"]["Tables"]["keyword_lists"]["Row"];
type KeywordListItemRow = Database["public"]["Tables"]["keyword_list_items"]["Row"];

type ExploreOptions = {
  alias?: string;
  supabase?: Supabase;
};

type ListsOptions = {
  supabase?: Supabase;
};

export type KeywordMetricPoint = {
  date: string;
  difficulty: number;
  opportunity: number;
  competition: number;
  avgBsr: number | null;
  medBsr: number | null;
  shareMerch: number | null;
  avgReviews: number | null;
  medReviews: number | null;
  top10ReviewsP80: number | null;
  serpDiversity: number | null;
  priceIqr: number | null;
  samples: number;
  momentum7d: number | null;
  momentum30d: number | null;
};

export type KeywordSummary = {
  difficulty: number;
  opportunity: number;
  competition: number;
  samples: number;
  shareMerch: number | null;
  serpDiversity: number | null;
  avgReviews: number | null;
  medBsr: number | null;
  avgBsr: number | null;
  priceIqr: number | null;
  momentum7d: number | null;
  momentum30d: number | null;
};

export type KeywordSerpResult = {
  id: number;
  asin: string;
  title: string | null;
  brand: string | null;
  position: number;
  page: number;
  bsr: number | null;
  reviews: number | null;
  rating: number | null;
  priceCents: number | null;
  isMerch: boolean;
  productType: string | null;
};

export type KeywordExploreResult = {
  term: string;
  alias: string;
  normalized: string;
  fetchedAt: string | null;
  metrics: KeywordMetricPoint[];
  serp: KeywordSerpResult[];
  suggestions: string[];
  relatedTerms: string[];
  summary: KeywordSummary | null;
};

export type KeywordListItem = {
  id: number;
  term: string;
  normalized: string;
  alias: string;
  notes: string | null;
  createdAt: string;
};

export type KeywordList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  keywords: KeywordListItem[];
};

export function normaliseKeywordTerm(term: string): { original: string; normalized: string } | null {
  if (typeof term !== "string") {
    return null;
  }
  const trimmed = term.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return null;
  }
  return { original: trimmed, normalized: trimmed.toLowerCase() };
}

function createSupabaseClient(options?: { supabase?: Supabase }): Supabase {
  if (options?.supabase) {
    return options.supabase;
  }
  return createServerSupabaseClient();
}

function dedupeKeywords(keywords: string[]): string[] {
  const map = new Map<string, string>();
  for (const keyword of keywords) {
    const normalized = normaliseKeywordTerm(keyword);
    if (!normalized) continue;
    if (!map.has(normalized.normalized)) {
      map.set(normalized.normalized, normalized.original);
    }
  }
  return Array.from(map.values());
}

function collectKeywordsFromCache(response: Json | null, keys: string[]): string[] {
  if (!response || typeof response !== "object") {
    return [];
  }
  const keywords = new Set<string>();
  const record = response as Record<string, unknown>;

  const visit = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string") {
      const normalized = normaliseKeywordTerm(value);
      if (normalized) {
        keywords.add(normalized.original);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }
    if (typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested.term === "string") {
        const normalized = normaliseKeywordTerm(nested.term);
        if (normalized) {
          keywords.add(normalized.original);
        }
      }
      if (typeof nested.keyword === "string") {
        const normalized = normaliseKeywordTerm(nested.keyword);
        if (normalized) {
          keywords.add(normalized.original);
        }
      }
      if (typeof nested.phrase === "string") {
        const normalized = normaliseKeywordTerm(nested.phrase);
        if (normalized) {
          keywords.add(normalized.original);
        }
      }
      for (const key of keys) {
        if (key in nested) {
          visit(nested[key]);
        }
      }
    }
  };

  for (const key of keys) {
    if (key in record) {
      visit(record[key]);
    }
  }

  return dedupeKeywords(Array.from(keywords));
}

function transformMetrics(rows: KeywordMetricsRow[]): KeywordMetricPoint[] {
  return rows
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(row => ({
      date: row.date,
      difficulty: row.difficulty,
      opportunity: row.opportunity,
      competition: row.competition,
      avgBsr: row.avg_bsr,
      medBsr: row.med_bsr,
      shareMerch: row.share_merch,
      avgReviews: row.avg_reviews,
      medReviews: row.med_reviews,
      top10ReviewsP80: row.top10_reviews_p80,
      serpDiversity: row.serp_diversity,
      priceIqr: row.price_iqr,
      samples: row.samples,
      momentum7d: row.momentum_7d,
      momentum30d: row.momentum_30d
    }));
}

function transformSerp(rows: KeywordSerpRow[]): { serp: KeywordSerpResult[]; fetchedAt: string | null } {
  if (!rows.length) {
    return { serp: [], fetchedAt: null };
  }
  const latestFetchedAt = rows[0].fetched_at;
  const filtered = rows.filter(row => row.fetched_at === latestFetchedAt);
  return {
    fetchedAt: latestFetchedAt,
    serp: filtered.map(row => ({
      id: row.id,
      asin: row.asin,
      title: row.title,
      brand: row.brand,
      position: row.position,
      page: row.page,
      bsr: row.bsr,
      reviews: row.reviews,
      rating: row.rating,
      priceCents: row.price_cents,
      isMerch: row.is_merch,
      productType: row.product_type
    }))
  };
}

function buildSummary(points: KeywordMetricPoint[]): KeywordSummary | null {
  if (!points.length) {
    return null;
  }
  const latest = points[points.length - 1];
  return {
    difficulty: latest.difficulty,
    opportunity: latest.opportunity,
    competition: latest.competition,
    samples: latest.samples,
    shareMerch: latest.shareMerch,
    serpDiversity: latest.serpDiversity,
    avgReviews: latest.avgReviews,
    medBsr: latest.medBsr,
    avgBsr: latest.avgBsr,
    priceIqr: latest.priceIqr,
    momentum7d: latest.momentum7d,
    momentum30d: latest.momentum30d
  };
}

function parseSuggestionRows(rows: KeywordSuggestionRow[]): string[] {
  return dedupeKeywords(rows.map(row => row.term));
}

export async function fetchKeywordOverview(
  term: string,
  options: ExploreOptions = {}
): Promise<KeywordExploreResult | null> {
  const normalized = normaliseKeywordTerm(term);
  if (!normalized) {
    return null;
  }

  const alias = (options.alias ?? DEFAULT_KEYWORD_ALIAS).toLowerCase();
  const supabase = createSupabaseClient(options);

  const [{ data: cacheRow, error: cacheError }, { data: metricsRows, error: metricsError }, { data: suggestionsRows, error: suggestionsError }, { data: serpRows, error: serpError }] =
    await Promise.all([
      supabase
        .from("keyword_explore_cache")
        .select("response,fetched_at")
        .eq("alias", alias)
        .eq("term", normalized.original)
        .maybeSingle(),
      supabase
        .from("keyword_metrics_daily")
        .select("*")
        .eq("alias", alias)
        .eq("term", normalized.original)
        .order("date", { ascending: true }),
      supabase
        .from("keyword_suggestions")
        .select("term,position")
        .eq("alias", alias)
        .ilike("term", `${normalized.original}%`)
        .order("position", { ascending: true })
        .limit(25),
      supabase
        .from("keyword_serp_snapshot")
        .select("id,term,alias,page,position,asin,bsr,reviews,rating,price_cents,title,brand,is_merch,product_type,fetched_at")
        .eq("alias", alias)
        .eq("term", normalized.original)
        .order("fetched_at", { ascending: false })
        .order("page", { ascending: true })
        .order("position", { ascending: true })
        .limit(100)
    ]);

  if (cacheError) throw cacheError;
  if (metricsError) throw metricsError;
  if (suggestionsError) throw suggestionsError;
  if (serpError) throw serpError;

  const metrics = transformMetrics(metricsRows ?? []);
  const { serp, fetchedAt: serpFetchedAt } = transformSerp(serpRows ?? []);

  const cacheResponse = cacheRow?.response ?? null;
  const cacheFetchedAt = cacheRow?.fetched_at ?? null;
  const suggestionKeywords = parseSuggestionRows(suggestionsRows ?? []);

  const suggestionKeys = ["suggestions", "expansions", "keywords", "top", "top_terms", "opportunities"];
  const relatedKeys = ["related", "related_terms", "neighbors", "semantic", "similar", "explore", "variants"];

  const cachedSuggestions = collectKeywordsFromCache(cacheResponse, suggestionKeys);
  const cachedRelated = collectKeywordsFromCache(cacheResponse, relatedKeys);

  const suggestions = dedupeKeywords([
    normalized.original,
    ...cachedSuggestions,
    ...suggestionKeywords
  ]);

  const relatedTerms = dedupeKeywords(cachedRelated.filter(keyword => keyword !== normalized.original));

  const fetchedAt = serpFetchedAt ?? (metrics.length ? metrics[metrics.length - 1].date : null) ?? cacheFetchedAt;

  return {
    term: normalized.original,
    alias,
    normalized: normalized.normalized,
    fetchedAt,
    metrics,
    serp,
    suggestions,
    relatedTerms,
    summary: buildSummary(metrics)
  };
}

export async function fetchKeywordLists(userId: string, options: ListsOptions = {}): Promise<KeywordList[]> {
  if (!userId) {
    return [];
  }
  const supabase = createSupabaseClient(options);
  const { data, error } = await supabase
    .from("keyword_lists")
    .select("id,name,created_at,updated_at,keyword_list_items(id,term,normalized,alias,notes,created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const lists = (data ?? []).map((list: KeywordListRow & { keyword_list_items: KeywordListItemRow[] | null }) => ({
    id: list.id,
    name: list.name,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
    keywords: (list.keyword_list_items ?? [])
      .slice()
      .sort((a, b) => a.term.localeCompare(b.term))
      .map(item => ({
        id: item.id,
        term: item.term,
        normalized: item.normalized,
        alias: item.alias,
        notes: item.notes ?? null,
        createdAt: item.created_at
      }))
  }));

  return lists;
}
