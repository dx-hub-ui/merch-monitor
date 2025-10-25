import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import type { Database } from "@/lib/supabase/types";
import { extractEntitlements } from "@/lib/billing/claims";
import { DAILY_USAGE_LIMITS, PLAN_NAMES, type UsageMetric, USAGE_METRICS } from "@/lib/billing/plans";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createRouteSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profileQuery = supabase
    .from("users_profile")
    .select("plan_tier,plan_status,trial_ends_at,seats,stripe_subscription_id");

  const { data: profile, error: profileError } = await (profileQuery as unknown as {
    eq: (
      column: "user_id",
      value: Database["public"]["Tables"]["users_profile"]["Row"]["user_id"]
    ) => typeof profileQuery;
    maybeSingle: typeof profileQuery.maybeSingle;
  })
    .eq(
      "user_id",
      user.id as Database["public"]["Tables"]["users_profile"]["Row"]["user_id"]
    )
    .maybeSingle<Pick<
      Database["public"]["Tables"]["users_profile"]["Row"],
      "plan_tier" | "plan_status" | "trial_ends_at" | "seats" | "stripe_subscription_id"
    >>();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const entitlements = extractEntitlements(user, profile ?? undefined);
  const today = new Date().toISOString().slice(0, 10);
  const usageQuery = supabase.from("usage_counters").select("metric,used,limit");
  const usageByUser = (usageQuery as unknown as {
    eq: (
      column: "user_id",
      value: Database["public"]["Tables"]["usage_counters"]["Row"]["user_id"]
    ) => typeof usageQuery;
  }).eq("user_id", user.id as Database["public"]["Tables"]["usage_counters"]["Row"]["user_id"]);

  const { data: usageRows } = await (usageByUser as unknown as {
    eq: (
      column: "date",
      value: Database["public"]["Tables"]["usage_counters"]["Row"]["date"]
    ) => typeof usageByUser;
  }).eq("date", today as Database["public"]["Tables"]["usage_counters"]["Row"]["date"]);

  const typedUsageRows = (usageRows ?? []) as Pick<
    Database["public"]["Tables"]["usage_counters"]["Row"],
    "metric" | "used" | "limit"
  >[];

  const usageMap = new Map<string, { used: number; limit: number }>();
  for (const row of typedUsageRows) {
    usageMap.set(row.metric, { used: row.used, limit: row.limit });
  }

  const usage = Object.entries(USAGE_METRICS).reduce(
    (acc, [, metric]) => {
      const row = usageMap.get(metric);
      if (entitlements.isAdmin) {
        acc[metric] = {
          used: row?.used ?? 0,
          limit: Number.MAX_SAFE_INTEGER,
          remaining: Number.MAX_SAFE_INTEGER
        };
        return acc;
      }

      const limits = DAILY_USAGE_LIMITS[entitlements.planTier];
      const defaultLimit = limits?.[metric as UsageMetric] ?? 0;
      acc[metric] = {
        used: row?.used ?? 0,
        limit: row?.limit ?? defaultLimit,
        remaining: Math.max((row?.limit ?? defaultLimit) - (row?.used ?? 0), 0)
      };
      return acc;
    },
    {} as Record<string, { used: number; limit: number; remaining: number }>
  );

  return NextResponse.json(
    {
      plan: {
        tier: entitlements.planTier,
        status: entitlements.planStatus,
        name: PLAN_NAMES[entitlements.planTier],
        trialActive: entitlements.trialActive,
        trialEndsAt: profile?.trial_ends_at ?? null,
        seats: entitlements.seats,
        stripeSubscriptionId: profile?.stripe_subscription_id ?? null
      },
      limits: entitlements.limits,
      usage
    },
    { status: 200 }
  );
}
