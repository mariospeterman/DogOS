"use client";

import {
  CreditCard,
  Globe2,
  History,
  LogOut,
  MessageCircle,
  Shield,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { BillingActions } from "../../../components/billing-actions";
import { DistributionActions } from "../../../components/distribution-actions";
import { createClient } from "../../../lib/supabase/client";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";

interface AccountView {
  billingAvailable: boolean;
  country: string;
  currency: string;
  displayName: string | null;
  householdName: string;
  role: string;
  tier: string;
  timezone: string;
}

export default function AccountPage() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [error, setError] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const response = await fetch(dogosApiUrl("/v1/me"), {
        headers: await dogosApiHeaders(),
      });
      if (response.status === 401) {
        window.location.assign("/auth/sign-in?next=/app/account");
        return;
      }
      if (!response.ok) {
        setError(true);
        return;
      }
      setAccount((await response.json()) as AccountView);
    })();
  }, []);
  const name = account?.displayName ?? "DogOS Owner";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <AppShell title="Konto" eyebrow="Profil und Zugriff">
      <section className="account-person">
        <div>{initials}</div>
        <span>
          <strong>{account === null ? "Konto wird geladen..." : name}</strong>
          <small>
            {account === null
              ? ""
              : `${account.role} · ${account.householdName}`}
          </small>
        </span>
      </section>
      <section className="settings">
        <div>
          <span>
            <Globe2 />
            Sprache<small>Wird aus der Unterhaltung erkannt</small>
          </span>
          <strong>Automatisch</strong>
        </div>
        <div>
          <span>
            <CreditCard />
            Tarif
          </span>
          <Link className="button secondary" href="/app/account/billing">
            {account?.tier ?? "..."}
          </Link>
        </div>
        <div>
          <span>
            <MessageCircle />
            Coaching
          </span>
          <strong>DogOS App</strong>
        </div>
        <div>
          <span>
            <UserRound />
            Land und Währung
          </span>
          <strong>
            {account === null
              ? "..."
              : `${account.country} · ${account.currency}`}
          </strong>
        </div>
        <div>
          <span>
            <Shield />
            Datenschutz
          </span>
          <Link className="button secondary" href="/app/account/privacy">
            Öffnen
          </Link>
        </div>
        <div>
          <span>
            <History />
            Memory und Verlauf
            <small>
              Gespeicherte Fakten prüfen, korrigieren oder vergessen.
            </small>
          </span>
          <Link className="button secondary" href="/app/account/memory">
            Memory
          </Link>
        </div>
      </section>
      {account?.billingAvailable ? (
        <BillingActions tier={account.tier} />
      ) : null}
      <p className="helper">
        Antworte DogOS einfach in deiner Sprache. Zeitzone{" "}
        {account?.timezone ?? "..."}, Land, Währung und frühere Antworten
        bleiben davon unberührt.
      </p>
      {error ? (
        <p className="error-note">Kontodaten konnten nicht geladen werden.</p>
      ) : null}
      <section className="account-distribution">
        <div>
          <strong>Datenschutz</strong>
          <span>Exportiere deine Daten oder stelle eine Löschanfrage.</span>
        </div>
        <div className="distribution-actions compact">
          <button
            className="button secondary"
            onClick={async () => {
              const response = await fetch(dogosApiUrl("/v1/privacy/export"), {
                headers: await dogosApiHeaders(),
              });
              if (response.ok) {
                const blob = new Blob(
                  [JSON.stringify(await response.json(), null, 2)],
                  { type: "application/json" },
                );
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "dogos-privacy-export.json";
                anchor.click();
                URL.revokeObjectURL(url);
              }
              setPrivacyMessage(
                response.ok
                  ? "Export wurde erzeugt und im Browser geladen."
                  : "Export konnte nicht erzeugt werden.",
              );
            }}
          >
            Export
          </button>
          <button
            className="button danger"
            onClick={async () => {
              const response = await fetch(
                dogosApiUrl("/v1/privacy/deletion-requests"),
                {
                  body: JSON.stringify({ reason: "Owner requested deletion" }),
                  headers: await dogosApiHeaders(true),
                  method: "POST",
                },
              );
              setPrivacyMessage(
                response.ok
                  ? "Löschanfrage wurde gespeichert."
                  : "Löschanfrage konnte nicht erstellt werden.",
              );
            }}
          >
            Löschen
          </button>
        </div>
      </section>
      {privacyMessage === null ? null : (
        <p className="helper">{privacyMessage}</p>
      )}
      <section className="account-distribution">
        <div>
          <strong>DogOS mitnehmen</strong>
          <span>Installiere die App oder teile den sicheren Startlink.</span>
        </div>
        <DistributionActions />
      </section>
      <button
        className="button danger"
        onClick={async () => {
          await createClient().auth.signOut();
          window.location.assign("/auth/sign-in");
        }}
      >
        <LogOut size={18} /> Abmelden
      </button>
    </AppShell>
  );
}
