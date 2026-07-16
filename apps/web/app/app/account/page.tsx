"use client";

import {
  CreditCard,
  Globe2,
  LogOut,
  MessageCircle,
  Shield,
  UserRound,
} from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { DistributionActions } from "../../../components/distribution-actions";
import { createClient } from "../../../lib/supabase/client";

export default function AccountPage() {
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
          <strong>Freemium · Pilot</strong>
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
        Antworte DogOS einfach in deiner Sprache. Zeitzone Europe/Zurich, Land,
        Währung und frühere Antworten bleiben davon unberührt.
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
