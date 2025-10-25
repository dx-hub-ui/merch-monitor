"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";

interface StartCheckoutButtonProps {
  plan: "pro";
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  fullWidth?: boolean;
}

export function StartCheckoutButton({
  plan,
  children,
  className,
  pendingLabel = "Redirecting…",
  fullWidth = false
}: StartCheckoutButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startCheckout] = useTransition();

  const handleClick = () => {
    setError(null);
    startCheckout(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan })
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

  return (
    <div className={clsx("space-y-2", fullWidth && "w-full")}>
      <button
        type="button"
        onClick={handleClick}
        className={clsx(
          "inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70",
          fullWidth && "w-full",
          className
        )}
        disabled={isPending}
      >
        {isPending ? pendingLabel : children}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
