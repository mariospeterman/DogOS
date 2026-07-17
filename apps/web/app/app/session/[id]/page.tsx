"use client";

import { useParams } from "next/navigation";
import { AppShell } from "../../../../components/app-shell";
import { SessionControls } from "../../../../components/session-controls";
import { useProductDashboard } from "../../../../lib/product";
import { trainingPresentation } from "../../../../lib/training-presentation";

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
  const presentation = trainingPresentation(product);
  return (
    <AppShell title="Mikrotraining" eyebrow={product.dogName}>
      <section className="session-instruction">
        <strong>{presentation.title}</strong>
        <p>{presentation.instruction(product.dogName)}</p>
        <span>
          {duration} Minuten · bis {repetitions} {presentation.unit}
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
