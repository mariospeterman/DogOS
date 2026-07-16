"use client";

import {
  CreditCard,
  Globe2,
  LogOut,
  MessageCircle,
  Shield,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { DistributionActions } from "../../../components/distribution-actions";
import { createClient } from "../../../lib/supabase/client";

export default function AccountPage() {
  const [locale, setLocale] = useState("de-CH");
  return (
    <AppShell title="Konto" eyebrow="Profil und Zugriff">
      <section className="account-person">
        <div>MK</div>
        <span>
          <strong>Maria Keller</strong>
          <small>Owner · Familie Keller</small>
        </span>
      </section>
      <section className="settings">
        <label>
          <span>
            <Globe2 />
            Sprache<small>Ändert nur künftige Darstellung</small>
          </span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="de-CH">Deutsch (Schweiz)</option>
            <option value="en">English</option>
          </select>
        </label>
        <div>
          <span>
            <CreditCard />
            Tarif
          </span>
          <strong>Freemium · Pilot</strong>
        </div>
        <div>
          <span>
            <MessageCircle />
            Coaching
          </span>
          <strong>WhatsApp verbunden</strong>
        </div>
        <div>
          <span>
            <UserRound />
            Land und Währung
          </span>
          <strong>Schweiz · CHF</strong>
        </div>
        <div>
          <span>
            <Shield />
            Datenschutz
          </span>
          <strong>Supabase Auth</strong>
        </div>
      </section>
      <p className="helper">
        Zeitzone Europe/Zurich. Ein Sprachwechsel verändert weder Land, Währung
        noch frühere Antworten.
      </p>
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
