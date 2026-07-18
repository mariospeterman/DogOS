"use client";

import {
  ConnectionState,
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import {
  CheckCircle2,
  PhoneOff,
  Radio,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";
import { useProductDashboard } from "../../../lib/product";

interface LiveSession {
  consumedMinutes: number;
  id: string;
  plannedMinutes: number;
  roomName: string;
  status: string;
  summary: string | null;
}

export default function LivePage() {
  const { error, loading, product } = useProductDashboard();
  const [plannedMinutes, setPlannedMinutes] = useState(10);
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [liveKit, setLiveKit] = useState<{ token: string; url: string } | null>(
    null,
  );
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function start() {
    if (product === null) return;
    setWorking(true);
    setMessage(null);
    try {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/live-sessions`),
        {
          body: JSON.stringify({ plannedMinutes }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 409
            ? "Live Coaching ist hier noch nicht freigeschaltet oder dein Kontingent ist aufgebraucht."
            : "Live Coaching konnte nicht gestartet werden.",
        );
        return;
      }
      const body = (await response.json()) as {
        liveKit: { token: string; url: string };
        session: LiveSession;
      };
      setLiveKit(body.liveKit);
      setSession(body.session);
      setMessage(
        "Live Raum bereit. Deine Zugangsdaten werden nicht angezeigt oder protokolliert.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function complete() {
    if (session === null) return;
    setWorking(true);
    try {
      const response = await fetch(
        dogosApiUrl(`/v1/live-sessions/${session.id}/complete`),
        {
          body: JSON.stringify({
            consumedMinutes: Math.min(plannedMinutes, session.plannedMinutes),
            summary:
              summary.trim() || "Live coaching session completed by owner.",
          }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (response.ok) {
        const body = (await response.json()) as { session: LiveSession };
        setSession(body.session);
        setMessage("Live Session gespeichert.");
      }
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
      <AppShell title="Live" eyebrow="Coaching">
        <p className="error-note">
          {error ?? "Schliesse zuerst das Onboarding ab."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Live Coaching" eyebrow={product.dogName}>
      <section className="auth-form">
        <label>
          Minuten
          <input
            max={60}
            min={1}
            onChange={(event) =>
              setPlannedMinutes(Number(event.target.value) || 1)
            }
            type="number"
            value={plannedMinutes}
          />
        </label>
        <label className="checkbox-row">
          <input
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            type="checkbox"
          />
          <span>
            Ich stimme der Live-Übertragung für diese Trainingssession zu.
          </span>
        </label>
        <button
          className="button primary wide"
          disabled={working || !consent}
          onClick={start}
        >
          <Video size={18} /> {working ? "Startet..." : "Live Session starten"}
        </button>
        {message === null ? null : <p className="helper">{message}</p>}
      </section>

      {session === null || liveKit === null ? null : (
        <section className="settings">
          <div>
            <span>
              <Radio />
              Live Verbindung
              <small>
                Transport über LiveKit, DogOS bleibt für Daten und Coaching
                verantwortlich.
              </small>
            </span>
            <strong>{session.status}</strong>
          </div>
          <div>
            <span>
              <ShieldCheck />
              Zugang geschützt
              <small>Raumdaten werden nur für die Verbindung verwendet.</small>
            </span>
            <strong>Privat</strong>
          </div>
          <div>
            <span>
              <CheckCircle2 />
              Sitzungsstatus
              <small>LiveKit Raum verbunden ohne sichtbare Zugangsdaten.</small>
            </span>
            <strong>{session.plannedMinutes} Min.</strong>
          </div>
        </section>
      )}

      {session === null || liveKit === null ? null : (
        <section className="live-room" aria-label="Live Coaching Raum">
          <LiveKitRoom
            audio
            connect
            serverUrl={liveKit.url}
            token={liveKit.token}
            video
          >
            <div className="live-room__bar">
              <span>
                <Radio size={16} />
                <ConnectionState />
              </span>
              <strong>{session.plannedMinutes} Min.</strong>
            </div>
            <VideoConference />
            <RoomAudioRenderer />
            <ControlBar
              controls={{
                camera: true,
                chat: false,
                leave: true,
                microphone: true,
                screenShare: false,
              }}
              saveUserChoices
            />
          </LiveKitRoom>
        </section>
      )}

      {session === null ? null : (
        <section className="auth-form">
          <label>
            Zusammenfassung
            <textarea
              maxLength={1200}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
              value={summary}
            />
          </label>
          <button
            className="button secondary wide"
            disabled={working || session.status === "completed"}
            onClick={complete}
          >
            <PhoneOff size={18} /> Session abschliessen
          </button>
        </section>
      )}
    </AppShell>
  );
}
