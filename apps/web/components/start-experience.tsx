"use client";

import {
  ArrowRight,
  Check,
  LockKeyhole,
  MessageCircle,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { normalizeReferralCode } from "../lib/distribution";
import { DistributionActions } from "./distribution-actions";

export function StartExperience() {
  const params = useSearchParams();
  const referralCode = normalizeReferralCode(params.get("ref"));
  const startUrl = `/auth/sign-up?next=${encodeURIComponent("/app/coach")}${
    referralCode === null ? "" : `&ref=${encodeURIComponent(referralCode)}`
  }`;

  return (
    <main className="public-chat-shell">
      <header className="public-chat-header">
        <Link href="/" className="chat-wordmark" aria-label="DogOS">
          <span className="coach-mark">D</span>
          <strong>DogOS</strong>
        </Link>
        <nav>
          <Link href="/auth/sign-in">Anmelden</Link>
          <Link className="button secondary" href={startUrl}>
            Starten
          </Link>
        </nav>
      </header>

      <section className="public-chat-main">
        <div className="public-chat-copy">
          <p className="eyebrow">DogOS Coach</p>
          <h1>Ein Trainingscoach, der deinen Hund wirklich kennt.</h1>
          <p>
            DogOS merkt sich jede Einheit, passt euren Plan an den Fortschritt
            an und wertet Trainingsvideos im Kontext aus.
          </p>
        </div>

        <div className="public-chat-window" aria-label="DogOS Vorschau">
          <div className="public-message assistant">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>Wann klappt Echos Rückruf nicht zuverlässig?</p>
            </div>
          </div>
          <div className="public-message user">
            <div className="message-bubble user">
              <p>Echo kommt gut zurück, bis ein anderer Hund auftaucht.</p>
            </div>
          </div>
          <div className="public-message assistant">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>Bei welcher Entfernung reagiert Echo ungefähr nicht mehr?</p>
            </div>
          </div>
          <div className="public-chat-card">
            <Target size={17} />
            <span>
              <strong>Zuverlässiger Rückruf bei Hundebegegnungen</strong>
              <small>Basis: etwa 12 m · Ziel: 7 m · 4 von 5 Rückrufen</small>
            </span>
          </div>
        </div>
      </section>

      <section className="public-prompt-panel">
        <div>
          <MessageCircle size={18} />
          <span>Erzähl DogOS vom ersten echten Trainingsziel.</span>
        </div>
        <Link className="button primary" href={startUrl}>
          Gespräch starten
          <ArrowRight size={18} />
        </Link>
      </section>

      <section className="public-proof-row">
        <ul>
          <li>
            <Check size={16} /> Persönlicher Plan, der sich anpasst
          </li>
          <li>
            <Check size={16} /> Trainingsvideo-Feedback im Kontext
          </li>
          <li>
            <LockKeyhole size={16} /> Private Erinnerung, die du kontrollierst
          </li>
        </ul>
      </section>

      <section className="start-return compact-public">
        <div>
          <strong>DogOS auf diesem Gerät</strong>
          <span>Installieren, teilen oder direkt zurück zum Coach.</span>
        </div>
        <DistributionActions compact />
      </section>
    </main>
  );
}
