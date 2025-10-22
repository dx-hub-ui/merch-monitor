import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CrawlerSettings, OverrideMap } from "@/lib/crawler-settings";
import { DEFAULT_CRAWLER_SETTINGS } from "@/lib/crawler-settings";
import { CrawlerSettingsForm } from "@/components/crawler-settings-form";

function resolveBaseUrl() {
  const headerStore = headers();
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (host) {
    const protocol = headerStore.get("x-forwarded-proto") ?? "https";
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

async function loadSettings() {
  const cookieHeader = cookies().toString();
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(new URL("/api/admin/crawler-settings", baseUrl), {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined
    });
    const data = (await response.json().catch(() => null)) as
      | {
          stored?: CrawlerSettings;
          effective?: CrawlerSettings;
          overrides?: OverrideMap;
          canEdit?: boolean;
          error?: string;
        }
      | null;
    const headerError = response.headers.get("x-error") ?? undefined;
    return {
      stored: data?.stored ?? DEFAULT_CRAWLER_SETTINGS,
      effective: data?.effective ?? DEFAULT_CRAWLER_SETTINGS,
      overrides: data?.overrides ?? {},
      canEdit: data?.canEdit ?? false,
      error: data?.error ?? headerError ?? undefined
    };
  } catch (error) {
    return {
      stored: DEFAULT_CRAWLER_SETTINGS,
      effective: DEFAULT_CRAWLER_SETTINGS,
      overrides: {},
      canEdit: false,
      error: error instanceof Error ? error.message : "Unable to load settings"
    };
  }
}

export default async function CrawlerAdminPage() {
  const result = await loadSettings();
  if (!result) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Crawler settings</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Configure discovery sources, search parameters, and throttles used by the Merch Watcher crawler. Environment variables
          override individual fields at runtime; overridden values are flagged below.
        </p>
      </div>
      <CrawlerSettingsForm
        stored={result.stored}
        effective={result.effective}
        overrides={result.overrides}
        canEdit={result.canEdit}
        initialError={result.error}
      />
    </div>
  );
}
