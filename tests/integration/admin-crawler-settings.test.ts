import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
const upsertFn = vi.fn();
const selectChain = {
  maybeSingle: vi.fn()
};
const select = vi.fn(() => ({ limit: () => selectChain }));
const from = vi.fn(() => ({ select, upsert: upsertFn }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: { getSession },
    from
  })
}));

describe("admin crawler settings route", () => {
  beforeEach(() => {
    process.env.E2E_BYPASS_AUTH = "false";
    getSession.mockResolvedValue({ data: { session: null } });
    selectChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    upsertFn.mockResolvedValue({ error: null });
    select.mockClear();
    upsertFn.mockClear();
    from.mockClear();
  });

  it("returns stored settings with effective values", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { app_metadata: { is_admin: true } } } } });
    selectChain.maybeSingle.mockResolvedValue({
      data: { use_best_sellers: false, max_items: 200 },
      error: null
    });
    const { GET } = await import("@/app/api/admin/crawler-settings/route");
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.stored.use_best_sellers).toBe(false);
    expect(payload.effective.max_items).toBe(200);
  });

  it("forbids non-admin updates", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { app_metadata: {} } } } });
    const { POST } = await import("@/app/api/admin/crawler-settings/route");
    const request = new NextRequest("http://localhost/api/admin/crawler-settings", {
      method: "POST",
      body: JSON.stringify({ max_items: 300 })
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(upsertFn).not.toHaveBeenCalled();
  });

  it("allows admin updates", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { app_metadata: { is_admin: true } } } } });
    const { POST } = await import("@/app/api/admin/crawler-settings/route");
    const request = new NextRequest("http://localhost/api/admin/crawler-settings", {
      method: "POST",
      body: JSON.stringify({ max_items: 350 })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(upsertFn).toHaveBeenCalled();
  });
});
