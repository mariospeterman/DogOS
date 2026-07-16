import {
  AlertCircle,
  ArrowRight,
  Database,
  Info,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "../../../components/app-shell";

const metrics = [
  ["Lockere Abschnitte", "6 / 8", 75],
  ["Konstante Ausführung", "2 Einheiten", 50],
  ["Datenabdeckung", "mittel", 62],
] as const;

export default function ProgressPage() {
  return (
    <AppShell title="Milos Entwicklung" eyebrow="Letzte 14 Tage">
      <section className="decision-banner">
        <TrendingUp />
        <div>
          <span>Aktuelle Entscheidung</span>
          <strong>Block 01 halten</strong>
          <p>
            Noch eine vergleichbare Einheit fehlt. Danach prüft DogOS den
            nächsten Ablenkungsgrad.
          </p>
        </div>
      </section>
      <section className="metrics">
        <div className="metrics-head">
          <h2>Kernsignale</h2>
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
      <section className="missing-data compact-evidence">
        <AlertCircle />
        <div>
          <strong>Offene Evidenz</strong>
          <p>
            Reaktionszeit und Distanz wurden nicht erfasst. Sie bleiben offen,
            statt geschätzt zu werden.
          </p>
        </div>
      </section>
      <section className="plain-section">
        <h2>Beobachtung</h2>
        <p>In ruhiger Umgebung war die Erfolgsrate in 2 Einheiten höher.</p>
        <p className="caveat">
          <Info size={15} /> Zwei Einheiten zeigen eine Tendenz, noch keinen
          belastbaren Zusammenhang.
        </p>
      </section>
      <a className="text-link" href="/app/plan">
        Begründung im Plan ansehen <ArrowRight size={16} />
      </a>
    </AppShell>
  );
}
