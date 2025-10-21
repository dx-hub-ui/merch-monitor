import { z } from "zod";

export const PRODUCT_TYPES = [
  "hoodie",
  "sweatshirt",
  "long-sleeve",
  "raglan",
  "v-neck",
  "tank-top",
  "tshirt"
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const crawlerSettingsSchema = z.object({
  use_best_sellers: z.boolean().default(true),
  zgbs_pages: z.number().int().min(1).max(20).default(5),
  zgbs_paths: z.array(z.string()).default([]),
  use_search: z.boolean().default(false),
  search_pages: z.number().int().min(1).max(20).default(3),
  search_category: z.string().nullable().default(null),
  search_sort: z.string().nullable().default(null),
  search_rh: z.string().nullable().default(null),
  search_keywords: z.array(z.string()).default([]),
  hidden_include: z.array(z.string()).default([]),
  hidden_exclude: z.array(z.string()).default([]),
  max_items: z.number().int().min(50).max(5000).default(500)
});

export type CrawlerSettings = z.infer<typeof crawlerSettingsSchema>;

export type SettingsRecord = CrawlerSettings & { updated_at?: string | null };

export const DEFAULT_CRAWLER_SETTINGS: CrawlerSettings = {
  use_best_sellers: true,
  zgbs_pages: 5,
  zgbs_paths: [],
  use_search: false,
  search_pages: 3,
  search_category: null,
  search_sort: null,
  search_rh: null,
  search_keywords: [],
  hidden_include: [],
  hidden_exclude: [],
  max_items: 500
};

export const CRAWLER_SETTINGS_FIELDS = Object.keys(
  DEFAULT_CRAWLER_SETTINGS
) as Array<keyof CrawlerSettings>;

export const DEFAULT_ZGBS_PATHS = [
  "/Best-Sellers/zgbs",
  "/Best-Sellers-Clothing-Shoes-Jewelry/zgbs/fashion",
  "/Best-Sellers-Mens-Fashion/zgbs/fashion/7147441011",
  "/Best-Sellers-Womens-Fashion/zgbs/fashion/7147440011",
  "/Best-Sellers-Boys-Fashion/zgbs/fashion/7147443011",
  "/Best-Sellers-Girls-Fashion/zgbs/fashion/7147442011",
  "/Best-Sellers-Novelty-More/zgbs/fashion/12035955011",
  "/Best-Sellers-Mens-Fashion-T-Shirts/zgbs/fashion/1040658",
  "/Best-Sellers-Womens-Fashion-T-Shirts/zgbs/fashion/1258644011"
];

export function parseSettingsRecord(raw: unknown): SettingsRecord {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CRAWLER_SETTINGS };
  }
  const entries: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    entries[key] = value;
  }
  const result = crawlerSettingsSchema.safeParse(entries);
  if (!result.success) {
    return { ...DEFAULT_CRAWLER_SETTINGS };
  }
  return { ...DEFAULT_CRAWLER_SETTINGS, ...result.data };
}

