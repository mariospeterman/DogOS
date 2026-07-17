"use client";

import { Link2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { AppShell, DevelopmentNotice } from "./app-shell";

export function AccountLinkConfirmation({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "linked" | "error">(
    "idle",
  );
  const [householdName, setHouseholdName] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const session = (await createClient().auth.getSession()).data.session;
        if (session === null) return;
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000"}/v1/me`,
          { headers: { authorization: `Bearer ${session.access_token}` } },
        );
        if (response.ok) {
          const account = (await response.json()) as { householdName?: string };
          setHouseholdName(account.householdName ?? null);
        }
      } catch {
        // Confirmation still reports a precise error after the user submits.
      }
    })();
  }, []);
  async function confirm() {
    setStatus("working");
    try {
      const browserAuthConfigured =
        process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined &&
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined;
      const accessToken = browserAuthConfigured
        ? (await createClient().auth.getSession()).data.session?.access_token
        : undefined;
      const localMode =
        (process.env.NEXT_PUBLIC_DOGOS_ENV ?? "local") === "local";
      if (accessToken === undefined && !localMode) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(
          `/auth/sign-in?next=${encodeURIComponent(next)}`,
        );
        return;
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000"}/v1/whatsapp/link/confirm`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(accessToken === undefined
              ? { "x-dogos-user": "owner" }
              : { authorization: `Bearer ${accessToken}` }),
          },
          body: JSON.stringify({ token }),
        },
      );
      setStatus(response.ok ? "linked" : "error");
    } catch {
      setStatus("error");
    }
  }
  return (
    <AppShell title="WhatsApp verbinden" eyebrow="Sichere Kontoverknüpfung">
      <DevelopmentNotice compact />
      <section className="settings">
        <div>
          <span>
            <ShieldCheck />
            Bestätigte Anmeldung
          </span>
          <strong>{householdName ?? "Angemeldetes DogOS Konto"}</strong>
        </div>
        <p className="helper">
          WhatsApp erhält erst nach dieser Bestätigung Zugriff auf Hund, Plan
          und Fortschritt.
        </p>
      </section>
      {status === "linked" ? (
        <p className="success-note">
          WhatsApp ist verbunden. Du kannst zum Chat zurückkehren.
        </p>
      ) : (
        <button
          className="button primary"
          disabled={token.length < 20 || status === "working"}
          onClick={confirm}
        >
          <Link2 size={18} />{" "}
          {status === "working" ? "Wird verbunden…" : "Verbindung bestätigen"}
        </button>
      )}
      {status === "error" ? (
        <p className="error-note">
          Die Verbindung war nicht möglich. Öffne den neuesten Link aus WhatsApp
          und versuche es erneut.
        </p>
      ) : null}
    </AppShell>
  );
}
