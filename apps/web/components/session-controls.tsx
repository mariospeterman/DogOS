"use client";

import { Minus, Pause, Play, Plus, Square } from "lucide-react";
import { useEffect, useState } from "react";

export function SessionControls() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [repetitions, setRepetitions] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [submitted, setSubmitted] = useState(false);

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
      <section className="form-section">
        <h2>Kurzer Check-in</h2>
        <label>
          Futter angenommen?
          <select defaultValue="unknown">
            <option value="unknown">Nicht erfasst</option>
            <option>Ja</option>
            <option>Nein</option>
          </select>
        </label>
        <label>
          Ablenkung
          <select defaultValue="unknown">
            <option value="unknown">Nicht erfasst</option>
            <option>Niedrig</option>
            <option>Mittel</option>
            <option>Hoch</option>
          </select>
        </label>
        <label>
          Schwierigkeit
          <select defaultValue="2">
            <option value="1">Sehr leicht</option>
            <option value="2">Passend</option>
            <option value="3">Schwierig</option>
          </select>
        </label>
        <label>
          Dein Vertrauen
          <select defaultValue="4">
            <option value="1">1 - gering</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5 - hoch</option>
          </select>
        </label>
        <label>
          Bedenken (optional)
          <textarea placeholder="Nur eintragen, was du beobachtet hast" />
        </label>
      </section>
      <div className="button-row">
        <button className="button danger">
          <Square size={18} /> Einheit stoppen
        </button>
        <button className="button primary" onClick={() => setSubmitted(true)}>
          Abschliessen
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
