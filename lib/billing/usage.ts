import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsageLimit, type PlanTier, type UsageMetric } from "./plans";
import type { Database } from "../supabase/types";

export interface EnforceUsageInput {
  client: SupabaseClient<Database>;
  userId: string;
  planTier: PlanTier;
  metric: UsageMetric;
  delta?: number;
}

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export async function enforceDailyUsage({
  client,
  userId,
  planTier,
  metric,
  delta = 1
}: EnforceUsageInput): Promise<UsageResult> {
  const limit = getUsageLimit(planTier, metric);
  if (limit == null) {
    return { allowed: true, used: 0, limit: Number.MAX_SAFE_INTEGER, remaining: Number.MAX_SAFE_INTEGER };
  }

  const { data, error } = await client.rpc("increment_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_limit: limit,
    p_delta: delta
  });

  if (error) {
    throw error;
  }

  const [row] = data ?? [];
  if (!row) {
    throw new Error("USAGE_INCREMENT_FAILED");
  }

  const remaining = Math.max(row.limit - row.used, 0);
  return {
    allowed: row.allowed,
    used: row.used,
    limit: row.limit,
    remaining
  };
}
