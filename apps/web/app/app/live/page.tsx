"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import { Radio, ShieldCheck, Video, Waves } from "lucide-react";
import Link from "next/link";
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

interface LiveKitJoin {
  token: string;
  url: string;
}

export default function LivePage() {
  const { error, loading, product } = useProductDashboard();
  const [consent, setConsent] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [join, setJoin] = useState<LiveKitJoin | null>(null);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function start() {
    if (product === null || !consent) return;
    const response = await fetch(
      dogosApiUrl(`/v1/dogs/${product.dogId}/live-sessions`),
      {
        body: JSON.stringify({ plannedMinutes: 5 }),
        headers: await dogosApiHeaders(true),
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage("Live coaching is not configured for this environment.");
      return;
    }
    const body = (await response.json()) as {
      liveKit: LiveKitJoin;
      session: LiveSession;
    };
    setJoin(body.liveKit);
    setSession(body.session);
    setMessage("Live room ready. Keep guidance short and stop on stress.");
  }

  async function end() {
    if (session === null) return;
    const response = await fetch(
      dogosApiUrl(`/v1/live-sessions/${session.id}/complete`),
      {
        body: JSON.stringify({
          consumedMinutes: Math.max(1, session.plannedMinutes),
          summary: recordingConsent
            ? "Live session ended; post-session VOD review may be prepared from selected evidence."
            : "Live session ended without recording consent.",
        }),
        headers: await dogosApiHeaders(true),
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage("Could not end the live session cleanly.");
      return;
    }
    const body = (await response.json()) as { session: LiveSession };
    setSession(body.session);
    setJoin(null);
    setMessage("Live session ended and saved to DogOS history.");
  }

  return (
    <AppShell
      title="Live coaching"
      eyebrow="Realtime room"
      action={
        <Link className="button secondary" href="/app/coach?space=media">
          Coach panel
        </Link>
      }
      wide
    >
      {loading ? <p className="helper">Loading live readiness...</p> : null}
      {error ? <p className="coach-error">{error}</p> : null}
      <div className="dashboard-grid">
        <section className="command-panel span-2">
          <div>
            <p className="eyebrow">Silent measurement first</p>
            <h2>Short, safe, rate-limited live guidance</h2>
            <p>
              Live coaching is designed for micro-sessions: observe, cue only
              when safe, then summarize into post-session evidence.
            </p>
          </div>
          <button className="button primary" disabled={!consent} onClick={start}>
            <Radio size={17} /> Start 5 min
          </button>
        </section>

        <section className="glass-panel">
          <span className="panel-kicker">
            <ShieldCheck size={16} /> Preflight
          </span>
          <label className="glass-check">
            <input
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              type="checkbox"
            />
            <span>
              I consent to live transmission for this session and will stop if
              the dog shows stress, pain, or avoidance.
            </span>
          </label>
          <label className="glass-check">
            <input
              checked={recordingConsent}
              onChange={(event) => setRecordingConsent(event.target.checked)}
              type="checkbox"
            />
            <span>
              I separately consent to selected recording moments for
              post-session VOD review.
            </span>
          </label>
          <p className="microcopy">
            Children, bystanders, and private third-party spaces should stay out
            of frame.
          </p>
        </section>

        <section className="glass-panel">
          <span className="panel-kicker">
            <Waves size={16} /> Room state
          </span>
          {session ? (
            <div className="stat-row">
              <span>{session.roomName}</span>
              <strong>{session.status}</strong>
            </div>
          ) : (
            <div className="empty-state compact">
              <Video size={22} />
              <strong>No active room</strong>
            </div>
          )}
          {message ? <p className="helper">{message}</p> : null}
        </section>
        {join !== null && session !== null ? (
          <section className="live-room-panel span-2">
            <LiveKitRoom
              audio
              connect
              data-lk-theme="default"
              serverUrl={join.url}
              token={join.token}
              video
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
            <button className="button secondary" onClick={end}>
              End and save session
            </button>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
