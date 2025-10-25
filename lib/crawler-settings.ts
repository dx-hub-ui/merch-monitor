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
  zgbs_pages: z.number().int().min(3).max(10).default(5),
  zgbs_paths: z.array(z.string()).default([]),
  use_new_releases: z.boolean().default(true),
  new_pages: z.number().int().min(1).max(5).default(2),
  new_paths: z.array(z.string()).default([]),
  use_movers: z.boolean().default(true),
  movers_pages: z.number().int().min(1).max(3).default(2),
  movers_paths: z.array(z.string()).default([]),
  use_search: z.boolean().default(true),
  search_pages: z.number().int().min(1).max(5).default(2),
  search_category: z.string().nullable().default("fashion-novelty"),
  search_sort: z.string().nullable().default("featured"),
  search_rh: z.string().nullable().default("p_6:ATVPDKIKX0DER"),
  search_keywords: z.array(z.string()).default([]),
  hidden_include: z.array(z.string()).default([]),
  hidden_exclude: z.array(z.string()).default([]),
  max_items_per_run: z.number().int().min(100).max(5000).default(600),
  recrawl_hours_p0: z.number().int().min(4).max(24).default(8),
  recrawl_hours_p1: z.number().int().min(8).max(48).default(18),
  recrawl_hours_p2: z.number().int().min(12).max(72).default(36),
  recrawl_hours_p3: z.number().int().min(24).max(168).default(96),
  per_page_delay_ms_min: z.number().int().min(1000).max(5000).default(1500),
  per_page_delay_ms_max: z.number().int().min(1500).max(7000).default(3000),
  per_product_delay_ms_min: z.number().int().min(3000).max(8000).default(4000),
  per_product_delay_ms_max: z.number().int().min(4000).max(12000).default(6000),
  marketplace_id: z.string().min(1).max(32).default("ATVPDKIKX0DER")
});

export type CrawlerSettings = z.infer<typeof crawlerSettingsSchema>;

export type SettingsRecord = CrawlerSettings & { updated_at?: string | null };

export const DEFAULT_CRAWLER_SETTINGS: CrawlerSettings = {
  use_best_sellers: true,
  zgbs_pages: 5,
  zgbs_paths: [],
  use_new_releases: true,
  new_pages: 2,
  new_paths: [],
  use_movers: true,
  movers_pages: 2,
  movers_paths: [],
  use_search: true,
  search_pages: 2,
  search_category: "fashion-novelty",
  search_sort: "featured",
  search_rh: "p_6:ATVPDKIKX0DER",
  search_keywords: [],
  hidden_include: [],
  hidden_exclude: [],
  max_items_per_run: 600,
  recrawl_hours_p0: 8,
  recrawl_hours_p1: 18,
  recrawl_hours_p2: 36,
  recrawl_hours_p3: 96,
  per_page_delay_ms_min: 1500,
  per_page_delay_ms_max: 3000,
  per_product_delay_ms_min: 4000,
  per_product_delay_ms_max: 6000,
  marketplace_id: "ATVPDKIKX0DER"
};

export const CRAWLER_SETTINGS_FIELDS = [
  "use_best_sellers",
  "zgbs_pages",
  "zgbs_paths",
  "use_new_releases",
  "new_pages",
  "new_paths",
  "use_movers",
  "movers_pages",
  "movers_paths",
  "use_search",
  "search_pages",
  "search_category",
  "search_sort",
  "search_rh",
  "search_keywords",
  "hidden_include",
  "hidden_exclude",
  "max_items_per_run",
  "recrawl_hours_p0",
  "recrawl_hours_p1",
  "recrawl_hours_p2",
  "recrawl_hours_p3",
  "per_page_delay_ms_min",
  "per_page_delay_ms_max",
  "per_product_delay_ms_min",
  "per_product_delay_ms_max",
  "marketplace_id"
] as const satisfies ReadonlyArray<keyof CrawlerSettings>;

export const DEFAULT_ZGBS_PATHS = [
  "/Best-Sellers/zgbs",
  "/Best-Sellers-Clothing-Shoes-Jewelry/zgbs/fashion",
  "/Best-Sellers-Novelty-More/zgbs/fashion/12035955011",
  "/Best-Sellers-Mens-Fashion-T-Shirts/zgbs/fashion/1040658",
  "/Best-Sellers-Womens-Fashion-T-Shirts/zgbs/fashion/1258644011",
  "/Best-Sellers-Boys-Fashion/zgbs/fashion/7147443011",
  "/Best-Sellers-Girls-Fashion/zgbs/fashion/7147442011"
];

