import clsx from "clsx";
import { Check } from "lucide-react";
import { StartCheckoutButton } from "@/components/start-checkout-button";
import { PLAN_LIMITS, PLAN_PRICES } from "@/lib/billing/plans";

export const metadata = { title: "Plans • Merch Watcher" };

const formatPrice = (cents: number) => {
  const dollars = cents / 100;
  const isWhole = Number.isInteger(dollars);
  return `$${dollars.toFixed(isWhole ? 0 : 2)}`;
};

const formatSavedLists = (count: number) => `Up to ${count} saved ${count === 1 ? "list" : "lists"}`;

const plans = [
  {
    id: "basic" as const,
    title: "Basic",
    description: "Get started with tracking trending merchandise and keyword research.",
    price: `${formatPrice(PLAN_PRICES.basic)}/month`,
    highlight: false,
    features: [
      `${PLAN_LIMITS.basic.keywordSearchesDaily.toLocaleString()} keyword searches per day`,
      formatSavedLists(PLAN_LIMITS.basic.savedListsMax),
      `${PLAN_LIMITS.basic.historyDays}-day historical coverage`,
      `Top ${PLAN_LIMITS.basic.serpDepth} SERP results`,
      `${PLAN_LIMITS.basic.momentumWindows[0]}-day momentum window`,
      `Data refresh every ${PLAN_LIMITS.basic.refreshIntervalHours} hours`
    ],
    footer: PLAN_LIMITS.basic.exports
      ? "Includes exports, alerts, and API access"
      : "Exports, alerts, and API access are available on the Pro plan"
  },
  {
    id: "pro" as const,
    title: "Pro",
    description: "Unlock deeper insights, faster refreshes, and advanced automation for your team.",
    price: `${formatPrice(PLAN_PRICES.pro)}/month`,
    highlight: true,
    features: [
      `${PLAN_LIMITS.pro.keywordSearchesDaily.toLocaleString()} keyword searches per day`,
      `Up to ${PLAN_LIMITS.pro.savedListsMax} saved lists`,
      `${PLAN_LIMITS.pro.historyDays}-day historical coverage`,
      `Top ${PLAN_LIMITS.pro.serpDepth} SERP results`,
      `${PLAN_LIMITS.pro.momentumWindows.join(" & ")}-day momentum windows`,
      `Data refresh every ${PLAN_LIMITS.pro.refreshIntervalHours} hours`,
      "CSV exports",
      "Alerts",
      "API access"
    ],
    footer: "Cancel anytime. Billed monthly."
  }
];

export default function PlansPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header className="space-y-4 text-center">
        <p className="mx-auto inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          Pricing
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Choose the right plan for you</h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Compare features to find the best fit. Upgrade when you are ready—no commitments required.
          </p>
        </div>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map(plan => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </section>
  );
}

type Plan = (typeof plans)[number];

type PlanCardProps = {
  plan: Plan;
};

function PlanCard({ plan }: PlanCardProps) {
  const { id, title, description, price, features, highlight, footer } = plan;

  return (
    <div
      className={clsx(
        "flex h-full flex-col justify-between rounded-3xl border bg-white/80 p-6 shadow-sm transition-shadow dark:bg-slate-900/60",
        highlight ? "border-brand/50 ring-2 ring-brand/40" : "border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <span className="text-sm font-medium text-brand">{price}</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <ul className="space-y-3">
          {features.map(feature => (
            <li key={feature} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 space-y-3">
        {id === "pro" ? (
          <StartCheckoutButton plan="pro" fullWidth pendingLabel="Redirecting to checkout…">
            Upgrade to Pro
          </StartCheckoutButton>
        ) : (
          <button
            type="button"
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-500"
            disabled
          >
            Current plan
          </button>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">{footer}</p>
      </div>
    </div>
  );
}
