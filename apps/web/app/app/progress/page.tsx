import {
  AlertCircle,
  ArrowRight,
  Database,
  Info,
  TrendingUp,
} from "lucide-react";
import { AppShell, DevelopmentNotice } from "../../../components/app-shell";

const metrics = [
  ["Zielerreichung", "6 / 10", 60],
  ["Konstanz", "2 Wochen", 68],
  ["Erfolgsrate", "76 %", 76],
  ["Schwierigkeit", "Stufe 1", 28],
  ["Engagement", "gut", 82],
  ["Erholung", "32 Sek.", 71],
  ["Ausführung", "stabil", 74],
  ["Datenqualität", "mittel", 62],
] as const;

export default function ProgressPage() {
  return (
    <AppShell title="Milos Fortschritt" eyebrow="Letzte 14 Tage">
      <DevelopmentNotice compact />
      <section className="decision-banner">
        <TrendingUp />
        <div>
          <span>Letzte Entscheidung</span>
          <strong>Stufe beibehalten</strong>
          <p>
            Noch eine vergleichbare Einheit fehlt für eine verlässliche
            Anpassung.
          </p>
        </div>
      </section>
      <section className="metrics">
        <div className="metrics-head">
          <h2>Messdimensionen</h2>
          <span>
            <Database size={15} /> 2 Einheiten
          </span>
        </div>
        {metrics.map(([label, value, width]) => (
          <div className="metric" key={label}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <div className="metric-track">
              <span style={{ width: `${width}%` }} />
            </div>
          </div>
        ))}
      </section>
      <section className="missing-data">
        <AlertCircle />
        <div>
          <strong>Noch nicht gemessen</strong>
          <p>
            Reaktionszeit und Triggerdistanz bleiben unbekannt. DogOS ergänzt
            keine fehlenden Werte.
          </p>
        </div>
      </section>
      <section className="plain-section">
        <h2>Beschreibende Beobachtung</h2>
        <p>In ruhiger Umgebung war die Erfolgsrate in 2 Einheiten höher.</p>
        <p className="caveat">
          <Info size={15} /> Kleines Sample. Zusammenhang bedeutet keine
          Ursache.
        </p>
      </section>
      <a className="text-link" href="/app/plan">
        Begründung im Plan ansehen <ArrowRight size={16} />
      </a>
    </AppShell>
  );
}
