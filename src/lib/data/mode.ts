import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Usa almacenamiento local salvo que se fuerce Supabase y esté configurado. */
export function isLocalMode(): boolean {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase" && isSupabaseConfigured()) {
    return false;
  }
  return true;
}

export function hasLocalSessionCookie(cookieHeader: string | undefined): boolean {
  return cookieHeader?.includes("horario-sl-session=1") ?? false;
}
