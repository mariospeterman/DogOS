import { createClient } from "./supabase/client";

export async function dogosApiHeaders(
  mutation = false,
): Promise<Record<string, string>> {
  const local = (process.env.NEXT_PUBLIC_DOGOS_ENV ?? "local") === "local";
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  try {
    const { data } = await createClient().auth.getSession();
    if (data.session?.access_token) {
      headers.authorization = `Bearer ${data.session.access_token}`;
    }
  } catch (error) {
    if (!local) throw error;
  }
  if (local) {
    headers["x-dogos-user"] =
      process.env.NEXT_PUBLIC_DOGOS_LOCAL_IDENTITY ?? "owner";
  }
  if (mutation) headers["idempotency-key"] = crypto.randomUUID();
  return headers;
}

export function dogosApiUrl(path: string): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  const local = (process.env.NEXT_PUBLIC_DOGOS_ENV ?? "local") === "local";
  const localApi =
    configured?.startsWith("http://127.0.0.1") === true ||
    configured?.startsWith("http://localhost") === true;
  const base = local && localApi ? "" : (configured ?? "");
  return `${base}${path}`;
}
