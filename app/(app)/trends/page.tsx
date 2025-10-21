import { Suspense } from "react";
import { TrendsList } from "@/components/trends-list";
import { SemanticSearch } from "@/components/semantic-search";
import { fetchTrends } from "@/lib/supabase/queries";

export const metadata = { title: "Trends • Merch Watcher" };

export default async function TrendsPage() {
  const trends = await fetchTrends(40);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Momentum Board</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Top movers calculated from historical best seller rank, reviews, and rating deltas.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" />}> 
          <TrendsList records={trends} />
        </Suspense>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Semantic search</h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Describe a design or audience to discover merch with similar context.
          </p>
          <SemanticSearch />
        </div>
      </div>
    </section>
  );
}
