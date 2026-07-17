"use client";

import {
  CreditCard,
  Globe2,
  LogOut,
  MessageCircle,
  Shield,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { BillingActions } from "../../../components/billing-actions";
import { DistributionActions } from "../../../components/distribution-actions";
import { createClient } from "../../../lib/supabase/client";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";

interface AccountView {
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
          <strong>{account?.tier ?? "..."}</strong>
        </div>
        <div>
          <span>
            <MessageCircle />
            Coaching
          </span>
          <strong>DogOS + WhatsApp</strong>
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
          <strong>Supabase Auth</strong>
        </div>
      </section>
      {account ? <BillingActions tier={account.tier} /> : null}
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