export const DEFAULT_NEW_RELEASE_PATHS = [
  "/gp/new-releases",
  "/gp/new-releases/fashion",
  "/gp/new-releases/fashion/12035955011",
  "/gp/new-releases/fashion/1040658",
  "/gp/new-releases/fashion/1258644011",
  "/gp/new-releases/fashion/7147443011",
  "/gp/new-releases/fashion/7147442011"
];

export const DEFAULT_MOVERS_PATHS = [
  "/gp/movers-and-shakers",
  "/gp/movers-and-shakers/fashion",
  "/gp/movers-and-shakers/fashion/12035955011",
  "/gp/movers-and-shakers/fashion/1040658",
  "/gp/movers-and-shakers/fashion/1258644011",
  "/gp/movers-and-shakers/fashion/7147443011",
  "/gp/movers-and-shakers/fashion/7147442011"
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
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const perPageMin = clamp(merged.per_page_delay_ms_min, 1000, 5000);
  const perPageMax = clamp(merged.per_page_delay_ms_max, 1500, 7000);
  const perProductMin = clamp(merged.per_product_delay_ms_min, 3000, 8000);
  const perProductMax = clamp(merged.per_product_delay_ms_max, 4000, 12000);
  return {
    ...merged,
    zgbs_paths: sanitizeStringArray(merged.zgbs_paths),
    new_paths: sanitizeStringArray(merged.new_paths),
    movers_paths: sanitizeStringArray(merged.movers_paths),
    search_keywords: sanitizeStringArray(merged.search_keywords),
    hidden_include: sanitizeStringArray(merged.hidden_include),
    hidden_exclude: sanitizeStringArray(merged.hidden_exclude),
    zgbs_pages: clamp(merged.zgbs_pages, 3, 10),
    new_pages: clamp(merged.new_pages, 1, 5),
    movers_pages: clamp(merged.movers_pages, 1, 3),
    search_pages: clamp(merged.search_pages, 1, 5),
    max_items_per_run: clamp(merged.max_items_per_run, 100, 5000),
    recrawl_hours_p0: clamp(merged.recrawl_hours_p0, 4, 24),
    recrawl_hours_p1: clamp(merged.recrawl_hours_p1, 8, 48),
    recrawl_hours_p2: clamp(merged.recrawl_hours_p2, 12, 72),
    recrawl_hours_p3: clamp(merged.recrawl_hours_p3, 24, 168),
    per_page_delay_ms_min: Math.min(perPageMin, perPageMax),
    per_page_delay_ms_max: Math.max(perPageMin, perPageMax),
    per_product_delay_ms_min: Math.min(perProductMin, perProductMax),
    per_product_delay_ms_max: Math.max(perProductMin, perProductMax),
    marketplace_id: (merged.marketplace_id || "ATVPDKIKX0DER").trim() || "ATVPDKIKX0DER"
  };
}

const BOOL_ENV_KEYS = ["use_best_sellers", "use_new_releases", "use_movers", "use_search"] as const;

const INT_ENV_BOUNDS: Partial<Record<keyof CrawlerSettings, { min: number; max: number }>> = {
  zgbs_pages: { min: 1, max: 10 },
  new_pages: { min: 1, max: 5 },
  movers_pages: { min: 1, max: 3 },
  search_pages: { min: 1, max: 5 },
  max_items_per_run: { min: 100, max: 5000 },
  recrawl_hours_p0: { min: 4, max: 24 },
  recrawl_hours_p1: { min: 8, max: 48 },
  recrawl_hours_p2: { min: 12, max: 72 },
  recrawl_hours_p3: { min: 24, max: 168 },
  per_page_delay_ms_min: { min: 1000, max: 5000 },
  per_page_delay_ms_max: { min: 1500, max: 7000 },
  per_product_delay_ms_min: { min: 3000, max: 8000 },
  per_product_delay_ms_max: { min: 4000, max: 12000 }
};

