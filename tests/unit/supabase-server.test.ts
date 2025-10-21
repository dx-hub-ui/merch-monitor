import { describe, expect, it } from "vitest";
import { decodeSupabaseCookieValue } from "@/lib/supabase/server";

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
