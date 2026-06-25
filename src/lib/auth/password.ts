const APP_SALT = "horario-sl-v1";
const HASH_HEX_LENGTH = 64;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPasswordHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(APP_SALT + plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(plain);
  if (inputHash.length !== storedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < inputHash.length; i++) {
    mismatch |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

export { HASH_HEX_LENGTH };
