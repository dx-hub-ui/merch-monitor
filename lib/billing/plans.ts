export type PlanTier = "basic" | "pro";

export type PlanStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled";

export interface PlanLimits {
  keywordSearchesDaily: number;
  savedListsMax: number;
  historyDays: number;
  serpDepth: number;
  momentumWindows: number[];
  refreshIntervalHours: number;
  exports: boolean;
  alerts: boolean;
  apiAccess: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  basic: {
    keywordSearchesDaily: 30,
    savedListsMax: 1,
    historyDays: 7,
    serpDepth: 10,
    momentumWindows: [7],
    refreshIntervalHours: 24,
    exports: false,
    alerts: false,
    apiAccess: false
  },
  pro: {
    keywordSearchesDaily: 1000,
    savedListsMax: 10,
    historyDays: 90,
    serpDepth: 100,
    momentumWindows: [7, 30],
    refreshIntervalHours: 4,
    exports: true,
    alerts: true,
    apiAccess: true
  }
};

export const PLAN_PRICES: Record<PlanTier, number> = {
  basic: 700,
  pro: 2999
};

export const PLAN_NAMES: Record<PlanTier, string> = {
  basic: "Basic",
  pro: "Pro"
};

export const USAGE_METRICS = {
  keywordSearch: "keyword_search",
  export: "export"
} as const;

export type UsageMetric = (typeof USAGE_METRICS)[keyof typeof USAGE_METRICS];

export const DAILY_USAGE_LIMITS: Record<PlanTier, Record<UsageMetric, number>> = {
  basic: {
    [USAGE_METRICS.keywordSearch]: PLAN_LIMITS.basic.keywordSearchesDaily
  },
  pro: {
    [USAGE_METRICS.keywordSearch]: PLAN_LIMITS.pro.keywordSearchesDaily,
    [USAGE_METRICS.export]: 2_147_483_647
  }
};

export function getStripePriceIdForPlan(plan: PlanTier): string {
  if (plan === "basic") {
    const priceId = process.env.STRIPE_PRICE_BASIC;
    if (!priceId) {
      throw new Error("STRIPE_PRICE_BASIC is not configured");
    }
    return priceId;
  }

  const priceId = process.env.STRIPE_PRICE_PRO;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_PRO is not configured");
  }
  return priceId;
}

export function getPlanFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

export function getUsageLimit(plan: PlanTier, metric: UsageMetric): number | null {
  const limits = DAILY_USAGE_LIMITS[plan];
  return limits?.[metric] ?? null;
}

export interface Entitlements {
  planTier: PlanTier;
  planStatus: PlanStatus;
  trialActive: boolean;
  seats: number;
  limits: PlanLimits;
}

export function buildEntitlements(params: {
  planTier: PlanTier;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  seats: number;
}): Entitlements {
  const { planTier, planStatus, trialEndsAt, seats } = params;
  const limits = PLAN_LIMITS[planTier];
  return {
    planTier,
    planStatus,
    trialActive: Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > Date.now()),
    seats: Math.max(seats, 1),
    limits
  };
}
