"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  CalendarDays,
  CircleUserRound,
  Clock3,
  History,
  Search,
  Route,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";
import type { ProductDashboard } from "../lib/product";
import { trainingPresentation } from "../lib/training-presentation";

interface PersistedConversation {
  id: string;
  locale: "de-CH" | "en";
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
  const [conversation, setConversation] =
    useState<PersistedConversation | null>(null);
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
        if (active) setConversation(conversation);
      } catch {
        if (active) setLoadError("Der Coach konnte nicht geladen werden.");
      }
    })();
    return () => {
      active = false;
    };
  }, [product.dogId]);

  if (conversation === null) {
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
        <p>{loadError ?? "Gespräch wird geladen"}</p>
      </div>
    );
  }
  return (
    <CoachRuntime
      initialMessages={toUiMessages(conversation)}
      locale={conversation.locale}
      product={product}
    />
  );
}

function CoachRuntime({
  initialMessages,
  locale,
  product,
}: {
  initialMessages: UIMessage[];
  locale: "de-CH" | "en";
  product: ProductDashboard;
}) {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const deepLinkSent = useRef(false);
  const activeSpace = searchParams.get("space") ?? "coach";
  const contextKind =
    activeSpace === "plan"
      ? "plan"
      : activeSpace === "progress"
        ? "progress"
        : activeSpace === "train"
          ? "session"
          : activeSpace === "media"
            ? "media"
            : "general";
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { contextKind, dogId: product.dogId },
        headers: () => dogosApiHeaders(true),
      }),
    [contextKind, product.dogId],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: `dog:${product.dogId}`,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const presentation = trainingPresentation(product, locale);
  const english = locale === "en";
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

  useEffect(() => {
    if (deepLinkSent.current) return;
    const url = new URL(window.location.href);
    const prompt = url.searchParams.get("prompt")?.trim();
    if (prompt === undefined || prompt.length === 0) return;
    deepLinkSent.current = true;
    url.searchParams.delete("prompt");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    void sendMessage({ text: prompt.slice(0, 500) });
  }, [sendMessage]);

  async function submit(text = input) {
    const value = text.trim();
    if (value.length === 0 || busy) return;
    setInput("");
    await sendMessage({ text: value });
  }

  const hasHistory = messages.length > 0;
  const spaces = [
    {
      href: "/app/coach?space=coach",
      id: "coach",
      label: "Coach",
      icon: Sparkles,
    },
    { href: "/app/coach?space=plan", id: "plan", label: "Plan", icon: Route },
    {
      href: "/app/coach?space=train",
      id: "train",
      label: english ? "Train" : "Training",
      icon: Clock3,
    },
    {
      href: "/app/coach?space=progress",
      id: "progress",
      label: english ? "Progress" : "Fortschritt",
      icon: Target,
    },
    {
      href: "/app/coach?space=media",
      id: "media",
      label: "Video",
      icon: Video,
    },
  ] as const;
  return (
    <div className="coach-shell">
      <header className="coach-header">
        <div className="coach-identity">
          <span className="coach-mark">D</span>
          <div>
            <strong>DogOS</strong>
            <span>
              <i />{" "}
              {english
                ? `${product.dogName}'s Coach`
                : `${product.dogName}s Coach`}
            </span>
          </div>
        </div>
        <Link
          className="icon-link"
          href="/app/account/history"
          aria-label={english ? "History" : "Verlauf"}
        >
          <History size={20} />
        </Link>
        <Link
          className="icon-link"
          href="/app/account"
          aria-label={english ? "Account" : "Konto"}
        >
          <CircleUserRound size={21} />
        </Link>
      </header>

      <div className="coach-context-bar">
        <Link href="/app/coach?space=plan">
          <Route size={16} />
          <span>
            <small>{english ? "Active goal" : "Aktives Ziel"}</small>
            {product.goalText}
          </span>
        </Link>
        <Link href="/app/coach?space=progress">
          <Target size={16} />
          <span>
            <small>{english ? "Milestone" : "Etappe"}</small>
            {product.baselineSuccessRate}% → {product.targetSuccessRate ?? 80}%
          </span>
        </Link>
      </div>

      <nav className="workspace-tabs" aria-label="Produktnavigation">
        {spaces.map(({ href, icon: Icon, id, label }) => (
          <Link
            aria-current={activeSpace === id ? "page" : undefined}
            href={href}
            key={id}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
        <Link
          href="/app/account/history"
          title={english ? "Search history" : "Verlauf suchen"}
        >
          <Search size={17} />
          <span>{english ? "Search" : "Suche"}</span>
        </Link>
        <Link href="/app/account">{english ? "Account" : "Konto"}</Link>
      </nav>

      <div className="coach-messages" ref={viewport} aria-live="polite">
        {!hasHistory ? (
          <div className="coach-welcome">
            <span className="coach-avatar">D</span>
            <div className="message-bubble assistant">
              <p>
                {english
                  ? `I coach you and ${product.dogName} through the training. Tell me what happened today or what you want to improve next.`
                  : `Ich begleite dich und ${product.dogName} im Training. Erzähl mir, was heute passiert ist oder was du als Nächstes verbessern möchtest.`}
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
            <span>
              {english
                ? `Today with ${product.dogName}`
                : `Heute mit ${product.dogName}`}
            </span>
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
                  ? `/app/coach?space=train&session=${product.todaySessionId}`
                  : "/app/coach?space=plan"
              }
            >
              {english ? "Start training" : "Training starten"}
            </Link>
            <Link className="button secondary" href="/app/coach?space=train">
              <CalendarDays size={17} />
              {english ? "Calendar" : "Kalender"}
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
            {english ? "Today's training" : "Heutiges Training"}
          </button>
          <button
            onClick={() =>
              submit(
                english
                  ? `Explain ${product.dogName}'s current plan.`
                  : `Erkläre mir ${product.dogName}s aktuellen Plan.`,
              )
            }
          >
            {english ? "Explain plan" : "Plan erklären"}
          </button>
          <button
            onClick={() =>
              submit(
                english
                  ? `I want to share an observation about ${product.dogName}.`
                  : `Ich möchte eine Beobachtung zu ${product.dogName} teilen.`,
              )
            }
          >
            {english ? "Share observation" : "Beobachtung teilen"}
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
          aria-label={english ? "Message DogOS" : "Nachricht an DogOS"}
          maxLength={2_000}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={
            english
              ? `Write about ${product.dogName} ...`
              : `Schreib über ${product.dogName} ...`
          }
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
        <Sparkles size={12} />{" "}
        {english
          ? "AI-assisted · not diagnosis or emergency care"
          : "KI-gestützt · keine Diagnose oder Notfallhilfe"}
      </div>
    </div>
  );
}
