import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";

export default function TrainersPage() {
  return (
    <AppShell title="Fachperson finden" eyebrow="Geprüftes Netzwerk">
      <section className="referral-hero">
        <BadgeCheck />
        <h2>Empfehlungen erst nach Prüfung</h2>
        <p>
          DogOS zeigt hier nur Fachpersonen mit geprüften Angaben und passender
          Erfahrung für deinen Fall. Das Netzwerk ist in dieser
          Entwicklungsversion noch nicht freigeschaltet.
        </p>
      </section>

      <section className="plain-section">
        <h2>So entsteht eine Empfehlung</h2>
        <ol className="step-list">
          <li>
            <span>1</span>
            <div>
              <strong>Fachliche Passung</strong>
              <p>
                Schwerpunkt, Sicherheitskompetenz und belegte Qualifikation.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Praktische Passung</strong>
              <p>Region oder Video, Sprache, Verfügbarkeit und Preisrahmen.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Transparente Vermittlung</strong>
              <p>
                Eine mögliche Vergütung wird gekennzeichnet und beeinflusst die
                fachliche Rangfolge nicht.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <div className="emergency-note">
        <ShieldCheck />
        <span>
          <strong>Keine ungeprüften Profile</strong>
          Verfügbarkeit und Buchung werden erst angezeigt, wenn ein realer
          Partner angebunden ist.
        </span>
      </div>

      <Link className="button secondary wide" href="/app/coach">
        <CalendarClock size={18} /> Bedarf im Coach klären
      </Link>
      <Link className="text-link" href="/app/plan">
        Zurück zum Plan <ArrowRight size={16} />
      </Link>
    </AppShell>
  );
}
