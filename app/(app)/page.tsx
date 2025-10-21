import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard-client";

export const metadata = { title: "Dashboard • Merch Watcher" };

export default function DashboardPage() {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Search Merch on Demand listings, filter by metrics, and track activity across categories.
        </p>
      </header>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/40" />}> 
        <DashboardClient />
      </Suspense>
    </section>
  );
}
