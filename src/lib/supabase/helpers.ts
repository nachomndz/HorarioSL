export function getRelationName<T extends { name: string }>(
  value: T | T[] | null | undefined
): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name ?? "";
  return value.name ?? "";
}

export function getRelationObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