const ARRAY_ENV_KEYS = [
  "zgbs_paths",
  "new_paths",
  "movers_paths",
  "search_keywords",
  "hidden_include",
  "hidden_exclude"
] as const;

const STRING_ENV_KEYS = ["search_category", "search_sort", "search_rh"] as const;
const STRICT_STRING_ENV_KEYS = ["marketplace_id"] as const;

export type OverrideMap = Partial<Record<keyof CrawlerSettings, true>>;

function isKeyFromList<T extends readonly (keyof CrawlerSettings)[]>(
  key: keyof CrawlerSettings,
  list: T
): key is T[number] {
  return (list as readonly string[]).includes(key as string);
}

function isBooleanSettingKey(key: keyof CrawlerSettings): key is (typeof BOOL_ENV_KEYS)[number] {
  return isKeyFromList(key, BOOL_ENV_KEYS);
}

const INT_ENV_KEYS = Object.keys(INT_ENV_BOUNDS) as (keyof typeof INT_ENV_BOUNDS)[];

function isNumericSettingKey(key: keyof CrawlerSettings): key is (typeof INT_ENV_KEYS)[number] {
  return (INT_ENV_KEYS as readonly string[]).includes(key as string);
}

function isArraySettingKey(key: keyof CrawlerSettings): key is (typeof ARRAY_ENV_KEYS)[number] {
  return isKeyFromList(key, ARRAY_ENV_KEYS);
}

function isNullableStringSettingKey(key: keyof CrawlerSettings): key is (typeof STRING_ENV_KEYS)[number] {
  return isKeyFromList(key, STRING_ENV_KEYS);
}

function isStrictStringSettingKey(key: keyof CrawlerSettings): key is (typeof STRICT_STRING_ENV_KEYS)[number] {
  return isKeyFromList(key, STRICT_STRING_ENV_KEYS);
}

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
        const bounds = INT_ENV_BOUNDS[key];
        if (bounds) {
          const constrained = Math.min(bounds.max, Math.max(bounds.min, value));
          const typedKey = key as keyof CrawlerSettings;
          (updated as Record<keyof CrawlerSettings, unknown>)[typedKey] = constrained;
          overrides[typedKey] = true;
        }
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

  for (const key of STRICT_STRING_ENV_KEYS) {
    const envKey = key.toUpperCase();
    if (env[envKey] != null) {
      const value = env[envKey]!.trim();
      updated[key] = value || DEFAULT_CRAWLER_SETTINGS[key];
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
  if (!settings.new_paths.length) {
    settings.new_paths = [...DEFAULT_NEW_RELEASE_PATHS];
  }
  if (!settings.movers_paths.length) {
    settings.movers_paths = [...DEFAULT_MOVERS_PATHS];
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
  const base: CrawlerSettings = { ...DEFAULT_CRAWLER_SETTINGS };
  for (const key of CRAWLER_SETTINGS_FIELDS) {
    const raw = (input as Record<string, unknown>)[key];
    if (raw == null) continue;
    if (isArraySettingKey(key)) {
      const values = Array.isArray(raw) ? (raw as string[]) : parseDelimitedInput(String(raw));
      base[key] = sanitizeStringArray(values);
      continue;
    }

    if (isBooleanSettingKey(key)) {
      if (typeof raw === "boolean") {
        base[key] = raw;
      } else if (typeof raw === "string") {
        base[key] = raw.toLowerCase() === "true";
      }
      continue;
    }

    if (isNumericSettingKey(key)) {
      const numeric = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
      if (Number.isFinite(numeric)) {
        const typedKey = key as keyof CrawlerSettings;
        (base as Record<keyof CrawlerSettings, unknown>)[typedKey] = numeric;
      }
      continue;
    }

    if (isNullableStringSettingKey(key)) {
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        base[key] = (trimmed || null) as CrawlerSettings[typeof key];
      }
      continue;
    }

    if (isStrictStringSettingKey(key)) {
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        base[key] = (trimmed || DEFAULT_CRAWLER_SETTINGS[key]) as CrawlerSettings[typeof key];
      }
      continue;
    }

    if (typeof raw === "string") {
      base[key] = (raw.trim() || null) as CrawlerSettings[typeof key];
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      base[key] = raw as CrawlerSettings[typeof key];
    }
  }
  return normaliseCrawlerSettings(base);
}
