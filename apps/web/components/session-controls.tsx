"use client";

import { AlertTriangle, Check, Minus, Pause, Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export function SessionControls() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [outcome, setOutcome] = useState<"clean" | "mixed" | "stopped" | null>(
    null,
  );
  const [concern, setConcern] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(
      () => setSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(interval);
  }, [running]);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (submitted)
    return (
      <section className="success-panel" aria-live="polite">
        <strong>Einheit gespeichert</strong>
        <p>
          {repetitions} Wiederholungen, davon {successes} erfolgreich. Nicht
          erfasste Werte bleiben unbekannt.
        </p>
        {concern ? (
          <p className="escalation-copy">
            Deine Beobachtung ist gespeichert. DogOS stellt keine Diagnose. Bei
            einer akuten körperlichen Veränderung lass Milo tierärztlich
            beurteilen; bei einem Beissvorfall kannst du direkt eine
            qualifizierte Fachperson anfragen.
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
          onClick={() => setRunning((value) => !value)}
          aria-label={running ? "Timer pausieren" : "Timer starten"}
        >
          {running ? <Pause /> : <Play />}
        </button>
      </section>
      <section className="counter-grid">
        <Counter
          label="Wiederholungen"
          value={repetitions}
          onChange={setRepetitions}
          max={8}
        />
        <Counter
          label="Erfolgreich"
          value={successes}
          onChange={setSuccesses}
          max={repetitions}
        />
      </section>
      <section className="outcome-section">
        <h2>Ergebnis</h2>
        <div className="segmented-control">
          {(
            [
              ["clean", "Sauber"],
              ["mixed", "Uneinheitlich"],
              ["stopped", "Abgebrochen"],
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
        <details className="observation-details">
          <summary>
            <AlertTriangle size={17} /> Etwas Ungewöhnliches beobachtet
          </summary>
          <label>
            Nur beobachtbare Fakten
            <textarea
              onChange={(event) => setConcern(event.target.value.length > 0)}
              placeholder="Was ist konkret passiert?"
            />
          </label>
        </details>
      </section>
      <div className="button-row">
        <button
          className="button primary wide"
          disabled={outcome === null}
          onClick={() => setSubmitted(true)}
        >
          <Check size={18} /> Speichern
        </button>
      </div>
    </>
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
