import { formatDistanceToNowStrict } from "date-fns";
import { changePassword, signOut } from "@/lib/supabase/auth";
import { getSession } from "@/lib/supabase/queries";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getBillingSummary } from "@/lib/billing/queries";
import { BillingActions } from "@/components/billing-actions";

const USAGE_LABELS: Record<string, { label: string; description: string }> = {
  keyword_search: {
    label: "Keyword searches",
    description: "Daily allowance for keyword discovery requests"
  },
  export: {
    label: "Exports",
    description: "Pro plan CSV export usage"
  }
};

export const metadata = { title: "Account • Merch Watcher" };

export default async function AccountPage() {
  const session = await getSession();
  const billing = await getBillingSummary();

  const trialCountdown =
    billing.plan.trialActive && billing.plan.trialEndsAt
      ? formatDistanceToNowStrict(new Date(billing.plan.trialEndsAt), { addSuffix: true })
      : null;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Account</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your credentials and sign out.</p>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plan</h2>
            <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Current plan</dt>
                <dd className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {billing.plan.name}
                  <span className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {billing.plan.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Seats</dt>
                <dd>{billing.plan.seats}</dd>
              </div>
              {billing.plan.trialActive && trialCountdown ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Trial ends</dt>
                  <dd>{trialCountdown}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <BillingActions planTier={billing.plan.tier as "basic" | "pro"} stripeSubscriptionId={billing.plan.stripeSubscriptionId} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Usage today</h3>
            <ul className="mt-3 space-y-3">
              {Object.entries(billing.usage)
                .filter(([, stats]) => stats.limit > 0 || stats.used > 0)
                .map(([metric, stats]) => {
                  const copy = USAGE_LABELS[metric] ?? { label: metric, description: "" };
                  const percent = stats.limit === 0 ? 0 : Math.min(100, Math.round((stats.used / stats.limit) * 100));
                  return (
                    <li key={metric} className="space-y-1">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
                      <span>{copy.label}</span>
                      <span>
                        {stats.used} / {stats.limit === Number.MAX_SAFE_INTEGER ? "∞" : stats.limit}
                      </span>
                    </div>
                    {copy.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{copy.description}</p>
                    ) : null}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Entitlements</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>Keyword searches per day: {billing.limits.keywordSearchesDaily}</li>
              <li>Saved lists: up to {billing.limits.savedListsMax}</li>
              <li>History depth: {billing.limits.historyDays} days</li>
              <li>Maximum SERP depth: top {billing.limits.serpDepth} results</li>
              <li>Momentum windows: {billing.limits.momentumWindows.join(", ")} days</li>
              <li>Refresh interval: every {billing.limits.refreshIntervalHours} hours</li>
              <li>Exports: {billing.limits.exports ? "Enabled" : "Pro only"}</li>
              <li>Alerts: {billing.limits.alerts ? "Enabled" : "Pro only"}</li>
              <li>API access: {billing.limits.apiAccess ? "Enabled" : "Pro only"}</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <dl className="grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="text-base font-medium text-slate-900 dark:text-slate-100">{session?.user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">User ID</dt>
            <dd className="break-all text-xs font-mono">{session?.user.id}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h2>
        <ChangePasswordForm action={changePassword} />
      </div>
      <form action={signOut} className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Sign out</h2>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
