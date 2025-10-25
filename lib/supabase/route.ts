import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./types";
import { normalizeSupabaseCookies } from "./cookies";

export function createRouteSupabaseClient() {
  return createRouteHandlerClient<Database>({
    cookies() {
      const cookieStore = cookies();
      normalizeSupabaseCookies(cookieStore);
      return cookieStore;
    }
  });
}
