export function normalizeReferralCode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{6,32}$/.test(normalized) ? normalized : null;
}

export function buildShareUrl(origin: string): string {
  const url = new URL("/", origin);
  url.searchParams.set("source", "share");
  return url.toString();
}
