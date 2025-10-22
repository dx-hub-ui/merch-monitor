import { Suspense } from "react";
import { fetchKeywordLists, fetchKeywordOverview } from "@/lib/keywords";
import { getSession } from "@/lib/supabase/queries";
import { KeywordExploreClient } from "@/components/keywords/keyword-explore-client";

export const metadata = { title: "Keywords • Merch Watcher" };

type SearchParams = {
  q?: string | string[];
};

type Props = {
  searchParams?: SearchParams;
};

export default async function KeywordExplorePage({ searchParams }: Props) {
  const queryParam = searchParams?.q;
  const query = Array.isArray(queryParam) ? queryParam[0] ?? "" : queryParam ?? "";

  const session = await getSession();
  const userId = session?.user?.id ?? "";

  const [initialResult, initialLists] = await Promise.all([
    query ? fetchKeywordOverview(query) : Promise.resolve(null),
    userId ? fetchKeywordLists(userId) : Promise.resolve([])
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Keyword intelligence</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Explore Amazon search demand, surface opportunity scores, monitor SERP composition, and build private keyword lists in a single workspace.
        </p>
      </header>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" />}>
        <KeywordExploreClient initialQuery={query} initialResult={initialResult} initialLists={initialLists} />
      </Suspense>
    </section>
  );
}
