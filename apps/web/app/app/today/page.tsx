import { Clock3, MessageCircle, Play, Target } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";

export default function TodayPage() {
  return (
    <AppShell title="Milo / Heute" eyebrow="Mittwoch, 15. Juli">
      <section className="today-focus">
        <div
          className="dog-photo"
          role="img"
          aria-label="Milo, gemischter Hund"
        >
          <span>M</span>
        </div>
        <div>
          <p>Aktiver Auftrag</p>
          <h2>Locker an der Leine</h2>
          <span>Block 01 · Orientierung</span>
        </div>
      </section>
      <section className="exercise">
        <div className="exercise-top">
          <span>TRAININGSBLOCK 01</span>
          <span>
            <Clock3 size={16} /> 4 Minuten
          </span>
        </div>
        <h2>Ruhig starten. Leine locker halten.</h2>
        <p className="exercise-brief">
          Nimm einen übersichtlichen Abschnitt. Warte auf lockere Leine, gehe an
          und bestätige jede freiwillige Orientierung zu dir. Wird die Leine
          straff, bleibst du ruhig stehen und setzt erst mit lockerer Leine
          fort.
        </p>
        <div className="brief-grid">
          <div>
            <Target />
            <span>
              <strong>Zielbild</strong>6 von 8 Abschnitten mit lockerer Leine
            </span>
          </div>
        </div>
        <div className="action-grid">
          <Link className="button primary" href="/app/session/session-1">
            <Play size={18} /> Starten
          </Link>
          <Link
            className="button secondary"
            href="/app/coach?context=today&prompt=Erkläre%20mir%20Milos%20heutigen%20Trainingsblock."
          >
            <MessageCircle size={18} /> Coach fragen
          </Link>
        </div>
      </section>
      <Link className="reactive-note" href="/app/coach?context=today">
        Etwas hat sich bei Milo verändert? Beobachtung im Coach festhalten.
      </Link>
    </AppShell>
  );
}
