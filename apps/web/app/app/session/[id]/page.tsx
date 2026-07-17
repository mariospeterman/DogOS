"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { SessionControls } from "../../../../components/session-controls";
import { useProductDashboard } from "../../../../lib/product";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const { loading, product } = useProductDashboard();
  const scheduled = product?.calendar.find((entry) => entry.id === params.id);
  if (loading || product === null || scheduled === undefined) {
    return (
      <AppShell
        title="Training"
        eyebrow={loading ? "Wird geladen" : "Einheit nicht verfügbar"}
      />
    );
  }
  const duration = Math.round(scheduled.durationSeconds / 60);
  const repetitions = product.currentStep?.repetitions ?? 8;
  return (
    <AppShell title="Mikrotraining" eyebrow={product.dogName}>
      <section className="session-instruction">
        <strong>Orientierung / lockere Leine</strong>
        <p>
          Beginne in einem ruhigen Abschnitt. Markiere {product.dogName}s
          freiwillige Orientierung und gehe weiter. Wird die Leine straff,
          bleibst du stehen und setzt erst bei lockerer Leine fort.
        </p>
        <span>
          {duration} Minuten · bis {repetitions} Abschnitte
        </span>
      </section>
      <SessionControls
        dogName={product.dogName}
        maxRepetitions={repetitions}
        scheduledSessionId={scheduled.id}
      />
    </AppShell>
  );
}
