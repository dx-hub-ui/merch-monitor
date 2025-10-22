const BASE64_PREFIX = "base64-";

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

function toCanonicalBase64(value: string) {
  return toBase64(value).replace(/=+$/, "");
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

function encodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf-8").toString("base64");
  }

  if (typeof btoa === "function") {
    return btoa(value);
  }

  throw new Error("No base64 encoder available in this environment");
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
    const normalized = toCanonicalBase64(encodeBase64(decoded));
    const original = toCanonicalBase64(base64Value);

    if (normalized !== original) {
      return value;
    }

    return decoded;
  } catch {
    return value;
  }
}
