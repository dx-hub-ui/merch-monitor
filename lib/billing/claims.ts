import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth/roles";
import { PLAN_LIMITS, type Entitlements, type PlanStatus, type PlanTier, buildEntitlements } from "./plans";

interface PlanClaims {
  plan_tier?: string;
  plan_status?: string;
  trial_active?: boolean;
  seats?: number;
  trial_ends_at?: string | null;
}

function normalisePlanTier(value: string | undefined): PlanTier {
  return value === "pro" ? "pro" : "basic";
}

function normalisePlanStatus(value: string | undefined): PlanStatus {
  switch (value) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
      return value;
    default:
      return "inactive";
  }
}

export function extractEntitlements(user: User | null, profile?: {
  plan_tier?: string | null;
  plan_status?: string | null;
  trial_ends_at?: string | null;
  seats?: number | null;
}): Entitlements {
  const claims: PlanClaims = (user?.app_metadata as PlanClaims) ?? {};
  const isAdmin = isAdminUser(user);
  const planTier = normalisePlanTier(profile?.plan_tier ?? claims.plan_tier);
  const planStatus = normalisePlanStatus(profile?.plan_status ?? claims.plan_status);
  const seats = profile?.seats ?? claims.seats ?? 1;
  const trialEndsAt = profile?.trial_ends_at ?? ("trial_ends_at" in claims ? claims.trial_ends_at ?? null : null);
  return buildEntitlements({ planTier, planStatus, trialEndsAt, seats, isAdmin });
}

export { PLAN_LIMITS };
