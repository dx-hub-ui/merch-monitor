import { cookies } from "next/headers";
import { createRouteHandlerClient, type CookieOptions } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./types";
import { decodeSupabaseCookieValue } from "./cookies";

export function createRouteSupabaseClient() {
  const cookieStore = cookies();
  return createRouteHandlerClient<Database>({
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
  });
}
