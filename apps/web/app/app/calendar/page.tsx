"use client";

import { CalendarPlus, Check, Moon } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { PlanTabs } from "../../../components/plan-tabs";
import { useProductDashboard } from "../../../lib/product";

export default function CalendarPage() {
  const { loading, product } = useProductDashboard();
  if (loading || product === null) {
    return (
      <AppShell
        title="Einsatzplan"
        eyebrow={loading ? "Wird geladen" : "Noch kein Plan"}
      />
    );
  }
  return (
    <AppShell title="Einsatzplan" eyebrow={product.dogName}>
      <PlanTabs active="calendar" />
      <section className="calendar-list">
        {product.calendar.map((item) => {
          const date = new Date(item.plannedStart);
          const complete = item.status === "completed";
          return (
            <a
              className={`calendar-item ${item.isRecovery ? "rest" : "training"} ${complete ? "completed" : ""}`}
              href={
                item.isRecovery ? "/app/progress" : `/app/session/${item.id}`
              }
              key={item.id}
            >
              <span className="calendar-date">
                <strong>{date.getDate()}</strong>
                {new Intl.DateTimeFormat("de-CH", { weekday: "short" }).format(
                  date,
                )}
              </span>
              <span className="calendar-icon">
                {complete ? (
                  <Check />
                ) : item.isRecovery ? (
                  <Moon />
                ) : (
                  <CalendarPlus />
                )}
              </span>
              <span className="calendar-copy">
                <strong>
                  {item.isRecovery ? "Beobachtungstag" : "Mikrotraining"}
                </strong>
                <small>
                  {complete
                    ? "Abgeschlossen"
                    : `${new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(date)} · ${Math.round(item.durationSeconds / 60)} Min.`}
                </small>
              </span>
            </a>
          );
        })}
      </section>
      <p className="helper">
        Trainingsblöcke und Erholungstage stammen aus der aktiven Planversion.
      </p>
    </AppShell>
  );
}
