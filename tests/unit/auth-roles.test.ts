import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { isAdminSession } from "@/lib/auth/roles";

function makeSession(
  appMeta: Record<string, unknown> | undefined = {},
  userMeta: Record<string, unknown> | undefined = {}
): Session {
  return {
    access_token: "token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh",
    user: {
      id: "user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "user@example.com",
      email_confirmed_at: "2024-01-01T00:00:00Z",
      phone: "",
      confirmation_sent_at: null,
      app_metadata: appMeta ?? {},
      user_metadata: userMeta ?? {},
      identities: [],
      created_at: "2024-01-01T00:00:00Z",
      last_sign_in_at: "2024-01-01T00:00:00Z",
      factors: [],
      phone_confirmed_at: null,
      confirmed_at: "2024-01-01T00:00:00Z",
      recovery_sent_at: null,
      banned_until: null
    }
  } as unknown as Session;
}

describe("isAdminSession", () => {
  it("returns true when the metadata flag is a boolean", () => {
    expect(isAdminSession(makeSession({ is_admin: true }))).toBe(true);
  });

  it("returns true when the metadata flag is a truthy string", () => {
    expect(isAdminSession(makeSession({ is_admin: "TRUE" }))).toBe(true);
    expect(isAdminSession(makeSession({}, { is_admin: "1" }))).toBe(true);
  });

  it("returns true when roles contain admin in any case", () => {
    expect(isAdminSession(makeSession({ roles: ["Admin", "editor"] }))).toBe(true);
    expect(isAdminSession(makeSession({ roles: "admin,viewer" }))).toBe(true);
  });

  it("returns true when the single role string matches admin", () => {
    expect(isAdminSession(makeSession({ role: "ADMIN" }))).toBe(true);
    expect(isAdminSession(makeSession({}, { role: "admin" }))).toBe(true);
  });

  it("returns false when admin metadata is absent", () => {
    expect(isAdminSession(makeSession())).toBe(false);
    expect(isAdminSession(makeSession({ roles: ["editor"] }))).toBe(false);
    expect(isAdminSession(makeSession({ is_admin: "false" }))).toBe(false);
  });
});
