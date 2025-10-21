import { describe, expect, it } from "vitest";
import { decodeSupabaseCookieValue } from "@/lib/supabase/cookies";
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

  it("falls back to the original value when decoding fails", () => {
    expect(decodeSupabaseCookieValue("base64-not-really")).toBe("base64-not-really");
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
