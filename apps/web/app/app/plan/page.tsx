"use client";

import { Info, MessageCircle, Target } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { PlanTabs } from "../../../components/plan-tabs";
import { useProductDashboard } from "../../../lib/product";

export default function PlanPage() {
  const { loading, product } = useProductDashboard();
  if (loading || product === null) {
    return (
      <AppShell
        title="Plan"
        eyebrow={loading ? "Wird geladen" : "Noch nicht bereit"}
      >
        {!loading ? (
          <p className="helper">
            Schliesse zuerst die Aufnahme in WhatsApp ab.
          </p>
        ) : null}
      </AppShell>
    );
  }
  const duration = Math.round((product.currentStep?.durationSeconds ?? 0) / 60);
  return (
    <AppShell
      title={`${product.dogName}s Plan`}
      eyebrow="Aktiver Trainingszyklus"
    >
      <PlanTabs active="plan" />
      <section className="plan-objective">
        <Target />
        <div>
          <span>Messbares Ziel</span>
          <strong>{product.goalText}</strong>
          <p>
            Ausgangslage {product.baselineSuccessRate}% · Ziel 80% in drei
            vergleichbaren Einheiten
          </p>
        </div>
      </section>
      <section className="plain-section">
        <h2>Aktuelle Stufe</h2>
        <p className="section-lede">
          {product.currentStep?.difficulty ?? 1} / Orientierung unter wenig
          Ablenkung
        </p>
        <small>
          {duration} Minuten · maximal {product.currentStep?.repetitions ?? 0}{" "}
          Abschnitte
        </small>
      </section>
      <section className="plain-section">
        <h2>Warum dieser Block?</h2>
        <p className="plan-copy">
          Die Ausgangslage stammt aus deinem Bericht. DogOS hält Umgebung und
          Aufgabe zunächst vergleichbar; erst wiederholte Sitzungsdaten
          verändern die Schwierigkeit.
        </p>
      </section>
      <section className="reason-panel">
        <Info />
        <div>
          <strong>Entscheidung: Schwierigkeit halten</strong>
          <p>
            {product.sessionCount === 0
              ? "Noch keine abgeschlossene Einheit liegt vor."
              : `${product.sessionCount} Einheiten liegen als Evidenz vor.`}
          </p>
          <span>Entwicklungsprotokoll · professionelle Prüfung ausstehend</span>
        </div>
      </section>
      <Link
        className="button secondary wide"
        href={`/app/coach?context=plan&prompt=${encodeURIComponent("Warum passt dieser Block jetzt?")}`}
      >
        <MessageCircle size={18} /> Plan mit Coach besprechen
      </Link>
    </AppShell>
  );
}
