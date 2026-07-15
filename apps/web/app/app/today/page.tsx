import { Clock3, Footprints, Play, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { AppShell, DevelopmentNotice } from "../../../components/app-shell";

export default function TodayPage() {
  return (
    <AppShell title="Heute mit Milo" eyebrow="Mittwoch, 15. Juli">
      <DevelopmentNotice compact />
      <section className="today-focus">
        <div
          className="dog-photo"
          role="img"
          aria-label="Milo, gemischter Hund"
        >
          <span>M</span>
        </div>
        <div>
          <p>Aktuelles Ziel</p>
          <h2>Locker an der Leine</h2>
          <span>Stufe 1 · ruhige Strasse</span>
        </div>
      </section>
      <section className="exercise">
        <div className="exercise-top">
          <span>HEUTIGE EINHEIT</span>
          <span>
            <Clock3 size={16} /> 4 Minuten
          </span>
        </div>
        <h2>Orientierung vor dem Losgehen</h2>
        <p>Belohne Milo, wenn er sich bei lockerer Leine zu dir orientiert.</p>
        <div className="detail-list">
          <div>
            <Target />
            <span>
              <strong>Zweck</strong>Ruhigen Kontakt aufbauen
            </span>
          </div>
          <div>
            <Footprints />
            <span>
              <strong>Aufbau</strong>Ruhiger Weg, Geschirr, kleine Belohnungen
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <strong>Stopp</strong>Futterverweigerung, Meiden, Schmerzzeichen
            </span>
          </div>
        </div>
        <p className="criterion">
          Erfolg: 6 von 8 Abschnitten mit lockerer Leine · maximal 8
          Wiederholungen
        </p>
        <Link className="button primary wide" href="/app/session/session-1">
          <Play size={18} /> Einheit starten
        </Link>
      </section>
      <Link className="text-link" href="/app/session/session-1">
        Bereits trainiert? Check-in abschliessen
      </Link>
    </AppShell>
  );
}
