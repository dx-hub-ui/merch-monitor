export const DEFAULT_KEYWORD_ALIAS = "us";

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
