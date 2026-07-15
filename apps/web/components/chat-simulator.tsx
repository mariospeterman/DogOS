"use client";

import {
  CheckCheck,
  FileAudio,
  Image as ImageIcon,
  Languages,
  RefreshCcw,
  Send,
  ShieldAlert,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Locale = "de-CH" | "en";
type Message = {
  from: "system" | "owner";
  text: string;
  state?: "sent" | "delivered" | "read";
};

const steps = [
  [
    "welcome",
    "Hoi! Ich begleite dich und Milo durch kurze, sichere Trainingsschritte.",
    "Hi! I will guide you and Milo through short, safe training steps.",
  ],
  [
    "ai_disclosure",
    "Entscheidungen sind in dieser Demo regelbasiert. Eine spätere KI wäre nie allein massgeblich.",
    "Decisions in this demo are rule-based. Future AI assistance would never be authoritative.",
  ],
  [
    "locale_confirmation",
    "Möchtest du auf Deutsch weitermachen?",
    "Would you like to continue in English?",
  ],
  [
    "household_context",
    "Leben Kinder oder weitere Tiere im Haushalt?",
    "Are there children or other animals in the household?",
  ],
  [
    "dog_identity",
    "Dein Hund heisst Milo. Ist die Rasse unbekannt oder gemischt?",
    "Your dog is Milo. Is the breed unknown or mixed?",
  ],
  [
    "dog_history",
    "Gab es kürzlich grosse Veränderungen?",
    "Have there been recent major changes?",
  ],
  [
    "health_screen",
    "Gibt es Anzeichen für Schmerzen oder eine plötzliche Verhaltensänderung?",
    "Any signs of pain or a sudden behaviour change?",
  ],
  [
    "safety_screen",
    "Gab es Beissen, Schnappen oder starke Angst?",
    "Any biting, snapping, or severe fear?",
  ],
  [
    "behavior_concern",
    "Was möchtest du im Alltag verbessern?",
    "What would you like to improve in daily life?",
  ],
  [
    "goal_selection",
    "Wähle zuerst ein messbares Ziel.",
    "Choose one measurable goal first.",
  ],
  [
    "baseline_collection",
    "Bei wie vielen von 10 Abschnitten bleibt die Leine heute locker?",
    "In how many of 10 segments is the leash loose today?",
  ],
  [
    "plan_ready",
    "Milos Plan ist bereit: drei kurze Einheiten, dann eine datenbasierte Prüfung.",
    "Milo's plan is ready: three short sessions, then an evidence-based review.",
  ],
] as const;

const choices: Record<string, [string, string][]> = {
  welcome: [["Los geht's", "Let's begin"]],
  ai_disclosure: [["Verstanden", "Understood"]],
  locale_confirmation: [["Deutsch", "English"]],
  household_context: [
    ["Keine Kinder", "No children"],
    ["Weitere Person", "Another adult"],
  ],
  dog_identity: [["Gemischt / unbekannt", "Mixed / unknown"]],
  dog_history: [["Keine", "None"]],
  health_screen: [
    ["Nein", "No"],
    ["Schmerz vermutet", "Suspected pain"],
  ],
  safety_screen: [
    ["Nein", "No"],
    ["Biss mit Kind", "Bite involving child"],
  ],
  behavior_concern: [["Ziehen an der Leine", "Pulling on leash"]],
  goal_selection: [
    ["8 von 10 Abschnitten locker", "Loose in 8 of 10 segments"],
  ],
  baseline_collection: [["6 von 10", "6 of 10"]],
};

export function ChatSimulator() {
  const [locale, setLocale] = useState<Locale>("de-CH");
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [delivery, setDelivery] = useState("Webhook gültig");
  const current = steps[step];
  const prompt = current?.[locale === "de-CH" ? 1 : 2];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem("dogos-conversation");
      if (saved) {
        const value = JSON.parse(saved) as {
          locale: Locale;
          step: number;
          messages: Message[];
        };
        setLocale(value.locale);
        setStep(value.step);
        setMessages(value.messages);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(
      "dogos-conversation",
      JSON.stringify({ locale, step, messages }),
    );
  }, [locale, step, messages]);

  const options = useMemo(
    () => (current ? (choices[current[0]] ?? []) : []),
    [current],
  );
  const choose = (de: string, en: string) => {
    const selected = locale === "de-CH" ? de : en;
    if (current?.[0] === "health_screen" && de.includes("Schmerz"))
      return escalate(selected, "veterinary");
    if (current?.[0] === "safety_screen" && de.includes("Biss"))
      return escalate(selected, "trainer");
    if (current?.[0] === "locale_confirmation" && en === "English")
      setLocale("en");
    setMessages((value) => [
      ...value,
      { from: "system", text: prompt ?? "" },
      { from: "owner", text: selected, state: "read" },
    ]);
    setStep((value) => Math.min(steps.length, value + 1));
  };
  const escalate = (answer: string, kind: "veterinary" | "trainer") => {
    const text =
      kind === "veterinary"
        ? "Training pausiert. Bitte lass Milo tiermedizinisch abklären. Keine Diagnose wurde erstellt."
        : "Kein Trainingsplan wird angezeigt. Eine qualifizierte Fachperson muss den Fall prüfen.";
    setMessages((value) => [
      ...value,
      { from: "owner", text: answer, state: "read" },
      { from: "system", text },
    ]);
    setStep(steps.length + 1);
  };
  const reset = () => {
    window.localStorage.removeItem("dogos-conversation");
    setLocale("de-CH");
    setStep(0);
    setMessages([]);
    setDelivery("Webhook gültig");
  };
  const sendFreeText = () => {
    if (!input.trim()) return;
    setMessages((value) => [
      ...value,
      { from: "owner", text: input.trim(), state: "delivered" },
      {
        from: "system",
        text:
          locale === "de-CH"
            ? "Freitext ist hier nur als simulierte Notiz gespeichert. Bitte nutze die Auswahl für Entscheidungen."
            : "Free text is stored only as a simulated note. Use a choice for decisions.",
      },
    ]);
    setInput("");
  };

  return (
    <div className="simulator-layout">
      <section className="phone-chat" aria-label="Lokaler WhatsApp-Simulator">
        <header className="chat-header">
          <div className="dog-avatar">M</div>
          <div>
            <strong>DogOS mit Milo</strong>
            <span>Lokaler Simulator</span>
          </div>
          <button
            onClick={() => setLocale(locale === "de-CH" ? "en" : "de-CH")}
            aria-label="Sprache wechseln"
          >
            <Languages />
          </button>
        </header>
        <div className="chat-history">
          <div className="chat-date">HEUTE</div>
          {messages.map((message, index) => (
            <div
              className={`bubble ${message.from}`}
              key={`${index}-${message.text}`}
            >
              <span>{message.text}</span>
              {message.state ? (
                <small>
                  <CheckCheck size={13} />
                  {message.state}
                </small>
              ) : null}
            </div>
          ))}
          {prompt ? (
            <div className="bubble system current">
              <span>{prompt}</span>
            </div>
          ) : null}
          {step === steps.length ? (
            <div className="action-message">
              <strong>
                {locale === "de-CH"
                  ? "Dein Plan ist bereit"
                  : "Your plan is ready"}
              </strong>
              <span>Signierter Entwicklungslink · 15 Min.</span>
              <Link href="/app/today">
                {locale === "de-CH"
                  ? "Heutiges Training öffnen"
                  : "Open today's training"}
              </Link>
            </div>
          ) : null}
        </div>
        {options.length > 0 ? (
          <div className="reply-options">
            {options.map(([de, en]) => (
              <button key={de} onClick={() => choose(de, en)}>
                {locale === "de-CH" ? de : en}
              </button>
            ))}
          </div>
        ) : null}
        <div className="composer">
          <button title="Simulierte Medien" aria-label="Simulierte Medien">
            <ImageIcon size={20} />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendFreeText();
            }}
            placeholder={locale === "de-CH" ? "Nachricht" : "Message"}
          />
          <button onClick={sendFreeText} aria-label="Senden">
            <Send size={20} />
          </button>
        </div>
      </section>
      <aside className="sim-controls">
        <p className="eyebrow">Entwicklungswerkzeug</p>
        <h1>Gespräch testen</h1>
        <p>Deterministisches Onboarding ohne echte Provider oder KI.</p>
        <div className="control-status">
          <span className="status-dot" />
          {delivery}
        </div>
        <button
          onClick={() =>
            setDelivery("Doppelte Zustellung erkannt und ignoriert")
          }
        >
          <Webhook size={18} /> Webhook doppelt senden
        </button>
        <button onClick={() => setDelivery("Ungültige Signatur abgelehnt")}>
          <ShieldAlert size={18} /> Signatur ungültig
        </button>
        <button
          onClick={() =>
            setMessages((value) => [
              ...value,
              {
                from: "owner",
                text: "[Voice note transcript] Milo pulled twice.",
                state: "read",
              },
            ])
          }
        >
          <FileAudio size={18} /> Voice-Transkript
        </button>
        <button onClick={reset}>
          <RefreshCcw size={18} /> Testkonto zurücksetzen
        </button>
        <p className="sim-meta">
          Schweiz · CHF · Europe/Zurich
          <br />
          Sprache: {locale} · Schritt {Math.min(step + 1, steps.length)}/
          {steps.length}
        </p>
      </aside>
    </div>
  );
}
