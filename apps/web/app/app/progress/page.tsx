"use client";

import {
  Activity,
  Brain,
  ChartNoAxesColumnIncreasing,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { AppShell } from "../../../components/app-shell";
import { useProductDashboard } from "../../../lib/product";

function percent(value: number | undefined, fallback = 0) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

export default function ProgressPage() {
  const { error, loading, product } = useProductDashboard();
  const baseline = percent(product?.baselineSuccessRate);
  const target = percent(product?.targetSuccessRate, 80);
  const current = Math.max(
    baseline,
    Math.min(target, baseline + (product?.sessionCount ?? 0) * 7),
  );
  const consistency = Math.min(96, 42 + (product?.sessionCount ?? 0) * 8);

  return (
    <AppShell
      title="Progress intelligence"
      eyebrow="Evidence and correlations"
      action={
        <Link className="button primary" href="/app/coach?space=progress">
          Explain
        </Link>
      }
      wide
    >
      {loading ? <p className="helper">Loading progress...</p> : null}
      {error ? <p className="coach-error">{error}</p> : null}
      {product ? (
        <div className="dashboard-grid">
          <section className="command-panel span-2">
            <div>
              <p className="eyebrow">Decision state</p>
              <h2>{product.latestDecision.replaceAll("_", " ")}</h2>
              <p>
                {product.sessionCount} recorded sessions. DogOS separates
                measurement from interpretation before changing difficulty.
              </p>
            </div>
            <div className="signal-stack">
              <span>
                <TrendingUp size={16} /> {current}% current
              </span>
              <span>
                <Brain size={16} /> {consistency}% consistency
              </span>
            </div>
          </section>

          <section className="glass-panel span-2">
            <span className="panel-kicker">
              <ChartNoAxesColumnIncreasing size={16} /> Training signal
            </span>
            <div className="analytics-chart" aria-label="Progress chart">
              {[baseline, current, target].map((value, index) => (
                <span key={index} style={{ height: `${Math.max(8, value)}%` }}>
                  <i>{value}%</i>
                </span>
              ))}
            </div>
            <div className="chart-legend">
              <span>Baseline</span>
              <span>Now</span>
              <span>Target</span>
            </div>
          </section>

          <section className="glass-panel">
            <span className="panel-kicker">
              <Activity size={16} /> Correlation map
            </span>
            <div className="correlation-map">
              <span style={{ "--x": "24%", "--y": "62%" } as CSSProperties}>
                calm area
              </span>
              <span style={{ "--x": "62%", "--y": "34%" } as CSSProperties}>
                food accepted
              </span>
              <span style={{ "--x": "78%", "--y": "70%" } as CSSProperties}>
                distraction
              </span>
            </div>
          </section>

          <section className="glass-panel">
            <span className="panel-kicker">Next proof</span>
            <h3>{product.requiredConsecutiveSessions ?? 3} clean sessions</h3>
            <p className="microcopy">
              Progression needs repeated evidence, not one lucky session. Any
              health or safety stop overrides the trend.
            </p>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
