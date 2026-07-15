import { ArrowRight, HeartPulse, PhoneCall, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";

export default function ReferralPage() {
  return (
    <AppShell title="Training pausiert" eyebrow="Sicherheitsprüfung">
      <section className="referral-hero">
        <HeartPulse />
        <h2>Tiermedizinische Abklärung empfohlen</h2>
        <p>
          Du hast mögliche Schmerzzeichen gemeldet. DogOS stellt keine Diagnose
          und startet bis zur Abklärung keine weitere Einheit.
        </p>
      </section>
      <section className="plain-section">
        <h2>Nächste Schritte</h2>
        <ol className="step-list">
          <li>
            <span>1</span>
            <div>
              <strong>Training pausieren</strong>
              <p>Keine neue Belastung oder schwierige Situation provozieren.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Beobachtungen notieren</strong>
              <p>Zeitpunkt, Bewegung und sichtbare Reaktion festhalten.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Tierarztpraxis kontaktieren</strong>
              <p>Die Dringlichkeit muss eine Fachperson beurteilen.</p>
            </div>
          </li>
        </ol>
      </section>
      <div className="emergency-note">
        <ShieldAlert />
        <span>
          <strong>Kein Notfalldienst</strong>Bei akuter Gefahr kontaktiere den
          lokalen tiermedizinischen Notdienst.
        </span>
      </div>
      <button className="button secondary wide">
        <PhoneCall size={18} /> Mock-Kontakt öffnen
      </button>
      <Link className="text-link" href="/app/trainers">
        Trainer-Unterstützung ansehen <ArrowRight size={16} />
      </Link>
    </AppShell>
  );
}
