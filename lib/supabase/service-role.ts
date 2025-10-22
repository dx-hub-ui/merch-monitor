import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceRoleClient(): SupabaseClient<Database, "public"> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Service role credentials are not configured");
  }

  return createClient<Database, "public">(supabaseUrl, serviceKey, { global: { fetch } });
}
