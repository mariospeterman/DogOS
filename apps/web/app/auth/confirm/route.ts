import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNext(value: string | null): string {
  return value !== null && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/app/account";
}

export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.clone();
  redirect.pathname = safeNext(request.nextUrl.searchParams.get("next"));
  redirect.search = "";
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const result =
    code !== null
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash !== null && type !== null
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : { error: new Error("AUTH_CONFIRMATION_INVALID") };
  if (result.error === null) return NextResponse.redirect(redirect);
  redirect.pathname = "/auth/sign-in";
  redirect.searchParams.set("error", "confirmation");
  return NextResponse.redirect(redirect);
}
