"use client";

import { CalendarDays, CheckCircle2, CircleDot, Route } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { AppShell } from "../../../components/app-shell";
import { DogOSLoader } from "../../../components/dogos-loader";
import { useProductDashboard } from "../../../lib/product";

function pct(value: number | undefined, fallback = 0) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

export default function PlanPage() {
  const { error, loading, product } = useProductDashboard();
  const baseline = pct(product?.baselineSuccessRate);
  const target = pct(product?.targetSuccessRate, 80);
  const current = product?.currentStep;

  return (
    <AppShell
      title={product?.dogName ? `${product.dogName} plan` : "Training plan"}
      eyebrow="Protocol cockpit"
      action={
        <Link className="button primary" href="/app/coach?space=plan">
          Coach
        </Link>
      }
      wide
    >
      {loading ? (
        <DogOSLoader label="DogOS lädt Echos Plan ..." reserve="inline" />
      ) : null}
      {error ? <p className="coach-error">{error}</p> : null}
      {product ? (
        <div className="dashboard-grid">
          <section className="command-panel span-2">
            <div>
              <p className="eyebrow">Current objective</p>
              <h2>{product.goalText}</h2>
              <p>{product.dogProfileSummary ?? product.goal}</p>
            </div>
            <div
              className="readiness-ring"
              style={{ "--value": target } as CSSProperties}
            >
              <strong>{target}%</strong>
              <span>target</span>
            </div>
          </section>

          <section className="glass-panel">
            <span className="panel-kicker">
              <Route size={16} /> Active step
            </span>
            <h3>{current?.stepCode.replaceAll("_", " ") ?? "Plan pending"}</h3>
            <div className="stat-row">
              <span>Difficulty</span>
              <strong>{current?.difficulty ?? 0}/5</strong>
            </div>
            <div className="stat-row">
              <span>Repetitions</span>
              <strong>{current?.repetitions ?? 0}</strong>
            </div>
            <div className="stat-row">
              <span>Micro-session</span>
              <strong>{Math.round((current?.durationSeconds ?? 0) / 60)}m</strong>
            </div>
          </section>

          <section className="glass-panel">
            <span className="panel-kicker">
              <CircleDot size={16} /> Progress gate
            </span>
            <div className="compare-bars">
              <label>
                Baseline <span>{baseline}%</span>
                <i style={{ width: `${baseline}%` }} />
              </label>
              <label>
                Target <span>{target}%</span>
                <i style={{ width: `${target}%` }} />
              </label>
            </div>
            <p className="microcopy">
              DogOS advances only when evidence is consistent enough for this
              dog-handler pair.
            </p>
          </section>

          <section className="glass-panel span-2">
            <span className="panel-kicker">
              <CalendarDays size={16} /> Next sessions
            </span>
            <div className="timeline-list">
              {product.calendar.slice(0, 5).map((entry, index) => (
                <div key={entry.id} className="timeline-node">
                  {entry.status === "completed" ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <CircleDot size={18} />
                  )}
                  <span>
                    <strong>Session {index + 1}</strong>
                    <small>
                      {entry.purposeCode.replaceAll("_", " ")} ·{" "}
                      {Math.round(entry.durationSeconds / 60)}m
                    </small>
                  </span>
                  <time>{new Date(entry.plannedStart).toLocaleDateString()}</time>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
