import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_LIMITS, USAGE_METRICS, getUsageLimit } from "@/lib/billing/plans";
import { extractEntitlements } from "@/lib/billing/claims";
import { enforceDailyUsage } from "@/lib/billing/usage";
import type { Database } from "@/lib/supabase/types";

const fakeUser = (claims: Record<string, unknown>) =>
  ({
    id: "user-1",
    app_metadata: claims
  } as unknown as Parameters<typeof extractEntitlements>[0]);

describe("plan limits", () => {
  it("exposes expected basic limits", () => {
    expect(PLAN_LIMITS.basic.keywordSearchesDaily).toBe(30);
    expect(PLAN_LIMITS.basic.savedListsMax).toBe(1);
    expect(PLAN_LIMITS.basic.historyDays).toBe(7);
  });

  it("exposes expected pro limits", () => {
    expect(PLAN_LIMITS.pro.keywordSearchesDaily).toBe(1000);
    expect(PLAN_LIMITS.pro.exports).toBe(true);
    expect(PLAN_LIMITS.pro.apiAccess).toBe(true);
  });
});

describe("entitlement extraction", () => {
  it("falls back to basic when claims are missing", () => {
    const entitlements = extractEntitlements(fakeUser({}), undefined);
    expect(entitlements.planTier).toBe("basic");
    expect(entitlements.seats).toBe(1);
  });

  it("prefers explicit profile values", () => {
    const entitlements = extractEntitlements(fakeUser({ plan_tier: "basic", seats: 1 }), {
      plan_tier: "pro",
      plan_status: "active",
      trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      seats: 3
    });
    expect(entitlements.planTier).toBe("pro");
    expect(entitlements.planStatus).toBe("active");
    expect(entitlements.seats).toBe(3);
    expect(entitlements.trialActive).toBe(true);
  });
});

describe("usage enforcement", () => {
  it("returns remaining quota when allowed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ used: 5, limit: 30, allowed: true }],
      error: null
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await enforceDailyUsage({
      client,
      userId: "user-1",
      planTier: "basic",
      metric: USAGE_METRICS.keywordSearch
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(25);
    expect(rpc).toHaveBeenCalledWith("increment_usage", {
      p_user_id: "user-1",
      p_metric: USAGE_METRICS.keywordSearch,
      p_limit: getUsageLimit("basic", USAGE_METRICS.keywordSearch),
      p_delta: 1
    });
  });

  it("surfaces limit errors when disallowed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ used: 30, limit: 30, allowed: false }],
      error: null
    });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    const result = await enforceDailyUsage({
      client,
      userId: "user-1",
      planTier: "basic",
      metric: USAGE_METRICS.keywordSearch
    });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
