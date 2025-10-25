import { describe, expect, it } from "vitest";
import {
  decodeSupabaseCookieValue,
  normalizeSupabaseCookies,
  type NormalizableCookieStore
} from "@/lib/supabase/cookies";
import { isReadonlyCookieMutationError } from "@/lib/supabase/server";

describe("decodeSupabaseCookieValue", () => {
  it("returns null when value is undefined", () => {
    expect(decodeSupabaseCookieValue(undefined)).toBe(null);
  });

  it("returns the original value when no base64 prefix is present", () => {
    expect(decodeSupabaseCookieValue("plain-value")).toBe("plain-value");
  });

  it("decodes values prefixed with base64-", () => {
    const original = JSON.stringify({ hello: "world" });
    const encoded = `base64-${Buffer.from(original).toString("base64")}`;

    expect(decodeSupabaseCookieValue(encoded)).toBe(original);
  });

  it("decodes values using base64url characters", () => {
    const original = JSON.stringify({ token: "foo/bar+baz" });
    const base64 = Buffer.from(original).toString("base64");
    const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const encoded = `base64-${base64url}`;

    expect(decodeSupabaseCookieValue(encoded)).toBe(original);
  });

  it("falls back to the original value when decoding fails", () => {
    expect(decodeSupabaseCookieValue("base64-not-really")).toBe("base64-not-really");
  });

  it("normalizes Supabase cookies in a store", () => {
    const session = JSON.stringify({ exp: 123 });
    const encoded = `base64-${Buffer.from(session).toString("base64")}`;
    const store: Array<{ name: string; value: string }> = [
      { name: "sb-access-token", value: encoded },
      { name: "non-sb", value: "keep" }
    ];

    const cookieStore: NormalizableCookieStore = {
      getAll() {
        return store.map((cookie) => ({ ...cookie }));
      },
      set(nameOrCookie, maybeValue) {
        const name = typeof nameOrCookie === "string" ? nameOrCookie : nameOrCookie.name;
        const value = typeof nameOrCookie === "string" ? (maybeValue as string) : nameOrCookie.value;
        const existing = store.find((cookie) => cookie.name === name);
        if (existing) {
          existing.value = value;
        }
      }
    };

    normalizeSupabaseCookies(cookieStore);

    expect(store.find((cookie) => cookie.name === "sb-access-token")?.value).toBe(session);
    expect(store.find((cookie) => cookie.name === "non-sb")?.value).toBe("keep");
  });
});

describe("isReadonlyCookieMutationError", () => {
  it("identifies the Next.js read-only cookie error", () => {
    const error = new Error(
      "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#cookiessetname-value-options"
    );
    expect(isReadonlyCookieMutationError(error)).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isReadonlyCookieMutationError(new Error("Something went wrong"))).toBe(false);
  });

  it("checks nested causes", () => {
    const cause = new Error("Cookies can only be modified in a Server Action or Route Handler.");
    const error = new Error("Wrapper error", { cause });
    expect(isReadonlyCookieMutationError(error)).toBe(true);
  });
});
