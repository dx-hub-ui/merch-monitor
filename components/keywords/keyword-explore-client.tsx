"use client";

import type { FocusEventHandler, FormEvent } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addKeywordsToList,
  createKeywordList,
  deleteKeywordList,
  removeKeywordFromList,
  renameKeywordList
} from "@/app/(app)/keywords/actions";
import type {
  KeywordExploreResult,
  KeywordList,
  KeywordMetricPoint,
  KeywordSerpResult
} from "@/lib/keywords";
import { normaliseKeywordTerm } from "@/lib/keywords";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

function formatDecimal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return decimalFormatter.format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${percentFormatter.format(value * 100)}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${(value / 100).toFixed(2)}`;
}

type Props = {
  initialQuery: string;
  initialResult: KeywordExploreResult | null;
  initialLists: KeywordList[];
};

type FeedbackState = {
  message: string | null;
  error: string | null;
};

export function KeywordExploreClient({ initialQuery, initialResult, initialLists }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<KeywordExploreResult | null>(initialResult);
  const [lists, setLists] = useState<KeywordList[]>(initialLists);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(() => {
    if (!initialResult) return [];
    const seeds = new Map<string, string>();
    const add = (keyword: string) => {
      const normalised = normaliseKeywordTerm(keyword);
      if (normalised && !seeds.has(normalised.normalized)) {
        seeds.set(normalised.normalized, normalised.original);
      }
    };
    add(initialResult.term);
    for (const keyword of initialResult.suggestions.slice(0, 10)) {
      add(keyword);
    }
    return Array.from(seeds.values());
  });
  const [targetListId, setTargetListId] = useState<string>(initialLists[0]?.id ?? "");
  const [newListName, setNewListName] = useState("");
  const [customKeyword, setCustomKeyword] = useState("");
  const [copyStatus, setCopyStatus] = useState<FeedbackState>({ message: null, error: null });
  const [listFeedback, setListFeedback] = useState<FeedbackState>({ message: null, error: null });
  const [searchFeedback, setSearchFeedback] = useState<FeedbackState>({ message: null, error: null });
  const [isSearching, startSearchTransition] = useTransition();
  const [isMutatingList, startListTransition] = useTransition();

  const selectedMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const keyword of selectedKeywords) {
      const normalised = normaliseKeywordTerm(keyword);
      if (normalised && !map.has(normalised.normalized)) {
        map.set(normalised.normalized, normalised.original);
      }
    }
    return map;
  }, [selectedKeywords]);

  const isKeywordSelected = (keyword: string) => {
    const normalised = normaliseKeywordTerm(keyword);
    if (!normalised) return false;
    return selectedMap.has(normalised.normalized);
  };

  const addKeyword = (keyword: string) => {
    const normalised = normaliseKeywordTerm(keyword);
    if (!normalised) return false;
    setSelectedKeywords(current => {
      const map = new Map<string, string>();
      for (const item of current) {
        const data = normaliseKeywordTerm(item);
        if (data && !map.has(data.normalized)) {
          map.set(data.normalized, data.original);
        }
      }
      if (!map.has(normalised.normalized)) {
        map.set(normalised.normalized, normalised.original);
      }
      return Array.from(map.values());
    });
    return true;
  };

  const toggleKeyword = (keyword: string) => {
    const normalised = normaliseKeywordTerm(keyword);
    if (!normalised) return;
    setSelectedKeywords(current => {
      const map = new Map<string, string>();
      for (const item of current) {
        const data = normaliseKeywordTerm(item);
        if (data) {
          map.set(data.normalized, data.original);
        }
      }
      if (map.has(normalised.normalized)) {
        map.delete(normalised.normalized);
      } else {
        map.set(normalised.normalized, normalised.original);
      }
      return Array.from(map.values());
    });
  };

  const removeSelectedKeyword = (keyword: string) => {
    const normalised = normaliseKeywordTerm(keyword);
    if (!normalised) return;
    setSelectedKeywords(current => {
      const map = new Map<string, string>();
      for (const item of current) {
        const data = normaliseKeywordTerm(item);
        if (data) {
          map.set(data.normalized, data.original);
        }
      }
      map.delete(normalised.normalized);
      return Array.from(map.values());
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      setSearchFeedback({ message: null, error: "Enter a keyword to explore." });
      return;
    }
    setSearchFeedback({ message: null, error: null });
    startSearchTransition(async () => {
      try {
        const response = await fetch("/api/keywords/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term })
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const errorMessage = typeof body?.error === "string" ? body.error : "Unable to fetch keyword insights.";
          setSearchFeedback({ message: null, error: errorMessage });
          return;
        }
        const data = (await response.json()) as KeywordExploreResult;
        setResult(data);
        setSearchFeedback({ message: `Updated keyword intelligence for “${data.term}”.`, error: null });
        addKeyword(data.term);
        for (const suggestion of data.suggestions.slice(0, 10)) {
          addKeyword(suggestion);
        }
        router.replace(`/keywords/explore?q=${encodeURIComponent(data.term)}`, { scroll: false });
      } catch (error) {
        console.error(error);
        setSearchFeedback({ message: null, error: "Unexpected error while searching." });
      }
    });
  };

  const handleAddCustomKeyword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customKeyword.trim()) return;
    const success = addKeyword(customKeyword);
    if (!success) {
      setListFeedback({ message: null, error: "Enter a valid keyword phrase." });
    } else {
      setListFeedback({ message: `Added “${customKeyword.trim()}” to selection.`, error: null });
      setCustomKeyword("");
    }
  };

  const handleCopySelected = async () => {
    if (!selectedKeywords.length) {
      setCopyStatus({ message: null, error: "Select keywords to copy." });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus({ message: null, error: "Clipboard API is not available." });
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedKeywords.join("\n"));
      setCopyStatus({ message: `Copied ${selectedKeywords.length} keyword${selectedKeywords.length === 1 ? "" : "s"}.`, error: null });
      setTimeout(() => setCopyStatus({ message: null, error: null }), 2500);
    } catch (error) {
      console.error(error);
      setCopyStatus({ message: null, error: "Clipboard access was denied." });
    }
  };

  const handleCreateList = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) {
      setListFeedback({ message: null, error: "List name is required." });
      return;
    }
    setListFeedback({ message: null, error: null });
    startListTransition(async () => {
      try {
        const updatedLists = await createKeywordList(name);
        setLists(updatedLists);
        const created = updatedLists.find(list => list.name === name);
        if (created) {
          setTargetListId(created.id);
        }
        setNewListName("");
        setListFeedback({ message: `Created list “${name}”.`, error: null });
      } catch (error) {
        console.error(error);
        setListFeedback({ message: null, error: error instanceof Error ? error.message : "Failed to create list." });
      }
    });
  };

  const handleSaveSelected = () => {
    if (!selectedKeywords.length) {
      setListFeedback({ message: null, error: "Select keywords to save." });
      return;
    }
    if (!targetListId) {
      setListFeedback({ message: null, error: "Choose a destination list." });
      return;
    }
    setListFeedback({ message: null, error: null });
    const alias = result?.alias;
    startListTransition(async () => {
      try {
        const updatedLists = await addKeywordsToList(targetListId, selectedKeywords, alias);
        setLists(updatedLists);
        const target = updatedLists.find(list => list.id === targetListId);
        setListFeedback({
          message: target
            ? `Saved ${selectedKeywords.length} keyword${selectedKeywords.length === 1 ? "" : "s"} to “${target.name}”.`
            : `Saved ${selectedKeywords.length} keyword${selectedKeywords.length === 1 ? "" : "s"}.`,
          error: null
        });
      } catch (error) {
        console.error(error);
        setListFeedback({ message: null, error: error instanceof Error ? error.message : "Failed to save keywords." });
      }
    });
  };

  const handleRenameList = (listId: string, name: string) => {
    startListTransition(async () => {
      try {
        const updated = await renameKeywordList(listId, name);
        setLists(updated);
        setListFeedback({ message: `Renamed list to “${name}”.`, error: null });
      } catch (error) {
        console.error(error);
        setListFeedback({ message: null, error: error instanceof Error ? error.message : "Failed to rename list." });
      }
    });
  };

  const handleDeleteList = (listId: string) => {
    if (!window.confirm("Delete this keyword list?")) {
      return;
    }
    startListTransition(async () => {
      try {
        const updated = await deleteKeywordList(listId);
        setLists(updated);
        if (targetListId === listId) {
          setTargetListId(updated[0]?.id ?? "");
        }
        setListFeedback({ message: "Deleted keyword list.", error: null });
      } catch (error) {
        console.error(error);
        setListFeedback({ message: null, error: error instanceof Error ? error.message : "Failed to delete list." });
      }
    });
  };

  const handleRemoveKeywordFromList = (itemId: number) => {
    startListTransition(async () => {
      try {
        const updated = await removeKeywordFromList(itemId);
        setLists(updated);
        setListFeedback({ message: "Removed keyword from list.", error: null });
      } catch (error) {
        console.error(error);
        setListFeedback({ message: null, error: error instanceof Error ? error.message : "Failed to remove keyword." });
      }
    });
  };

  const summaryCards = useMemo(() => buildSummaryCards(result), [result]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="flex flex-col gap-6">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
        >
          <label htmlFor="keyword-search" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Search for an Amazon keyword
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="keyword-search"
              name="keyword-search"
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="e.g. retro cat shirt"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand via-brand-dark to-brand-deeper px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-brand-light hover:to-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? "Searching…" : "Explore"}
            </button>
          </div>
          {searchFeedback.error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{searchFeedback.error}</p>
          ) : null}
          {searchFeedback.message ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{searchFeedback.message}</p>
          ) : null}
        </form>

        {result ? (
          <div className="flex flex-col gap-6">
            <SummarySection summaryCards={summaryCards} fetchedAt={result.fetchedAt} samples={result.summary?.samples ?? null} />
            <SuggestionsSection
              title="Autocomplete & semantic expansions"
              description="Click a suggestion to add or remove it from your working set."
              keywords={result.suggestions}
              onToggle={toggleKeyword}
              isSelected={isKeywordSelected}
            />
            <SuggestionsSection
              title="Related searches"
              description="Queries shoppers also explore around this topic."
              keywords={result.relatedTerms}
              onToggle={toggleKeyword}
              isSelected={isKeywordSelected}
            />
            <MetricsTable metrics={result.metrics} />
            <SerpTable serp={result.serp} />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
      <aside className="flex flex-col gap-6">
        <SelectedKeywordsPanel
          keywords={selectedKeywords}
          onRemove={removeSelectedKeyword}
          onCopy={handleCopySelected}
          copyStatus={copyStatus}
          onCustomSubmit={handleAddCustomKeyword}
          customKeyword={customKeyword}
          onCustomKeywordChange={setCustomKeyword}
          targetListId={targetListId}
          onTargetListChange={setTargetListId}
          lists={lists}
          onSave={handleSaveSelected}
          isSaving={isMutatingList}
          feedback={listFeedback}
        />
        <KeywordListsManager
          lists={lists}
          onRename={handleRenameList}
          onDelete={handleDeleteList}
          onRemoveKeyword={handleRemoveKeywordFromList}
          onCopyList={keywords => {
            if (!keywords.length) {
              setCopyStatus({ message: null, error: "Selected list is empty." });
              return;
            }
            if (typeof navigator === "undefined" || !navigator.clipboard) {
              setCopyStatus({ message: null, error: "Clipboard API is not available." });
              return;
            }
            navigator.clipboard
              .writeText(keywords.join("\n"))
              .then(() =>
                setCopyStatus({ message: `Copied ${keywords.length} keyword${keywords.length === 1 ? "" : "s"} from list.`, error: null })
              )
              .catch(error => {
                console.error(error);
                setCopyStatus({ message: null, error: "Clipboard access was denied." });
              });
          }}
        />
        <form
          onSubmit={handleCreateList}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create a new list</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lists stay private to your account so you can build launch, advertising, or research sets.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newListName}
              onChange={event => setNewListName(event.target.value)}
              placeholder="My campaign list"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isMutatingList}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Create list
            </button>
          </div>
          {listFeedback.error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{listFeedback.error}</p>
          ) : null}
          {listFeedback.message ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{listFeedback.message}</p>
          ) : null}
        </form>
      </aside>
    </div>
  );
}

type SummaryCard = {
  label: string;
  value: string;
  helper?: string;
};

function buildSummaryCards(result: KeywordExploreResult | null): SummaryCard[] {
  if (!result || !result.summary) {
    return [];
  }
  const summary = result.summary;
  return [
    { label: "Opportunity", value: formatDecimal(summary.opportunity) },
    { label: "Difficulty", value: formatDecimal(summary.difficulty) },
    { label: "Competition", value: formatDecimal(summary.competition) },
    { label: "Avg reviews", value: formatNumber(summary.avgReviews) },
    { label: "Median BSR", value: formatNumber(summary.medBsr) },
    { label: "Merch share", value: summary.shareMerch == null ? "—" : formatPercent(summary.shareMerch) }
  ];
}

type SummarySectionProps = {
  summaryCards: SummaryCard[];
  fetchedAt: string | null;
  samples: number | null;
};

function SummarySection({ summaryCards, fetchedAt, samples }: SummarySectionProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Keyword snapshot</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Latest opportunity model and SERP coverage. Updated {fetchedAt ? new Date(fetchedAt).toLocaleString() : "recently"} {samples ? `• ${samples} samples` : ""}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.length ? (
          summaryCards.map(card => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{card.value}</p>
              {card.helper ? <p className="text-xs text-slate-500 dark:text-slate-400">{card.helper}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No scoring data yet. Run the SERP crawler to populate momentum and competition metrics.</p>
        )}
      </div>
    </div>
  );
}

type SuggestionsSectionProps = {
  title: string;
  description: string;
  keywords: string[];
  isSelected: (keyword: string) => boolean;
  onToggle: (keyword: string) => void;
};

function SuggestionsSection({ title, description, keywords, isSelected, onToggle }: SuggestionsSectionProps) {
  if (!keywords.length) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {keywords.map(keyword => {
          const selected = isSelected(keyword);
          return (
            <button
              key={keyword}
              type="button"
              onClick={() => onToggle(keyword)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 ${
                selected
                  ? "bg-brand text-white shadow-lg"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {keyword}
              <span className="text-xs">{selected ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MetricsTableProps = {
  metrics: KeywordMetricPoint[];
};

function MetricsTable({ metrics }: MetricsTableProps) {
  if (!metrics.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        Run the metrics job to calculate historical opportunity, competition, and momentum for this keyword.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">30-day score history</h2>
        <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Most recent first</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/80 dark:bg-slate-800/40">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Date
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Opportunity
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Difficulty
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Competition
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Samples
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Merch share
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Momentum 7d
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Momentum 30d
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/70 dark:divide-slate-800 dark:bg-slate-900/40">
            {metrics
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(metric => (
                <tr key={metric.date}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">
                    {new Date(metric.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatDecimal(metric.opportunity)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatDecimal(metric.difficulty)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatDecimal(metric.competition)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatNumber(metric.samples)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatPercent(metric.shareMerch)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatDecimal(metric.momentum7d)}</td>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatDecimal(metric.momentum30d)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SerpTableProps = {
  serp: KeywordSerpResult[];
};

function SerpTable({ serp }: SerpTableProps) {
  if (!serp.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        No SERP snapshot is available yet. The crawler will populate listings after the next run.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Latest SERP composition</h2>
        <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top {Math.min(serp.length, 40)} results</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50/80 dark:bg-slate-800/40">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Rank
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                ASIN / Title
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Brand
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Reviews
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Rating
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Price
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                BSR
              </th>
              <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                Merch?
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/70 dark:divide-slate-800 dark:bg-slate-900/40">
            {serp.slice(0, 50).map(entry => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700 dark:text-slate-200">{entry.position}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.asin}</span>
                    {entry.title ? <span className="text-xs text-slate-500 dark:text-slate-400">{entry.title}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{entry.brand ?? "—"}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatNumber(entry.reviews)}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{entry.rating == null ? "—" : entry.rating.toFixed(1)}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatCurrency(entry.priceCents)}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{formatNumber(entry.bsr)}</td>
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                  {entry.isMerch ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      No
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SelectedKeywordsPanelProps = {
  keywords: string[];
  onRemove: (keyword: string) => void;
  onCopy: () => void;
  copyStatus: FeedbackState;
  customKeyword: string;
  onCustomKeywordChange: (value: string) => void;
  onCustomSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  targetListId: string;
  onTargetListChange: (value: string) => void;
  lists: KeywordList[];
  onSave: () => void;
  isSaving: boolean;
  feedback: FeedbackState;
};

function SelectedKeywordsPanel({
  keywords,
  onRemove,
  onCopy,
  copyStatus,
  customKeyword,
  onCustomKeywordChange,
  onCustomSubmit,
  targetListId,
  onTargetListChange,
  lists,
  onSave,
  isSaving,
  feedback
}: SelectedKeywordsPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Working set</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Toggle suggestions or add your own phrases to curate a launch or PPC cluster.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {keywords.length ? (
          keywords.map(keyword => (
            <button
              key={keyword}
              type="button"
              onClick={() => onRemove(keyword)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-sm text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {keyword}
              <span aria-hidden="true">×</span>
            </button>
          ))
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No keywords selected yet.</p>
        )}
      </div>
      <form onSubmit={onCustomSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={customKeyword}
          onChange={event => onCustomKeywordChange(event.target.value)}
          placeholder="Add custom keyword"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Add keyword
        </button>
      </form>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand via-brand-dark to-brand-deeper px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:from-brand-light hover:to-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Copy to clipboard
          </button>
          {copyStatus.error ? <p className="text-sm text-rose-600 dark:text-rose-400">{copyStatus.error}</p> : null}
          {copyStatus.message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{copyStatus.message}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Save selection to list</label>
          <div className="flex flex-col gap-3">
            <select
              value={targetListId}
              onChange={event => onTargetListChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
            >
              <option value="">Choose a list…</option>
              {lists.map(list => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.keywords.length})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isSaving ? "Saving…" : "Save keywords"}
            </button>
          </div>
        </div>
        {feedback.error ? <p className="text-sm text-rose-600 dark:text-rose-400">{feedback.error}</p> : null}
        {feedback.message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback.message}</p> : null}
      </div>
    </div>
  );
}

type KeywordListsManagerProps = {
  lists: KeywordList[];
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
  onRemoveKeyword: (itemId: number) => void;
  onCopyList: (keywords: string[]) => void;
};

function KeywordListsManager({ lists, onRename, onDelete, onRemoveKeyword, onCopyList }: KeywordListsManagerProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your keyword lists</h2>
        {lists.length ? <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{lists.length} saved</span> : null}
      </div>
      {lists.length ? (
        <div className="flex flex-col gap-4">
          {lists.map(list => (
            <div key={list.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <EditableListTitle name={list.name} onRename={name => onRename(list.id, name)} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyList(list.keywords.map(item => item.term))}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Copy list
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(list.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(list.updatedAt).toLocaleString()}</p>
              <div className="flex flex-wrap gap-2">
                {list.keywords.length ? (
                  list.keywords.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onRemoveKeyword(item.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {item.term}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Empty list — add keywords from the working set to populate it.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No lists yet. Create your first list to start tracking keyword cohorts.</p>
      )}
    </div>
  );
}

type EditableListTitleProps = {
  name: string;
  onRename: (name: string) => void;
};

function EditableListTitle({ name, onRename }: EditableListTitleProps) {
  const [value, setValue] = useState(name);
  const [isEditing, setIsEditing] = useState(false);

  const commitRename = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setIsEditing(false);
      setValue(name);
      return;
    }
    onRename(trimmed);
    setIsEditing(false);
    setValue(trimmed);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitRename();
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = () => {
    commitRename();
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-left text-base font-semibold text-slate-900 transition hover:text-brand dark:text-slate-100"
      >
        {name}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={event => setValue(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100"
        autoFocus
        onBlur={handleBlur}
      />
      <button
        type="submit"
        className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        Save
      </button>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Start with a keyword search</h2>
      <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
        Enter any Merch on Demand search phrase to explore autocomplete expansions, semantic neighbors, daily opportunity scores, and the most recent SERP snapshot.
      </p>
    </div>
  );
}
