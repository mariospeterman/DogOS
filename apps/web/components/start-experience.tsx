"use client";

import {
  ArrowRight,
  Bot,
  Check,
  LockKeyhole,
  MessageCircle,
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
          <p className="eyebrow">Chat-first Training</p>
          <h1>DogOS Training Chat</h1>
          <p>
            Der einfache Workspace für Onboarding, Plan, Training, Fortschritt,
            Video-Hinweise und Live Coaching.
          </p>
        </div>

        <div className="public-chat-window" aria-label="DogOS Vorschau">
          <div className="public-message assistant">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>
                Erzähl mir kurz von deinem Hund und was ihr verbessern wollt.
              </p>
            </div>
          </div>
          <div className="public-message user">
            <div className="message-bubble user">
              <p>Echo kommt draussen nicht zuverlässig zurück.</p>
            </div>
          </div>
          <div className="public-message assistant">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>
                Ich starte mit einem sicheren Rückruf-Plan, kurzen Einheiten und
                messbaren Fortschritten.
              </p>
            </div>
          </div>
          <div className="public-chat-card">
            <Bot size={17} />
            <span>
              <strong>Plan, Memory, Video und Live</strong>
              <small>
                Alles bleibt im Coach-Kontext statt in getrennten Tools.
              </small>
            </span>
          </div>
        </div>
      </section>

      <section className="public-prompt-panel">
        <div>
          <MessageCircle size={18} />
          <span>Starte mit dem ersten Satz über deinen Hund.</span>
        </div>
        <Link className="button primary" href={startUrl}>
          Gespräch starten
          <ArrowRight size={18} />
        </Link>
      </section>

      <section className="public-proof-row">
        <ul>
          <li>
            <Check size={16} /> Supabase Auth mit Referral-Erhalt
          </li>
          <li>
            <Check size={16} /> Chat UI mit Training Cards
          </li>
          <li>
            <LockKeyhole size={16} /> Keine Diagnose oder Notfallhilfe
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
