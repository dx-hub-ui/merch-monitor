const BASE64_PREFIX = "base64-";
export const SUPABASE_COOKIE_NAME_PREFIX = "sb-";

type CookieSetter = {
  (name: string, value: string): unknown;
  (cookie: { name: string; value: string }): unknown;
};

export type NormalizableCookieStore = {
  getAll(): Array<{ name: string; value: string }>;
  set: CookieSetter;
};

function ensureBase64Padding(value: string) {
  const remainder = value.length % 4;
  if (remainder === 1) {
    throw new Error("Invalid base64 string length");
  }

  if (remainder > 0) {
    return value + "=".repeat(4 - remainder);
  }

  return value;
}

function toBase64(value: string) {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  return ensureBase64Padding(normalised);
}

function decodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf-8");
  }

  if (typeof atob === "function") {
    return atob(value);
  }

  throw new Error("No base64 decoder available in this environment");
}

export function decodeSupabaseCookieValue(value?: string | null) {
  if (!value) {
    return value ?? null;
  }

  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }

  try {
    const base64Value = value.slice(BASE64_PREFIX.length);
    const normalisedBase64 = toBase64(base64Value);
    const decoded = decodeBase64(normalisedBase64);

    try {
      JSON.parse(decoded);
      return decoded;
    } catch {
      return value;
    }
  } catch {
    return value;
  }
}

export function normalizeSupabaseCookies(cookieStore: NormalizableCookieStore) {
  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith(SUPABASE_COOKIE_NAME_PREFIX)) {
      continue;
    }

    const decoded = decodeSupabaseCookieValue(cookie.value);
    if (decoded !== cookie.value && decoded !== null && typeof decoded === "string") {
      cookieStore.set({ name: cookie.name, value: decoded });
    }
  }
}
