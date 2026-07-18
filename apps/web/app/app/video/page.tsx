"use client";

import { CheckCircle2, Loader2, Upload, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";
import { useProductDashboard } from "../../../lib/product";

interface VideoFinding {
  confidence: number;
  evidence: string;
  label: string;
  recommendation: string;
}

interface VideoAnalysis {
  completedAt: string | null;
  findings: VideoFinding[];
  id: string;
  jobId: string | null;
  originalFilename: string;
  status: string;
}

interface VideoUpload {
  expiresInSeconds: number;
  method: "PUT";
  url: string;
}

export default function VideoPage() {
  const { error, loading, product } = useProductDashboard();
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (product === null) return;
    void (async () => {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/video-analyses`),
        { cache: "no-store", headers: await dogosApiHeaders() },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          analyses: VideoAnalysis[];
        };
        setAnalyses(body.analyses);
      }
    })();
  }, [product]);

  async function submit() {
    if (file === null || product === null) return;
    setWorking(true);
    setMessage(null);
    try {
      const createResponse = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/video-analyses`),
        {
          body: JSON.stringify({
            contentType: file.type,
            originalFilename: file.name,
            sizeBytes: file.size,
          }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!createResponse.ok) {
        setMessage(
          createResponse.status === 409
            ? "Dein aktueller Tarif hat kein freies Video-Kontingent."
            : "Das Video konnte nicht vorbereitet werden.",
        );
        return;
      }
      const created = (await createResponse.json()) as {
        analysis: VideoAnalysis;
        upload: VideoUpload;
      };
      const uploadResponse = await fetch(created.upload.url, {
        body: file,
        headers: { "content-type": file.type },
        method: created.upload.method,
      });
      if (!uploadResponse.ok) {
        setMessage(
          "Der private Upload ist fehlgeschlagen. Bitte erneut versuchen.",
        );
        setAnalyses((current) => [created.analysis, ...current]);
        return;
      }
      const completeResponse = await fetch(
        dogosApiUrl(
          `/v1/video-analyses/${created.analysis.id}/complete-upload`,
        ),
        {
          body: JSON.stringify({}),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!completeResponse.ok) {
        setMessage(
          "Der Upload ist gespeichert, konnte aber noch nicht eingereiht werden.",
        );
        setAnalyses((current) => [created.analysis, ...current]);
        return;
      }
      const queued = (await completeResponse.json()) as {
        analysis: VideoAnalysis;
      };
      setAnalyses((current) => [queued.analysis, ...current]);
      setFile(null);
      setMessage(
        "Upload gespeichert. DogOS analysiert den Clip asynchron und zeigt erst geprüfte Hinweise.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
      </div>
    );
  }
  if (product === null) {
    return (
      <AppShell title="Video" eyebrow="Analyse">
        <p className="error-note">
          {error ?? "Schliesse zuerst das Onboarding ab."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Video" eyebrow={`${product.dogName} analysieren`}>
      <section className="auth-form">
        <label>
          Trainingsclip
          <input
            accept="video/mp4,video/quicktime,video/webm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <button
          className="button primary wide"
          disabled={file === null || working}
          onClick={submit}
        >
          <Upload size={18} /> {working ? "Upload läuft..." : "Video hochladen"}
        </button>
        {message === null ? null : <p className="helper">{message}</p>}
      </section>

      <section className="settings">
        {analyses.length === 0 ? (
          <div>
            <span>
              <Video />
              Noch keine Analyse
              <small>
                Clips werden privat hochgeladen und erst nach Prüfung als
                Hinweise angezeigt.
              </small>
            </span>
            <strong>Bereit</strong>
          </div>
        ) : (
          analyses.map((analysis) => (
            <div key={analysis.id}>
              <span>
                {analysis.status === "completed" ? (
                  <CheckCircle2 />
                ) : (
                  <Loader2 />
                )}
                {analysis.originalFilename}
                <small>
                  {analysis.status === "uploaded"
                    ? "In der Warteschlange"
                    : analysis.status === "processing"
                      ? "Analyse läuft"
                      : analysis.status}
                </small>
              </span>
              <strong>
                {analysis.findings.length === 0
                  ? "Noch keine Hinweise"
                  : `${analysis.findings.length} Hinweise`}
              </strong>
            </div>
          ))
        )}
      </section>

      {analyses.flatMap((analysis) =>
        analysis.findings.map((finding) => (
          <section
            className="inline-training-card"
            key={`${analysis.id}:${finding.label}`}
          >
            <div className="inline-card-heading">
              <span>{analysis.originalFilename}</span>
              <strong>{finding.label}</strong>
            </div>
            <p>{finding.recommendation}</p>
            <p className="helper">
              {Math.round(finding.confidence * 100)}% · {finding.evidence}
            </p>
          </section>
        )),
      )}
    </AppShell>
  );
}
