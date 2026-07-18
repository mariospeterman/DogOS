"use client";

import { Clock3, MessageCircle, Play, Radio, Target } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { useProductDashboard } from "../../../lib/product";
import { trainingPresentation } from "../../../lib/training-presentation";
import { coachHref } from "../../../lib/coach";

export default function TodayPage() {
  const { error, loading, product } = useProductDashboard();
  if (loading) {
    return <AppShell title="Heute" eyebrow="Training wird geladen" />;
  }
  if (product === null) {
    return (
      <AppShell title="Heute" eyebrow="Noch kein aktiver Plan">
        <section className="success-panel">
          <strong>Erzähl DogOS zuerst von deinem Hund</strong>
          <p>{error ?? "Die kurze Aufnahme beginnt direkt im DogOS Coach."}</p>
          <Link className="button primary" href="/app/coach">
            Gespräch starten
          </Link>
        </section>
      </AppShell>
    );
  }
  const duration = Math.round(
    (product.currentStep?.durationSeconds ?? 240) / 60,
  );
  const repetitions = product.currentStep?.repetitions ?? 8;
  const presentation = trainingPresentation(product);
  const sessionHref = product.todaySessionId
    ? `/app/session/${product.todaySessionId}`
    : "/app/plan";
  return (
    <AppShell
      title={`${product.dogName} / Heute`}
      eyebrow={new Intl.DateTimeFormat("de-CH", {
        dateStyle: "full",
      }).format(new Date())}
    >
      <section className="today-focus">
        <div className="dog-photo" role="img" aria-label={product.dogName}>
          <span>{product.dogName[0]?.toUpperCase()}</span>
        </div>
        <div>
          <p>Aktives Ziel</p>
          <h2>{product.goalText}</h2>
          <span>Stufe {product.currentStep?.difficulty ?? 1}</span>
        </div>
      </section>
      <section className="exercise">
        <div className="exercise-top">
          <span>MIKROBLOCK</span>
          <span>
            <Clock3 size={16} /> {duration} Minuten
          </span>
        </div>
        <h2>{presentation.title}</h2>
        <p className="exercise-brief">
          {presentation.instruction(product.dogName)}
        </p>
        <div className="brief-grid">
          <div>
            <Target />
            <span>
              <strong>Messpunkt</strong>
              {presentation.measurement(repetitions)}
            </span>
          </div>
        </div>
        <div className="action-grid">
          <Link className="button primary" href={sessionHref}>
            <Play size={18} /> Starten
          </Link>
          <Link
            className="button secondary"
            href={coachHref("Erkläre mir den heutigen Trainingsblock.")}
          >
            <MessageCircle size={18} /> Coach fragen
          </Link>
          <Link className="button secondary" href="/app/live">
            <Radio size={18} /> Live
          </Link>
        </div>
      </section>
      <Link
        className="reactive-note"
        href={coachHref("Ich möchte eine neue Beobachtung festhalten.")}
      >
        Neue Beobachtung zu {product.dogName} im Coach festhalten
      </Link>
    </AppShell>
  );
}
