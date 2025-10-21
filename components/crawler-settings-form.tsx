"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  DEFAULT_CRAWLER_SETTINGS,
  parseDelimitedInput,
  serialiseStringArray,
  type CrawlerSettings,
  type OverrideMap
} from "@/lib/crawler-settings";

const MAX_ITEMS_RANGE = { min: 50, max: 5000 } as const;
const PAGE_RANGE = { min: 1, max: 20 } as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type Props = {
  stored: CrawlerSettings;
  effective: CrawlerSettings;
  overrides: OverrideMap;
  canEdit: boolean;
  initialError?: string | null | undefined;
};

export function CrawlerSettingsForm({ stored, effective, overrides, canEdit, initialError }: Props) {
  const [form, setForm] = useState<CrawlerSettings>(stored);
  const [effectiveState, setEffectiveState] = useState<CrawlerSettings>(effective);
  const [overrideState, setOverrideState] = useState<OverrideMap>(overrides);
  const [status, setStatus] = useState<{ success?: string; error?: string }>(() =>
    initialError ? { error: initialError } : {}
  );
  const [submitting, setSubmitting] = useState(false);

  const overriddenKeys = useMemo(() => {
    const entries = Object.entries(overrideState).filter(([, value]) => Boolean(value));
    return new Set(entries.map(([key]) => key));
  }, [overrideState]);

  const disabled = !canEdit || submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    setSubmitting(true);
    setStatus({});
    try {
      const response = await fetch("/api/admin/crawler-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Failed to save settings");
      }
      const payload = (await response.json()) as {
        stored: CrawlerSettings;
        effective: CrawlerSettings;
        overrides: OverrideMap;
      };
      setForm(payload.stored);
      setEffectiveState(payload.effective);
      setOverrideState(payload.overrides ?? {});
      setStatus({ success: "Settings saved" });
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Failed to save settings" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetToDefaults = () => {
    if (!canEdit) return;
    setForm({ ...DEFAULT_CRAWLER_SETTINGS });
    setStatus({});
  };

  const updateField = <K extends keyof CrawlerSettings>(key: K, value: CrawlerSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <fieldset className="space-y-4" disabled={disabled}>
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">Discovery budget</legend>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="max-items">
              Max items
            </label>
            <input
              id="max-items"
              type="number"
              min={MAX_ITEMS_RANGE.min}
              max={MAX_ITEMS_RANGE.max}
              value={form.max_items}
              onChange={event =>
                updateField("max_items", clamp(toInt(event.target.value, form.max_items), MAX_ITEMS_RANGE.min, MAX_ITEMS_RANGE.max))
              }
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("max_items") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="space-y-4" disabled={disabled}>
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">Best Sellers (ZGBS)</legend>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.use_best_sellers}
              onChange={event => updateField("use_best_sellers", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Use Best Sellers paths
          </label>
          {overriddenKeys.has("use_best_sellers") ? (
            <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="zgbs-pages">
              Pages per path
            </label>
            <input
              id="zgbs-pages"
              type="number"
              min={PAGE_RANGE.min}
              max={PAGE_RANGE.max}
              value={form.zgbs_pages}
              onChange={event =>
                updateField("zgbs_pages", clamp(toInt(event.target.value, form.zgbs_pages), PAGE_RANGE.min, PAGE_RANGE.max))
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("zgbs_pages") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="zgbs-paths">
              Custom ZGBS paths (one per line)
            </label>
            <textarea
              id="zgbs-paths"
              value={serialiseStringArray(form.zgbs_paths)}
              onChange={event => updateField("zgbs_paths", parseDelimitedInput(event.target.value))}
              rows={4}
              placeholder="/Best-Sellers/zgbs/fashion/..."
              className="min-h-[6rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("zgbs_paths") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Leave empty to use the built-in Fashion and T-Shirt categories.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-4" disabled={disabled}>
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">Filtered search</legend>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.use_search}
              onChange={event => updateField("use_search", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Enable keyword search
          </label>
          {overriddenKeys.has("use_search") ? (
            <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="search-pages">
              Pages per keyword
            </label>
            <input
              id="search-pages"
              type="number"
              min={PAGE_RANGE.min}
              max={PAGE_RANGE.max}
              value={form.search_pages}
              onChange={event =>
                updateField("search_pages", clamp(toInt(event.target.value, form.search_pages), PAGE_RANGE.min, PAGE_RANGE.max))
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("search_pages") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              id="search-category"
              label="Category (i parameter)"
              value={form.search_category ?? ""}
              onChange={value => updateField("search_category", value || null)}
              overridden={overriddenKeys.has("search_category")}
              placeholder="fashion-mens-tshirts"
            />
            <TextInput
              id="search-sort"
              label="Sort (s parameter)"
              value={form.search_sort ?? ""}
              onChange={value => updateField("search_sort", value || null)}
              overridden={overriddenKeys.has("search_sort")}
              placeholder="review-rank"
            />
            <TextInput
              id="search-rh"
              label="Filters (rh parameter)"
              value={form.search_rh ?? ""}
              onChange={value => updateField("search_rh", value || null)}
              overridden={overriddenKeys.has("search_rh")}
              placeholder="n:7141123011"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="search-keywords">
              Keywords (one per line)
            </label>
            <textarea
              id="search-keywords"
              value={serialiseStringArray(form.search_keywords)}
              onChange={event => updateField("search_keywords", parseDelimitedInput(event.target.value))}
              rows={4}
              placeholder="merch hoodie\nretro t-shirt"
              className="min-h-[6rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("search_keywords") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextareaField
              id="hidden-include"
              label="Hidden keyword includes"
              value={form.hidden_include}
              onChange={values => updateField("hidden_include", values)}
              overridden={overriddenKeys.has("hidden_include")}
              placeholder="official"
            />
            <TextareaField
              id="hidden-exclude"
              label="Hidden keyword excludes"
              value={form.hidden_exclude}
              onChange={values => updateField("hidden_exclude", values)}
              overridden={overriddenKeys.has("hidden_exclude")}
              placeholder="adult\ncustom"
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : canEdit ? "Save settings" : "Read-only"}
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={disabled}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset to defaults
          </button>
          {status.success ? <p className="text-sm font-medium text-emerald-600">{status.success}</p> : null}
          {status.error ? <p className="text-sm font-medium text-rose-600">{status.error}</p> : null}
        </div>
      </form>

      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white/60 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Effective settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These values are applied during the next crawl run after combining stored preferences and environment overrides.
        </p>
        <pre className="max-h-[24rem] overflow-auto rounded-lg bg-slate-900/90 p-4 text-xs text-slate-100">
{JSON.stringify(effectiveState, null, 2)}
        </pre>
        {overriddenKeys.size ? (
          <div className="space-y-2 text-xs text-amber-600">
            <p className="font-semibold">Environment overrides</p>
            <ul className="list-disc pl-5">
              {Array.from(overriddenKeys).map(key => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">No environment overrides detected.</p>
        )}
      </aside>
    </div>
  );
}

type TextInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  overridden?: boolean;
  onChange: (value: string) => void;
};

function TextInput({ id, label, value, placeholder, overridden, onChange }: TextInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      {overridden ? <p className="text-xs font-medium text-amber-600">Overridden by environment</p> : null}
    </div>
  );
}

type TextareaFieldProps = {
  id: string;
  label: string;
  value: string[];
  placeholder?: string;
  overridden?: boolean;
  onChange: (values: string[]) => void;
};

function TextareaField({ id, label, value, placeholder, overridden, onChange }: TextareaFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        value={serialiseStringArray(value)}
        onChange={event => onChange(parseDelimitedInput(event.target.value))}
        rows={4}
        placeholder={placeholder}
        className="min-h-[6rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      {overridden ? <p className="text-xs font-medium text-amber-600">Overridden by environment</p> : null}
    </div>
  );
}
