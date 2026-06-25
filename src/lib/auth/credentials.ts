import { verifyPassword } from "@/lib/auth/password";

/** Credenciales del Colegio San Lorenzo (local y Supabase). */
export const SAN_LORENZO_USERNAME = "SanLorenzo";
export const SAN_LORENZO_PASSWORD = "12456@SL";
export const SAN_LORENZO_EMAIL = "sanlorenzo@horariosl.app";
export const SAN_LORENZO_SCHOOL_NAME = "Colegio San Lorenzo";
export const SAN_LORENZO_LOGIN_ID = "sanlorenzo";

/** SHA-256(APP_SALT + SAN_LORENZO_PASSWORD) */
export const SAN_LORENZO_PASSWORD_HASH =
  "bb62dabf32f85c6844aee8b4b8c6b820d186dc1c2463fdbca05ede81a6eaae7b";

/** SHA-256(APP_SALT + "invitado") */
export const INVITADO_PASSWORD_HASH =
  "468a6f18a37a62cb25494274ed5c81473f48ef82149abd4ef702b31de8990f27";

/** Convierte el usuario del formulario al email de Supabase Auth. */
export function resolveSupabaseEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (
    normalized === SAN_LORENZO_USERNAME.toLowerCase() ||
    normalized === "sanlorenzo"
  ) {
    return SAN_LORENZO_EMAIL;
  }
  if (username.includes("@")) return username.trim();
  return username.trim();
}

export function isSanLorenzoUsername(username: string): boolean {
  return username.trim().toLowerCase() === SAN_LORENZO_USERNAME.toLowerCase();
}

export async function isSanLorenzoLogin(
  username: string,
  password: string
): Promise<boolean> {
  if (!isSanLorenzoUsername(username)) return false;
  return verifyPassword(password, SAN_LORENZO_PASSWORD_HASH);
}
