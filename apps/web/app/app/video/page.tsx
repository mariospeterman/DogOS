"use client";

import { Camera, Film, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";
import { useProductDashboard } from "../../../lib/product";

interface VideoAnalysis {
  completedAt: string | null;
  findings: Array<{
    confidence: number;
    evidence: string;
    label: string;
    recommendation: string;
  }>;
  id: string;
  originalFilename: string;
  status: string;
}

export default function VideoPage() {
  const { error, loading, product } = useProductDashboard();
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);

  useEffect(() => {
    if (product === null) return;
    let active = true;
    void (async () => {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/video-analyses`),
        { cache: "no-store", headers: await dogosApiHeaders() },
      );
      if (response.ok && active) {
        const body = (await response.json()) as { analyses: VideoAnalysis[] };
        setAnalyses(body.analyses);
      }
    })();
    return () => {
      active = false;
    };
  }, [product]);

  return (
    <AppShell
      title="Video intelligence"
      eyebrow="VOD, CV, evidence"
      action={
        <Link className="button primary" href="/app/coach?action=upload-video">
          <Upload size={17} /> Upload
        </Link>
      }
      wide
    >
      {loading ? <p className="helper">Loading media...</p> : null}
      {error ? <p className="coach-error">{error}</p> : null}
      <div className="dashboard-grid">
        <section className="command-panel span-2">
          <div>
            <p className="eyebrow">Analysis pipeline</p>
            <h2>Private upload to reviewed observations</h2>
            <p>
              DogOS treats video findings as candidate evidence. Measurements
              need confidence, context, and owner/professional confirmation.
            </p>
          </div>
          <div className="signal-stack">
            <span>
              <ShieldCheck size={16} /> private objects
            </span>
            <span>
              <Camera size={16} /> frame windows
            </span>
          </div>
        </section>

        <section className="glass-panel span-2">
          <span className="panel-kicker">
            <Film size={16} /> Recent analyses
          </span>
          {analyses.length === 0 ? (
            <div className="empty-state">
              <strong>No videos reviewed yet</strong>
              <p>
                Start with one short clip from a normal micro-session. Avoid
                crowds, children, and unrelated people in frame.
              </p>
            </div>
          ) : (
            <div className="timeline-list">
              {analyses.map((analysis) => (
                <div className="timeline-node" key={analysis.id}>
                  <Film size={18} />
                  <span>
                    <strong>{analysis.originalFilename}</strong>
                    <small>
                      {analysis.status} · {analysis.findings.length} findings
                    </small>
                  </span>
                  <time>
                    {analysis.completedAt
                      ? new Date(analysis.completedAt).toLocaleDateString()
                      : "queued"}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
