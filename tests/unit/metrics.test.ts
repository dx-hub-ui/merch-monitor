import { describe, expect, it } from "vitest";
import { computeMomentum, normalizeBsrDelta, normalizeReviewGrowth } from "@/lib/metrics";

describe("momentum", () => {
  it("normalizes BSR improvements", () => {
    expect(normalizeBsrDelta(1000, 500)).toBe(0.5);
    expect(normalizeBsrDelta(1000, 1200)).toBe(0);
    expect(normalizeBsrDelta(null, 100)).toBe(0);
  });

  it("normalizes review growth", () => {
    expect(normalizeReviewGrowth(100, 120)).toBeCloseTo(0.167, 3);
    expect(normalizeReviewGrowth(200, 180)).toBe(0);
  });

  it("computes weighted momentum score", () => {
    const value = computeMomentum({
      bsr7d: 2000,
      bsr24h: 1500,
      bsrNow: 800,
      reviews24h: 100,
      reviewsNow: 130
    });
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});
