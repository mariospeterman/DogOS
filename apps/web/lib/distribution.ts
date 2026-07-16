export function normalizeReferralCode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{6,32}$/.test(normalized) ? normalized : null;
}

export function buildWhatsAppStartUrl(
  baseUrl: string,
  input: { locale: "de-CH" | "en"; referralCode?: string | null },
): string {
  const url = new URL(baseUrl);
  const referralCode = normalizeReferralCode(input.referralCode ?? null);
  const message =
    input.locale === "de-CH"
      ? `DogOS starten${referralCode === null ? "" : ` · Einladung ${referralCode}`}`
      : `Start DogOS${referralCode === null ? "" : ` · Invite ${referralCode}`}`;
  url.searchParams.set("text", message);
  return url.toString();
}

export function buildShareUrl(origin: string): string {
  const url = new URL("/", origin);
  url.searchParams.set("source", "share");
  return url.toString();
}
