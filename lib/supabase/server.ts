import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";
import { decodeSupabaseCookieValue } from "./cookies";

const READONLY_MUTATION_MESSAGE = "Cookies can only be modified in a Server Action or Route Handler";

export function isReadonlyCookieMutationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (typeof error.message === "string" && error.message.includes(READONLY_MUTATION_MESSAGE)) {
    return true;
  }

  const cause = error.cause;
  if (cause instanceof Error && typeof cause.message === "string") {
    return cause.message.includes(READONLY_MUTATION_MESSAGE);
  }

  return false;
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
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            if (!isReadonlyCookieMutationError(error)) {
              throw error;
            }
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            if (!isReadonlyCookieMutationError(error)) {
              throw error;
            }
          }
        }
      }
    }
  );
}
