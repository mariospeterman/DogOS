const defaultWhatsAppUrl = "https://wa.me/15551617622";

export function whatsappCoachUrl(message?: string): string {
  const configured =
    process.env.NEXT_PUBLIC_WHATSAPP_CHAT_URL ?? defaultWhatsAppUrl;
  if (message === undefined || message.trim().length === 0) return configured;

  const url = new URL(configured);
  url.searchParams.set("text", message.trim());
  return url.toString();
}
