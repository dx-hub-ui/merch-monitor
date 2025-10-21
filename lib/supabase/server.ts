import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";

const BASE64_PREFIX = "base64-";

export function decodeSupabaseCookieValue(value?: string | null) {
  if (!value) {
    return value ?? null;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }

  try {
    const base64Value = value.slice(BASE64_PREFIX.length);
    const decoded = Buffer.from(base64Value, "base64").toString("utf-8");
    const normalized = Buffer.from(decoded, "utf-8").toString("base64").replace(/=+$/, "");
    const original = base64Value.replace(/=+$/, "");

    if (normalized !== original) {
      return value;
    }

    return decoded;
  } catch {
    return value;
  }
}

export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name)?.value;
          return decodeSupabaseCookieValue(cookie) ?? undefined;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        }
      }
    }
  );
}
