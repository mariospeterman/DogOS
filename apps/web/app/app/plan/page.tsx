import { ChevronRight, Crosshair, Info, MessageCircle } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PlanTabs } from "../../../components/plan-tabs";

export default function PlanPage() {
  return (
    <AppShell title="Milos Plan" eyebrow="Aktiver Trainingszyklus">
      <PlanTabs active="plan" />
      <section className="plan-objective">
        <Crosshair />
        <div>
          <span>Auftrag</span>
          <strong>Lockere Leine auf ruhigen Alltagswegen</strong>
          <p>Von 6 auf 8 kontrollierte Abschnitte pro Einheit.</p>
        </div>
      </section>
      <section className="plain-section">
        <h2>Aktuelle Stufe</h2>
        <p className="section-lede">01 / Orientierung unter wenig Ablenkung</p>
        <div className="stage-track">
          <span className="done" />
          <span className="active" />
          <span />
          <span />
        </div>
        <small>Nächste Prüfung nach drei vergleichbaren Einheiten</small>
      </section>
      <section className="plain-section">
        <h2>Warum dieser Block?</h2>
        <p className="plan-copy">
          Milo arbeitet aktuell in ruhiger Umgebung stabiler als unter hoher
          Ablenkung. Dieser Block festigt zuerst Orientierung und
          Leinenkontrolle; Tempo und Ablenkung werden erst nach wiederholbarer
          Ausführung erhöht.
        </p>
        <div className="dog-factors">
          <span>Mischling</span>
          <span>Erwachsen</span>
          <span>Stadtumgebung</span>
        </div>
      </section>
      <section className="reason-panel">
        <Info />
        <div>
          <strong>Entscheidung: Schwierigkeit halten</strong>
          <p>
            Eine vergleichbare Einheit liegt vor. Einzelne gute Ergebnisse
            ändern den Block noch nicht; Milos gemessene Ausführung entscheidet.
          </p>
          <span>1 von 3 Einheiten als Evidenz</span>
        </div>
      </section>
      <section className="plain-section">
        <h2>Wochenrhythmus</h2>
        <div className="schedule-row">
          <span>Mo</span>
          <strong>Training</strong>
          <small>4 Min.</small>
          <ChevronRight />
        </div>
        <div className="schedule-row">
          <span>Di</span>
          <strong>Ruhetag</strong>
          <small>Beobachten</small>
          <ChevronRight />
        </div>
        <div className="schedule-row">
          <span>Mi</span>
          <strong>Training</strong>
          <small>4 Min.</small>
          <ChevronRight />
        </div>
      </section>
      <Link
        className="button secondary wide"
        href="/app/coach?context=plan&prompt=Erkläre%20mir%20warum%20dieser%20Block%20jetzt%20passt."
      >
        <MessageCircle size={18} /> Plan mit Coach besprechen
      </Link>
    </AppShell>
  );
}
