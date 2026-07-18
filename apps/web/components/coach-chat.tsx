"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  CalendarDays,
  CircleUserRound,
  Clock3,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";
import type { ProductDashboard } from "../lib/product";
import { trainingPresentation } from "../lib/training-presentation";
import { AppNavigation } from "./app-navigation";

interface PersistedConversation {
  id: string;
  messages: Array<{
    content: string;
    id: string;
    role: "assistant" | "system" | "user";
  }>;
}

function toUiMessages(conversation: PersistedConversation): UIMessage[] {
  return conversation.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      id: message.id,
      parts: [{ text: message.content, type: "text" as const }],
      role: message.role as "assistant" | "user",
    }));
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function CoachChat({ product }: { product: ProductDashboard }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(
          dogosApiUrl(
            `/v1/coach/conversation?dogId=${encodeURIComponent(product.dogId)}`,
          ),
          { cache: "no-store", headers: await dogosApiHeaders() },
        );
        if (response.status === 401) {
          window.location.assign("/auth/sign-in?next=/app/coach");
          return;
        }
        if (!response.ok) throw new Error("COACH_UNAVAILABLE");
        const conversation = (await response.json()) as PersistedConversation;
        if (active) setInitialMessages(toUiMessages(conversation));
      } catch {
        if (active) setLoadError("Der Coach konnte nicht geladen werden.");
      }
    })();
    return () => {
      active = false;
    };
  }, [product.dogId]);

  if (initialMessages === null) {
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
        <p>{loadError ?? "Gespräch wird geladen"}</p>
      </div>
    );
  }
  return <CoachRuntime initialMessages={initialMessages} product={product} />;
}

function CoachRuntime({
  initialMessages,
  product,
}: {
  initialMessages: UIMessage[];
  product: ProductDashboard;
}) {
  const [input, setInput] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { dogId: product.dogId },
        headers: () => dogosApiHeaders(true),
      }),
    [product.dogId],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: `dog:${product.dogId}`,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const presentation = trainingPresentation(product);
  const duration = Math.max(
    1,
    Math.ceil((product.currentStep?.durationSeconds ?? 180) / 60),
  );

  useEffect(() => {
    viewport.current?.scrollTo({
      behavior: "smooth",
      top: viewport.current.scrollHeight,
    });
  }, [messages, status]);

  async function submit(text = input) {
    const value = text.trim();
    if (value.length === 0 || busy) return;
    setInput("");
    await sendMessage({ text: value });
  }

  const hasHistory = messages.length > 0;
  return (
    <div className="coach-shell">
      <header className="coach-header">
        <div className="coach-identity">
          <span className="coach-mark">D</span>
          <div>
            <strong>DogOS</strong>
            <span>
              <i /> {product.dogName}s Coach
            </span>
          </div>
        </div>
        <Link className="icon-link" href="/app/account" aria-label="Konto">
          <CircleUserRound size={21} />
        </Link>
      </header>

      <div className="coach-context-bar">
        <Link href="/app/plan">
          <Route size={16} />
          <span>
            <small>Aktives Ziel</small>
            {product.goalText}
          </span>
        </Link>
        <Link href="/app/progress">
          <Target size={16} />
          <span>
            <small>Etappe</small>
            {product.baselineSuccessRate}% → {product.targetSuccessRate ?? 80}%
          </span>
        </Link>
      </div>

      <div className="coach-messages" ref={viewport} aria-live="polite">
        {!hasHistory ? (
          <div className="coach-welcome">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>
                Ich begleite dich und {product.dogName} im Training. Erzähl mir,
                was heute passiert ist oder was du als Nächstes verbessern
                möchtest.
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((message) => {
          const text = textOf(message);
          if (text.length === 0) return null;
          return (
            <article
              className={`coach-message ${message.role}`}
              key={message.id}
            >
              {message.role === "assistant" ? (
                <span className="coach-avatar">D</span>
              ) : null}
              <div className={`message-bubble ${message.role}`}>
                {text.split("\n").map((line, index) => (
                  <p key={`${message.id}:${index}`}>{line || "\u00a0"}</p>
                ))}
              </div>
            </article>
          );
        })}

        <section className="inline-training-card">
          <div className="inline-card-heading">
            <span>Heute mit {product.dogName}</span>
            <strong>{presentation.title}</strong>
          </div>
          <div className="inline-card-meta">
            <span>
              <Clock3 size={15} /> {duration} Min.
            </span>
            <span>
              <Target size={15} /> {product.currentStep?.repetitions ?? 6}{" "}
              {presentation.unit}
            </span>
          </div>
          <p>{presentation.instruction(product.dogName)}</p>
          <div className="inline-card-actions">
            <Link
              className="button primary"
              href={
                product.todaySessionId
                  ? `/app/session/${product.todaySessionId}`
                  : "/app/plan"
              }
            >
              Training starten
            </Link>
            <Link className="button secondary" href="/app/calendar">
              <CalendarDays size={17} />
              Kalender
            </Link>
          </div>
        </section>

        {busy ? (
          <div className="coach-message assistant">
            <span className="coach-avatar">D</span>
            <div className="typing-indicator" aria-label="DogOS antwortet">
              <i /> <i /> <i />
            </div>
          </div>
        ) : null}
        {error === undefined ? null : (
          <p className="coach-error">
            Die Antwort ist fehlgeschlagen. Deine Nachricht bleibt erhalten.
          </p>
        )}
      </div>

      {!hasHistory ? (
        <div className="coach-suggestions">
          <button onClick={() => submit("Was trainieren wir heute?")}>
            Heutiges Training
          </button>
          <button
            onClick={() =>
              submit(`Erkläre mir ${product.dogName}s aktuellen Plan.`)
            }
          >
            Plan erklären
          </button>
          <button
            onClick={() =>
              submit(
                `Ich möchte eine Beobachtung zu ${product.dogName} teilen.`,
              )
            }
          >
            Beobachtung teilen
          </button>
        </div>
      ) : null}

      <form
        className="coach-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Nachricht an DogOS"
          maxLength={2_000}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={`Schreib über ${product.dogName} ...`}
          rows={1}
          value={input}
        />
        {busy ? (
          <button aria-label="Antwort stoppen" onClick={stop} type="button">
            <span className="stop-square" />
          </button>
        ) : (
          <button
            aria-label="Senden"
            disabled={input.trim().length === 0}
            type="submit"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </form>
      <div className="coach-disclosure">
        <Sparkles size={12} /> KI-gestützt · keine Diagnose oder Notfallhilfe
      </div>
      <AppNavigation />
    </div>
  );
}
