const BASE64_PREFIX = "base64-";

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
    const decoded = decodeBase64(base64Value);
    const normalized = encodeBase64(decoded).replace(/=+$/, "");
    const original = base64Value.replace(/=+$/, "");

    if (normalized !== original) {
      return value;
    }

    return decoded;
  } catch {
    return value;
  }
}
