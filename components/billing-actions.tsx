"use client";

import { useState, useTransition } from "react";

interface BillingActionsProps {
  planTier: "basic" | "pro";
  stripeSubscriptionId: string | null;
}

export function BillingActions({ planTier, stripeSubscriptionId }: BillingActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isCheckoutPending, startCheckout] = useTransition();
  const [isPortalLoading, setPortalLoading] = useState(false);

  const startUpgrade = () => {
    setError(null);
    startCheckout(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "pro" })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: "Unable to start checkout" }));
          setError(body.error ?? "Unable to start checkout");
          return;
        }
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError("Checkout session missing redirect URL");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected checkout error");
      }
    });
  };

  const openPortal = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal");
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Unable to open billing portal" }));
        setError(body.error ?? "Unable to open billing portal");
        setPortalLoading(false);
        return;
      }
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Billing portal session missing redirect URL");
        setPortalLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected portal error");
      setPortalLoading(false);
    }
  };

  const showUpgrade = planTier !== "pro";
  const showPortal = Boolean(stripeSubscriptionId);

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        {showUpgrade ? (
          <button
            type="button"
            onClick={startUpgrade}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
            disabled={isCheckoutPending}
          >
            Upgrade to Pro
          </button>
        ) : null}
        {showPortal ? (
          <button
            type="button"
            onClick={openPortal}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={isPortalLoading}
          >
            {isPortalLoading ? "Opening…" : "Manage billing"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
