"use client";

import { Clock3, MessageCircle, Play, Target } from "lucide-react";
import Link from "next/link";
import { AppShell } from "../../../components/app-shell";
import { useProductDashboard } from "../../../lib/product";

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
          <p>{error ?? "Die kurze Aufnahme läuft direkt in WhatsApp."}</p>
          <a
            className="button primary"
            href={
              process.env.NEXT_PUBLIC_WHATSAPP_CHAT_URL ??
              "https://wa.me/15551617622"
            }
          >
            WhatsApp öffnen
          </a>
        </section>
      </AppShell>
    );
  }
  const duration = Math.round(
    (product.currentStep?.durationSeconds ?? 240) / 60,
  );
  const repetitions = product.currentStep?.repetitions ?? 8;
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
        <h2>Orientierung in einem ruhigen Abschnitt</h2>
        <p className="exercise-brief">
          Beginne mit lockerer Leine. Markiere den Moment, in dem sich{" "}
          {product.dogName} freiwillig an dir orientiert, und gehe weiter. Wird
          die Leine straff, bleibst du stehen und setzt erst bei lockerer Leine
          fort.
        </p>
        <div className="brief-grid">
          <div>
            <Target />
            <span>
              <strong>Messpunkt</strong>
              {repetitions} Abschnitte, Erfolg jeweils direkt erfassen
            </span>
          </div>
        </div>
        <div className="action-grid">
          <Link className="button primary" href={sessionHref}>
            <Play size={18} /> Starten
          </Link>
          <Link
            className="button secondary"
            href={`/app/coach?context=today&prompt=${encodeURIComponent(`Erkläre mir ${product.dogName}s heutigen Trainingsblock.`)}`}
          >
            <MessageCircle size={18} /> Coach fragen
          </Link>
        </div>
      </section>
      <Link className="reactive-note" href="/app/coach?context=today">
        Neue Beobachtung zu {product.dogName} im Coach festhalten
      </Link>
    </AppShell>
  );
}
