import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_SETUP_HINT);
  }

  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

export function tryCreateClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