export function sanitizeStringArray(values: string[] | null | undefined): string[] {
  if (!values) return [];
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export function normaliseCrawlerSettings(partial: Partial<CrawlerSettings>): CrawlerSettings {
  const merged = { ...DEFAULT_CRAWLER_SETTINGS, ...partial } satisfies CrawlerSettings;
  return {
    ...merged,
    zgbs_paths: sanitizeStringArray(merged.zgbs_paths),
    search_keywords: sanitizeStringArray(merged.search_keywords),
    hidden_include: sanitizeStringArray(merged.hidden_include),
    hidden_exclude: sanitizeStringArray(merged.hidden_exclude)
  };
}

const BOOL_ENV_KEYS: Array<keyof CrawlerSettings> = ["use_best_sellers", "use_search"];
const INT_ENV_KEYS: Array<keyof CrawlerSettings> = ["zgbs_pages", "search_pages", "max_items"];
const ARRAY_ENV_KEYS: Array<keyof CrawlerSettings> = [
  "zgbs_paths",
  "search_keywords",
  "hidden_include",
  "hidden_exclude"
];
const STRING_ENV_KEYS: Array<keyof CrawlerSettings> = ["search_category", "search_sort", "search_rh"];

export type OverrideMap = Partial<Record<keyof CrawlerSettings, true>>;

export function applyEnvOverrides(
  settings: CrawlerSettings,
  env: NodeJS.ProcessEnv
): { settings: CrawlerSettings; overrides: OverrideMap } {
  const updated: CrawlerSettings = { ...settings };
  const overrides: OverrideMap = {};

  for (const key of BOOL_ENV_KEYS) {
    const envKey = key.toUpperCase();
    if (env[envKey] != null) {
      updated[key] = env[envKey]!.toLowerCase() === "true";
      overrides[key] = true;
    }
  }

  for (const key of INT_ENV_KEYS) {
    const envKey = key.toUpperCase();
    if (env[envKey] != null) {
      const value = Number.parseInt(env[envKey]!, 10);
      if (Number.isFinite(value)) {
        if (key === "max_items") {
          updated[key] = Math.min(5000, Math.max(50, value));
        } else {
          updated[key] = Math.min(20, Math.max(1, value)) as CrawlerSettings[typeof key];
        }
        overrides[key] = true;
      }
    }
  }

  for (const key of ARRAY_ENV_KEYS) {
    const envKey = key.toUpperCase();
    if (env[envKey] != null) {
      updated[key] = sanitizeStringArray(env[envKey]!.split(","));
      overrides[key] = true;
    }
  }

  for (const key of STRING_ENV_KEYS) {
    const envKey = key.toUpperCase();
    if (env[envKey] != null) {
      const value = env[envKey]!.trim();
      updated[key] = value ? value : null;
      overrides[key] = true;
    }
  }

  return { settings: updated, overrides };
}

export function buildEffectiveSettings(
  stored: Partial<CrawlerSettings> | null | undefined,
  env: NodeJS.ProcessEnv
) {
  const base = normaliseCrawlerSettings(stored ?? {});
  const { settings, overrides } = applyEnvOverrides(base, env);
  if (!settings.zgbs_paths.length) {
    settings.zgbs_paths = [...DEFAULT_ZGBS_PATHS];
  }
  return { settings, overrides };
}

export function parseDelimitedInput(value: string): string[] {
  return sanitizeStringArray(value.split(/[\n,]+/));
}

export function serialiseStringArray(values: string[]): string {
  return values.join("\n");
}

export function toSettingsPayload(input: unknown): CrawlerSettings {
  if (typeof input !== "object" || input === null) {
    return { ...DEFAULT_CRAWLER_SETTINGS };
  }
  const base: Partial<CrawlerSettings> = {};
  for (const key of CRAWLER_SETTINGS_FIELDS) {
    const raw = (input as Record<string, unknown>)[key];
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      base[key] = sanitizeStringArray(raw as string[]) as CrawlerSettings[typeof key];
    } else if (typeof raw === "boolean" || typeof raw === "number") {
      base[key] = raw as CrawlerSettings[typeof key];
    } else if (typeof raw === "string") {
      if (key === "use_best_sellers" || key === "use_search") {
        base[key] = (raw.toLowerCase() === "true") as CrawlerSettings[typeof key];
      } else if (key === "zgbs_pages" || key === "search_pages" || key === "max_items") {
        base[key] = Number.parseInt(raw, 10) as CrawlerSettings[typeof key];
      } else if (
        key === "zgbs_paths" ||
        key === "search_keywords" ||
        key === "hidden_include" ||
        key === "hidden_exclude"
      ) {
        base[key] = sanitizeStringArray(parseDelimitedInput(raw)) as CrawlerSettings[typeof key];
      } else {
        base[key] = (raw.trim() || null) as CrawlerSettings[typeof key];
      }
    }
  }
  return normaliseCrawlerSettings(base);
}
