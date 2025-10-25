"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  DEFAULT_CRAWLER_SETTINGS,
  parseDelimitedInput,
  serialiseStringArray,
  type CrawlerSettings,
  type OverrideMap
} from "@/lib/crawler-settings";

const MAX_ITEMS_RANGE = { min: 100, max: 5000 } as const;
const ZGBS_PAGE_RANGE = { min: 1, max: 10 } as const;
const NEW_PAGE_RANGE = { min: 1, max: 5 } as const;
const MOVERS_PAGE_RANGE = { min: 1, max: 3 } as const;
const SEARCH_PAGE_RANGE = { min: 1, max: 5 } as const;
const RECRAWL_RANGE = {
  P0: { min: 4, max: 24 },
  P1: { min: 8, max: 48 },
  P2: { min: 12, max: 72 },
  P3: { min: 24, max: 168 }
} as const;
const DELAY_PAGE_RANGE = { min: 1000, max: 7000 } as const;
const DELAY_PRODUCT_RANGE = { min: 3000, max: 12000 } as const;

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
  const allowUnbounded = canEdit;

  const applyBounds = (value: number, range: { min: number; max: number }) =>
    allowUnbounded ? Math.max(range.min, value) : clamp(value, range.min, range.max);

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
              max={allowUnbounded ? undefined : MAX_ITEMS_RANGE.max}
              value={form.max_items_per_run}
              onChange={event =>
                updateField(
                  "max_items_per_run",
                  applyBounds(toInt(event.target.value, form.max_items_per_run), MAX_ITEMS_RANGE)
                )
              }
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("max_items_per_run") ? (
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
              min={ZGBS_PAGE_RANGE.min}
              max={allowUnbounded ? undefined : ZGBS_PAGE_RANGE.max}
              value={form.zgbs_pages}
              onChange={event =>
                updateField(
                  "zgbs_pages",
                  applyBounds(toInt(event.target.value, form.zgbs_pages), ZGBS_PAGE_RANGE)
                )
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
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">New Releases</legend>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.use_new_releases}
              onChange={event => updateField("use_new_releases", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Use New Releases paths
          </label>
          {overriddenKeys.has("use_new_releases") ? (
            <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="new-pages">
              Pages per path
            </label>
            <input
              id="new-pages"
              type="number"
              min={NEW_PAGE_RANGE.min}
              max={allowUnbounded ? undefined : NEW_PAGE_RANGE.max}
              value={form.new_pages}
              onChange={event =>
                updateField(
                  "new_pages",
                  applyBounds(toInt(event.target.value, form.new_pages), NEW_PAGE_RANGE)
                )
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("new_pages") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="new-paths">
              Custom New Release paths (one per line)
            </label>
            <textarea
              id="new-paths"
              value={serialiseStringArray(form.new_paths)}
              onChange={event => updateField("new_paths", parseDelimitedInput(event.target.value))}
              rows={4}
              placeholder="/new-releases/fashion/..."
              className="min-h-[6rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("new_paths") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">Leave empty to use the default mirrored fashion categories.</p>
          </div>
        </fieldset>

        <fieldset className="space-y-4" disabled={disabled}>
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">Movers &amp; Shakers</legend>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.use_movers}
              onChange={event => updateField("use_movers", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Use Movers &amp; Shakers paths
          </label>
          {overriddenKeys.has("use_movers") ? (
            <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="movers-pages">
              Pages per path
            </label>
            <input
              id="movers-pages"
              type="number"
              min={MOVERS_PAGE_RANGE.min}
              max={allowUnbounded ? undefined : MOVERS_PAGE_RANGE.max}
              value={form.movers_pages}
              onChange={event =>
                updateField(
                  "movers_pages",
                  applyBounds(toInt(event.target.value, form.movers_pages), MOVERS_PAGE_RANGE)
                )
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("movers_pages") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="movers-paths">
              Custom Movers paths (one per line)
            </label>
            <textarea
              id="movers-paths"
              value={serialiseStringArray(form.movers_paths)}
              onChange={event => updateField("movers_paths", parseDelimitedInput(event.target.value))}
              rows={4}
              placeholder="/movers-and-shakers/fashion/..."
              className="min-h-[6rem] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("movers_paths") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
            <p className="text-xs text-slate-500 dark:text-slate-400">Leave empty to mirror the default fashion movers lists.</p>
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
              min={SEARCH_PAGE_RANGE.min}
              max={allowUnbounded ? undefined : SEARCH_PAGE_RANGE.max}
              value={form.search_pages}
              onChange={event =>
                updateField(
                  "search_pages",
                  applyBounds(toInt(event.target.value, form.search_pages), SEARCH_PAGE_RANGE)
                )
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            {overriddenKeys.has("search_pages") ? (
              <p className="text-xs font-medium text-amber-600">Overridden by environment</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
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
              placeholder="featured"
            />
            <TextInput
              id="search-rh"
              label="Filters (rh parameter)"
              value={form.search_rh ?? ""}
              onChange={value => updateField("search_rh", value || null)}
              overridden={overriddenKeys.has("search_rh")}
              placeholder="p_6:ATVPDKIKX0DER"
            />
            <TextInput
              id="marketplace-id"
              label="Marketplace ID"
              value={form.marketplace_id}
              onChange={value => updateField("marketplace_id", value || DEFAULT_CRAWLER_SETTINGS.marketplace_id)}
              overridden={overriddenKeys.has("marketplace_id")}
              placeholder="ATVPDKIKX0DER"
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

        <fieldset className="space-y-4" disabled={disabled}>
          <legend className="text-lg font-semibold text-slate-900 dark:text-slate-100">Cadence &amp; throttling</legend>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure how often each priority tier is revisited and the randomized delays between fetches.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <NumberField
              id="recrawl-p0"
              label="P0 recrawl (hours)"
              value={form.recrawl_hours_p0}
              min={RECRAWL_RANGE.P0.min}
              max={RECRAWL_RANGE.P0.max}
              overridden={overriddenKeys.has("recrawl_hours_p0")}
              onChange={value => updateField("recrawl_hours_p0", value)}
              allowUnbounded={allowUnbounded}
            />
            <NumberField
              id="recrawl-p1"
              label="P1 recrawl (hours)"
              value={form.recrawl_hours_p1}
              min={RECRAWL_RANGE.P1.min}
              max={RECRAWL_RANGE.P1.max}
              overridden={overriddenKeys.has("recrawl_hours_p1")}
              onChange={value => updateField("recrawl_hours_p1", value)}
              allowUnbounded={allowUnbounded}
            />
            <NumberField
              id="recrawl-p2"
              label="P2 recrawl (hours)"
              value={form.recrawl_hours_p2}
              min={RECRAWL_RANGE.P2.min}
              max={RECRAWL_RANGE.P2.max}
              overridden={overriddenKeys.has("recrawl_hours_p2")}
              onChange={value => updateField("recrawl_hours_p2", value)}
              allowUnbounded={allowUnbounded}
            />
            <NumberField
              id="recrawl-p3"
              label="P3 recrawl (hours)"
              value={form.recrawl_hours_p3}
              min={RECRAWL_RANGE.P3.min}
              max={RECRAWL_RANGE.P3.max}
              overridden={overriddenKeys.has("recrawl_hours_p3")}
              onChange={value => updateField("recrawl_hours_p3", value)}
              allowUnbounded={allowUnbounded}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Listing delay (ms)</p>
              <div className="flex gap-3">
                <NumberField
                  id="per-page-delay-min"
                  label="Min"
                  value={form.per_page_delay_ms_min}
                  min={DELAY_PAGE_RANGE.min}
                  max={DELAY_PAGE_RANGE.max}
                  overridden={overriddenKeys.has("per_page_delay_ms_min")}
                  onChange={value => updateField("per_page_delay_ms_min", value)}
                  allowUnbounded={allowUnbounded}
                />
                <NumberField
                  id="per-page-delay-max"
                  label="Max"
                  value={form.per_page_delay_ms_max}
                  min={DELAY_PAGE_RANGE.min}
                  max={DELAY_PAGE_RANGE.max}
                  overridden={overriddenKeys.has("per_page_delay_ms_max")}
                  onChange={value => updateField("per_page_delay_ms_max", value)}
                  allowUnbounded={allowUnbounded}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Product delay (ms)</p>
              <div className="flex gap-3">
                <NumberField
                  id="per-product-delay-min"
                  label="Min"
                  value={form.per_product_delay_ms_min}
                  min={DELAY_PRODUCT_RANGE.min}
                  max={DELAY_PRODUCT_RANGE.max}
                  overridden={overriddenKeys.has("per_product_delay_ms_min")}
                  onChange={value => updateField("per_product_delay_ms_min", value)}
                  allowUnbounded={allowUnbounded}
                />
                <NumberField
                  id="per-product-delay-max"
                  label="Max"
                  value={form.per_product_delay_ms_max}
                  min={DELAY_PRODUCT_RANGE.min}
                  max={DELAY_PRODUCT_RANGE.max}
                  overridden={overriddenKeys.has("per_product_delay_ms_max")}
                  onChange={value => updateField("per_product_delay_ms_max", value)}
                  allowUnbounded={allowUnbounded}
                />
              </div>
            </div>
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

type NumberFieldProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  overridden?: boolean;
  onChange: (value: number) => void;
  allowUnbounded?: boolean;
};

function NumberField({ id, label, value, min, max, overridden, onChange, allowUnbounded = false }: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={allowUnbounded ? undefined : max}
        value={value}
        onChange={event =>
          onChange(allowUnbounded ? Math.max(min, toInt(event.target.value, value)) : clamp(toInt(event.target.value, value), min, max))
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
      {overridden ? <p className="text-xs font-medium text-amber-600">Overridden by environment</p> : null}
    </div>
  );
}

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
