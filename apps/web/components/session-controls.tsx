"use client";

import { AlertTriangle, Check, Minus, Pause, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";

export function SessionControls({
  dogName,
  maxRepetitions,
  scheduledSessionId,
}: {
  dogName: string;
  maxRepetitions: number;
  scheduledSessionId: string;
}) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"clean" | "mixed" | "stopped" | null>(
    null,
  );
  const [foodAccepted, setFoodAccepted] = useState<"yes" | "no" | null>(null);
  const [difficulty, setDifficulty] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [distractionLevel, setDistractionLevel] = useState(1);
  const [concernNotes, setConcernNotes] = useState("");

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(
      () => setSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(interval);
  }, [running]);

  async function toggleTimer() {
    if (running) {
      setRunning(false);
      return;
    }
    setError(null);
    if (sessionId === null) {
      try {
        const response = await fetch(
          dogosApiUrl(`/v1/scheduled-sessions/${scheduledSessionId}/start`),
          {
            body: "{}",
            headers: await dogosApiHeaders(true),
            method: "POST",
          },
        );
        if (!response.ok)
          throw new Error("Training konnte nicht gestartet werden.");
        const result = (await response.json()) as { sessionId: string };
        setSessionId(result.sessionId);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Training nicht verfügbar.",
        );
        return;
      }
    }
    setRunning(true);
  }

  async function submit() {
    if (sessionId === null || outcome === null || foodAccepted === null) return;
    setSaving(true);
    setRunning(false);
    setError(null);
    try {
      const response = await fetch(
        dogosApiUrl(`/v1/sessions/${sessionId}/complete`),
        {
          body: JSON.stringify({
            concernNotes: concernNotes.trim() || undefined,
            confidence,
            difficulty,
            distractionLevel,
            foodAccepted: foodAccepted === "yes",
            outcome,
            repetitions,
            success: repetitions === 0 ? 0 : (successes / repetitions) * 100,
            successes,
          }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!response.ok)
        throw new Error("Einheit konnte nicht gespeichert werden.");
      setSubmitted(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (submitted)
    return (
      <section className="success-panel" aria-live="polite">
        <strong>Einheit gespeichert</strong>
        <p>
          {repetitions} Wiederholungen, davon {successes} erfolgreich. Nicht
          erfasste Werte bleiben unbekannt.
        </p>
        {concernNotes ? (
          <p className="escalation-copy">
            Deine Beobachtung zu {dogName} ist gespeichert. DogOS stellt keine
            Diagnose; akute körperliche Veränderungen sollten tierärztlich
            beurteilt werden.
          </p>
        ) : null}
        <a className="button primary" href="/app/progress">
          Fortschritt ansehen
        </a>
      </section>
    );

  return (
    <>
      <section className="timer-panel">
        <p>Trainingszeit</p>
        <strong>{time}</strong>
        <button
          className="timer-button"
          onClick={() => void toggleTimer()}
          aria-label={running ? "Timer pausieren" : "Timer starten"}
        >
          {running ? <Pause /> : <Play />}
        </button>
      </section>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="counter-grid">
        <Counter
          label="Wiederholungen"
          value={repetitions}
          onChange={(value) => {
            setRepetitions(value);
            setSuccesses((current) => Math.min(current, value));
          }}
          max={maxRepetitions}
        />
        <Counter
          label="Erfolgreich"
          value={successes}
          onChange={setSuccesses}
          max={repetitions}
        />
      </section>
      <section className="outcome-section">
        <h2>Kurzer Check-in</h2>
        <div className="segmented-control">
          {(
            [
              ["clean", "Sauber"],
              ["mixed", "Gemischt"],
              ["stopped", "Beendet"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={outcome === value ? "active" : ""}
              key={value}
              onClick={() => setOutcome(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-section compact-session-fields">
          <label>
            Futter angenommen
            <select
              value={foodAccepted ?? ""}
              onChange={(event) =>
                setFoodAccepted(event.target.value as "yes" | "no")
              }
            >
              <option value="" disabled>
                Auswählen
              </option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </label>
          <Rating
            label="Schwierigkeit"
            value={difficulty}
            onChange={setDifficulty}
          />
          <Rating
            label="Sicherheit im Ablauf"
            value={confidence}
            onChange={setConfidence}
          />
          <Rating
            label="Ablenkung"
            value={distractionLevel}
            onChange={setDistractionLevel}
            minimum={0}
          />
        </div>
        <details className="observation-details">
          <summary>
            <AlertTriangle size={17} /> Beobachtung ergänzen
          </summary>
          <label>
            Nur beobachtbare Fakten
            <textarea
              value={concernNotes}
              onChange={(event) => setConcernNotes(event.target.value)}
              placeholder="Was ist konkret passiert?"
              maxLength={1_000}
            />
          </label>
        </details>
      </section>
      <div className="button-row">
        <button
          className="button primary wide"
          disabled={
            saving ||
            sessionId === null ||
            outcome === null ||
            foodAccepted === null
          }
          onClick={() => void submit()}
        >
          <Check size={18} /> {saving ? "Speichert ..." : "Speichern"}
        </button>
      </div>
    </>
  );
}

function Rating({
  label,
  minimum = 1,
  onChange,
  value,
}: {
  label: string;
  minimum?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {Array.from({ length: 6 - minimum }, (_, index) => index + minimum).map(
          (option) => (
            <option key={option}>{option}</option>
          ),
        )}
      </select>
    </label>
  );
}

function Counter({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
}) {
  return (
    <div className="counter">
      <span>{label}</span>
      <strong>{value}</strong>
      <div>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`${label} verringern`}
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${label} erhöhen`}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
