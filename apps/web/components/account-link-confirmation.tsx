"use client";

import { Link2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AppShell, DevelopmentNotice } from "./app-shell";

export function AccountLinkConfirmation({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "linked" | "error">(
    "idle",
  );
  async function confirm() {
    setStatus("working");
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000"}/v1/whatsapp/link/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dogos-user": "owner",
        },
        body: JSON.stringify({ token }),
      },
    );
    setStatus(response.ok ? "linked" : "error");
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
          <strong>Familie Keller</strong>
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
          Der Link ist ungültig, abgelaufen oder bereits verwendet.
        </p>
      ) : null}
    </AppShell>
  );
}
