"use client";

import { useState } from "react";

interface SearchResult {
  asin: string;
  content: string;
  score: number;
}

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        setResults(json as SearchResult[]);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="semantic-query">
          Describe what you want to find
        </label>
        <textarea
          id="semantic-query"
          value={query}
          onChange={event => setQuery(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="e.g. halloween cat graphic tee for kids"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:opacity-70"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      <div className="space-y-3">
        {results.map(result => (
          <article key={result.asin} className="rounded-xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <header className="flex items-center justify-between">
              <a href={`/products/${result.asin}`} className="font-semibold text-brand hover:underline">
                {result.asin}
              </a>
              <span className="text-xs text-slate-500">Score {(result.score ?? 0).toFixed(3)}</span>
            </header>
            <p className="mt-2 whitespace-pre-line text-slate-600 dark:text-slate-300">{result.content}</p>
          </article>
        ))}
        {!results.length && !loading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Semantic results will appear here.</p>
        ) : null}
      </div>
    </div>
  );
}
