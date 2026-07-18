import {
  ArrowRight,
  HeartPulse,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../../components/app-shell";
import { coachHref } from "../../../../lib/coach";

export default function ReferralPage() {
  return (
    <AppShell title="Fachliche Abklärung" eyebrow="Hinweis zum gemeldeten Fall">
      <section className="referral-hero">
        <HeartPulse />
        <h2>Beobachtung professionell einordnen lassen</h2>
        <p>
          Die gemeldeten Anzeichen können hier nicht diagnostiziert werden. Lass
          die betroffene Belastung aus und kläre die weitere Durchführung mit
          einer tiermedizinischen Fachperson.
        </p>
      </section>
      <section className="plain-section">
        <h2>Für die Abklärung</h2>
        <ol className="step-list">
          <li>
            <span>1</span>
            <div>
              <strong>Situation nicht wiederholen</strong>
              <p>Vermeide vorerst genau die Bewegung oder Belastung.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Beobachtung festhalten</strong>
              <p>Zeitpunkt, Bewegung und sichtbare Reaktion reichen aus.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Fachperson kontaktieren</strong>
              <p>Nur sie kann Ursache und Dringlichkeit beurteilen.</p>
            </div>
          </li>
        </ol>
      </section>
      <div className="emergency-note">
        <ShieldAlert />
        <span>
          <strong>Kein Notfalldienst</strong>
          Bei akuter Gefahr nutze den lokalen tiermedizinischen Notdienst.
        </span>
      </div>
      <Link
        className="button secondary wide"
        href={coachHref(
          "Ich möchte eine Beobachtung für die professionelle Einordnung ergänzen.",
        )}
      >
        <MessageCircle size={18} /> Beobachtung im Coach ergänzen
      </Link>
      <Link className="text-link" href="/app/trainers">
        Fachnetzwerk ansehen <ArrowRight size={16} />
      </Link>
    </AppShell>
  );
}
