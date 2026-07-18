"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../../lib/api-client";

export default function PrivacyPage() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AppShell title="Privacy" eyebrow="Export und Löschung">
      <section className="auth-form">
        <button
          className="button secondary wide"
          onClick={async () => {
            const response = await fetch(dogosApiUrl("/v1/privacy/export"), {
              headers: await dogosApiHeaders(),
            });
            if (response.ok) {
              const blob = new Blob(
                [JSON.stringify(await response.json(), null, 2)],
                {
                  type: "application/json",
                },
              );
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "dogos-privacy-export.json";
              anchor.click();
              URL.revokeObjectURL(url);
            }
            setMessage(
              response.ok ? "Export erstellt." : "Export fehlgeschlagen.",
            );
          }}
        >
          <Download size={18} /> Export
        </button>
        <button
          className="button danger wide"
          onClick={async () => {
            const response = await fetch(
              dogosApiUrl("/v1/privacy/deletion-requests"),
              {
                body: JSON.stringify({ reason: "Owner requested deletion" }),
                headers: await dogosApiHeaders(true),
                method: "POST",
              },
            );
            setMessage(
              response.ok
                ? "Löschanfrage gespeichert."
                : "Löschanfrage fehlgeschlagen.",
            );
          }}
        >
          <Trash2 size={18} /> Löschanfrage
        </button>
      </section>
      {message === null ? null : <p className="helper">{message}</p>}
    </AppShell>
  );
}
