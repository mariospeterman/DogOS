"use client";

import {
  AlertCircle,
  Database,
  Info,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { useProductDashboard } from "../../../lib/product";
import { coachHref } from "../../../lib/coach";

export default function ProgressPage() {
  const { loading, product } = useProductDashboard();
  if (loading || product === null) {
    return (
      <AppShell
        title="Fortschritt"
        eyebrow={loading ? "Wird geladen" : "Noch keine Daten"}
      />
    );
  }
  const evidence = product.sessionCount;
  return (
    <AppShell
      title={`${product.dogName}s Entwicklung`}
      eyebrow="Aktiver Zyklus"
    >
      <section className="decision-banner">
        <TrendingUp />
        <div>
          <span>Aktuelle Entscheidung</span>
          <strong>Stufe halten</strong>
          <p>
            {evidence < 3
              ? `${3 - evidence} vergleichbare Einheiten fehlen für die nächste Prüfung.`
              : "Die nächste Anpassung wird aus den erfassten Messwerten berechnet."}
          </p>
        </div>
      </section>
      <section className="metrics">
        <div className="metrics-head">
          <h2>Evidenz</h2>
          <span>
            <Database size={15} /> {evidence} Einheiten
          </span>
        </div>
        <div className="metric">
          <div>
            <span>Berichtete Ausgangslage</span>
            <strong>{product.baselineSuccessRate}%</strong>
          </div>
          <div className="metric-track">
            <span style={{ width: `${product.baselineSuccessRate}%` }} />
          </div>
        </div>
      </section>
      {evidence === 0 ? (
        <section className="missing-data compact-evidence">
          <AlertCircle />
          <div>
            <strong>Noch keine Sitzungsmessung</strong>
            <p>Werte bleiben offen, bis du den ersten Block abschliesst.</p>
          </div>
        </section>
      ) : null}
      <p className="caveat">
        <Info size={15} /> Beobachtete Zusammenhänge sind beschreibend und keine
        Ursache-Wirkungs-Aussage.
      </p>
      <Link
        className="button secondary wide"
        href={coachHref(
          "Fasse den Fortschritt zusammen und erkläre die nächste Entscheidung.",
        )}
      >
        <MessageCircle size={18} /> Fortschritt besprechen
      </Link>
    </AppShell>
  );
}
