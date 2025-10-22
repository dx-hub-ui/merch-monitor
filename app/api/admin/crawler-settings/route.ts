import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildEffectiveSettings,
  CRAWLER_SETTINGS_FIELDS,
  DEFAULT_CRAWLER_SETTINGS,
  normaliseCrawlerSettings,
  parseSettingsRecord,
  toSettingsPayload,
  type CrawlerSettings
} from "@/lib/crawler-settings";
import { isAdminUser } from "@/lib/auth/roles";

const E2E_STORE = Symbol.for("merch-watcher.e2e-crawler-settings");

type E2EContainer = {
  stored: CrawlerSettings;
};

function getE2EStore(): E2EContainer {
  const globalAny = globalThis as unknown as Record<symbol, E2EContainer | undefined>;
  if (!globalAny[E2E_STORE]) {
    globalAny[E2E_STORE] = { stored: { ...DEFAULT_CRAWLER_SETTINGS } };
  }
  return globalAny[E2E_STORE]!;
}

function isBypassMode() {
  return process.env.E2E_BYPASS_AUTH === "true";
}

async function fetchStoredSettingsSupabase() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const canEdit = isAdminUser(user);

  const { data, error } = await supabase
    .from("crawler_settings")
    .select(CRAWLER_SETTINGS_FIELDS.join(","))
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  const stored = normaliseCrawlerSettings(parseSettingsRecord(data));
  return { stored, canEdit };
}

async function handleGet() {
  if (isBypassMode()) {
    const store = getE2EStore();
    const { settings, overrides } = buildEffectiveSettings(store.stored, process.env);
    return NextResponse.json({
      stored: store.stored,
      effective: settings,
      overrides,
      canEdit: true,
      bypass: true
    });
  }

  try {
    const { stored, canEdit } = await fetchStoredSettingsSupabase();
    const { settings, overrides } = buildEffectiveSettings(stored, process.env);
    return NextResponse.json({ stored, effective: settings, overrides, canEdit });
  } catch (error) {
    const response = NextResponse.json({ stored: DEFAULT_CRAWLER_SETTINGS, effective: DEFAULT_CRAWLER_SETTINGS }, { status: 200 });
    response.headers.set("x-error", error instanceof Error ? error.message : "Failed to load settings");
    return response;
  }
}

async function handlePost(req: NextRequest) {
  const payload = toSettingsPayload(await req.json().catch(() => ({})));

  if (isBypassMode()) {
    const store = getE2EStore();
    store.stored = payload;
    const { settings, overrides } = buildEffectiveSettings(store.stored, process.env);
    return NextResponse.json({ stored: store.stored, effective: settings, overrides, canEdit: true, bypass: true });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const record = { id: 1, ...payload, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("crawler_settings").upsert(record, { onConflict: "id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { settings, overrides } = buildEffectiveSettings(payload, process.env);
  return NextResponse.json({ stored: payload, effective: settings, overrides, canEdit: true });
}

export async function GET() {
  return handleGet();
}

export async function POST(req: NextRequest) {
  return handlePost(req);
}
