import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";

export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_SETUP_HINT);
  }

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignore
        }
      },
    },
  });
}

export async function createServiceClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, serviceRoleKey } = getSupabaseEnv();

  if (!url || !serviceRoleKey || serviceRoleKey === "your-service-role-key") {
    throw new Error(
      "Configura SUPABASE_SERVICE_ROLE_KEY en .env.local para invitar administradores"
    );
  }

  return createClient(url, serviceRoleKey);
}
