import { AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { AppShell, DevelopmentNotice } from "../../../components/app-shell";

export default function PlanPage() {
  return (
    <AppShell title="Milos Trainingsplan" eyebrow="Ziel · lockere Leine">
      <DevelopmentNotice />
      <section className="goal-band">
        <div>
          <span>Ausgangswert</span>
          <strong>6 / 10</strong>
        </div>
        <div className="goal-arrow">→</div>
        <div>
          <span>Ziel</span>
          <strong>8 / 10</strong>
        </div>
      </section>
      <section className="plain-section">
        <h2>Aktuelle Stufe</h2>
        <p className="section-lede">Orientierung in ruhiger Umgebung</p>
        <div className="stage-track">
          <span className="done" />
          <span className="active" />
          <span />
          <span />
        </div>
        <small>Stufe 1 von 3 · drei Einheiten vor der nächsten Prüfung</small>
      </section>
      <section className="plain-section">
        <h2>Voraussetzungen</h2>
        <ul className="check-list">
          <li>
            <CheckCircle2 />
            Gut sitzendes Geschirr
          </li>
          <li>
            <CheckCircle2 />
            Futter wird angenommen
          </li>
          <li>
            <CheckCircle2 />
            Ruhige Trainingsstrecke
          </li>
        </ul>
      </section>
      <section className="reason-panel">
        <Info />
        <div>
          <strong>Warum bleibt die Schwierigkeit gleich?</strong>
          <p>
            Eine Einheit ist vorhanden. Für eine Erhöhung braucht Milo drei
            aufeinanderfolgende Einheiten mit mindestens 80 % Erfolg.
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
      <p className="legal-line">
        <AlertTriangle size={16} /> Entwicklungsvorschlag, keine medizinische
        Diagnose.
      </p>
    </AppShell>
  );
}
