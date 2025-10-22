import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { DAILY_USAGE_LIMITS, type PlanTier } from "@/lib/billing/plans";

async function fetchProfiles(supabase = createServiceRoleClient()) {
  const { data, error } = await supabase
    .from("users_profile")
    .select("user_id,plan_tier");
  if (error) {
    throw error;
  }
  return data ?? [];
}

async function resetUsageForDate(date: string) {
  const supabase = createServiceRoleClient();
  const profiles = await fetchProfiles(supabase);
  for (const profile of profiles) {
    const planTier = (profile.plan_tier as PlanTier) ?? "basic";
    const limits = DAILY_USAGE_LIMITS[planTier];
    for (const [metric, limit] of Object.entries(limits)) {
      await supabase.rpc("reset_usage_limits", {
        p_user_id: profile.user_id,
        p_date: date,
        p_metric: metric,
        p_limit: limit
      });
    }
  }
}

async function main() {
  const scope = process.argv[2] ?? "daily";
  const now = new Date();

  if (scope === "daily") {
    const date = now.toISOString().slice(0, 10);
    await resetUsageForDate(date);
    console.log(`Daily usage reset completed for ${date}`);
    return;
  }

  if (scope === "monthly") {
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    await resetUsageForDate(firstOfMonth);
    console.log(`Monthly usage baseline refreshed for ${firstOfMonth}`);
    return;
  }

  throw new Error(`Unknown reset scope: ${scope}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
