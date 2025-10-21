export function normalizeBsrDelta(previous: number | null, current: number | null): number {
  if (previous == null || current == null || previous <= 0) return 0;
  const improvement = previous - current;
  if (improvement <= 0) return 0;
  return Math.min(1, improvement / previous);
}

export function normalizeReviewGrowth(previous: number | null, current: number | null): number {
  if (previous == null || current == null || current <= 0) return 0;
  const growth = current - previous;
  if (growth <= 0) return 0;
  return Math.min(1, growth / current);
}

export function computeMomentum({
  bsr7d,
  bsr24h,
  bsrNow,
  reviews24h,
  reviewsNow
}: {
  bsr7d: number | null;
  bsr24h: number | null;
  bsrNow: number | null;
  reviews24h: number | null;
  reviewsNow: number | null;
}): number {
  const sevenDay = normalizeBsrDelta(bsr7d, bsrNow);
  const day = normalizeBsrDelta(bsr24h, bsrNow);
  const reviews = normalizeReviewGrowth(reviews24h, reviewsNow);
  const raw = 0.57 * sevenDay + 0.352 * day + 0.15 * reviews;
  return Math.max(0, Math.min(1, raw));
}
