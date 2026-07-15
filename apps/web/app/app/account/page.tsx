"use client";

import { Globe2, LogOut, Shield, UserRound } from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";

export default function AccountPage() {
  const [locale, setLocale] = useState("de-CH");
  return (
    <AppShell title="Konto" eyebrow="Lokale Testidentität">
      <section className="account-person">
        <div>MK</div>
        <span>
          <strong>Maria Keller</strong>
          <small>Eigentümerin · Familie Keller</small>
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
          <strong>Lokale Demo</strong>
        </div>
      </section>
      <p className="helper">
        Zeitzone Europe/Zurich. Ein Sprachwechsel verändert weder Land, Währung
        noch frühere Antworten.
      </p>
      <button className="button danger">
        <LogOut size={18} /> Lokale Sitzung beenden
      </button>
    </AppShell>
  );
}
