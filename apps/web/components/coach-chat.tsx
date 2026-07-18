"use client";

import { useChat } from "@ai-sdk/react";
import {
  Camera,
  CircleUserRound,
  Clock3,
  History,
  Mic,
  Moon,
  Plus,
  Route,
  Send,
  Sparkles,
  Sun,
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

function presentLegacyText(text: string, locale: "de-CH" | "en"): string {
  const trainingLink =
    locale === "en" ? "Open today's training" : "Heutiges Training öffnen";
  return text
    .replace(/https?:\/\/\S+\?action=\S+/g, trainingLink)
    .replace(
      /\b(?:[a-z_]+\.)?choice\.\d+\b/g,
      locale === "en" ? "Selection saved." : "Auswahl gespeichert.",
    )
    .replace(
      /\brepeat_step\b/g,
      locale === "en"
        ? "repeat the current level"
        : "aktuelle Stufe wiederholen",
    )
    .replace(
      /\bstep\.recall_short_distance\b/g,
      locale === "en"
        ? "short recall under low distraction"
        : "kurzer Rückruf bei wenig Ablenkung",
    )
    .replace(
      /\bcontinue_low_risk_training\b/g,
      locale === "en" ? "low-risk training" : "Training mit niedrigem Risiko",
    );
}

function splitSources(text: string, locale: "de-CH" | "en") {
  const match = text.match(/\n\n(Quellen|Sources):\s*(.+)$/s);
  const body = presentLegacyText(
    match === null ? text : text.slice(0, match.index),
    locale,
  ).trim();
  const sources =
    match === null
      ? []
      : (match[2] ?? "")
          .split(/;\s*/)
          .map((item) =>
            presentLegacyText(item.replace(/^\[\d+\]\s*/, ""), locale).trim(),
          )
          .filter(Boolean);
  return { body, sources };
}

function canRenderTrainingAction(product: ProductDashboard): boolean {
  return (
    product.planStatus === "active" &&
    product.todaySessionId !== null &&
    !/review|professional|blocked|safety/i.test(product.riskDisposition)
  );
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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("dogos-theme") === "dark"
      ? "dark"
      : "light";
  });
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
  const trainingAllowed = canRenderTrainingAction(product);
  const placeholder =
    activeSpace === "plan"
      ? english
        ? `Ask about ${product.dogName}'s plan...`
        : `Frag nach ${product.dogName}s Plan...`
      : activeSpace === "train"
        ? english
          ? "Record what happened during the session..."
          : "Halte fest, was in der Einheit passiert ist..."
        : activeSpace === "progress"
          ? english
            ? "Ask about a trend or improvement..."
            : "Frag nach einem Trend oder Fortschritt..."
          : activeSpace === "media"
            ? english
              ? "Describe what was difficult in the video..."
              : "Beschreibe, was im Video schwierig war..."
            : english
              ? `Tell DogOS what happened with ${product.dogName}...`
              : `Erzähl DogOS, was mit ${product.dogName} passiert ist...`;

  useEffect(() => {
    viewport.current?.scrollTo({
      behavior: "smooth",
      top: viewport.current.scrollHeight,
    });
  }, [messages, status]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dogos-theme", theme);
  }, [theme]);

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
    <div className="coach-shell" data-theme={theme}>
      <header className="coach-header">
        <div className="coach-identity">
          <span className="coach-mark">D</span>
          <div>
            <strong>
              {english
                ? `${product.dogName}'s Coach`
                : `${product.dogName}s Coach`}
            </strong>
            <span>
              {product.goalText} · {presentation.stage} ·{" "}
              {product.baselineSuccessRate}% → {product.targetSuccessRate ?? 80}
              %
            </span>
          </div>
        </div>
        <div className="coach-header-actions">
          <Link
            className="icon-link"
            href="/app/account/history"
            aria-label={english ? "History" : "Verlauf"}
          >
            <History size={20} />
          </Link>
          <button
            className="icon-link"
            type="button"
            aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <Link
            className="icon-link"
            href="/app/account"
            aria-label={english ? "Account" : "Konto"}
          >
            <CircleUserRound size={21} />
          </Link>
        </div>
      </header>

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

        {messages.map((message, index) => {
          const text = textOf(message);
          if (text.length === 0) return null;
          const { body, sources } = splitSources(text, locale);
          const showAvatar =
            message.role === "assistant" &&
            messages[index - 1]?.role !== "assistant";
          return (
            <article
              className={`coach-message ${message.role}`}
              key={message.id}
            >
              {showAvatar ? <span className="coach-avatar">D</span> : null}
              <div
                className={
                  message.role === "assistant"
                    ? "assistant-response"
                    : "message-bubble user"
                }
              >
                {body.split("\n").map((line, index) => (
                  <p key={`${message.id}:${index}`}>{line || "\u00a0"}</p>
                ))}
                {sources.length === 0 ? null : (
                  <details className="source-disclosure">
                    <summary>
                      {english
                        ? `${sources.length} references and plan facts`
                        : `${sources.length} Referenzen und Planfakten`}
                    </summary>
                    <ul>
                      {sources.map((source, sourceIndex) => (
                        <li key={`${message.id}:source:${sourceIndex}`}>
                          {source}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </article>
          );
        })}

        {trainingAllowed ? (
          <section className="inline-training-card">
            <div className="inline-card-heading">
              <span>
                {english
                  ? `Today with ${product.dogName}`
                  : `Heute mit ${product.dogName}`}
              </span>
              <em>{english ? "Ready" : "Bereit"}</em>
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
            <small>
              {english
                ? `Why this: ${product.sessionCount} comparable sessions; repeat the current level.`
                : `Warum: ${product.sessionCount} vergleichbare Einheiten; aktuelle Stufe wiederholen.`}
            </small>
            <div className="inline-card-actions">
              <Link
                className="button primary"
                href={`/app/coach?space=train&session=${product.todaySessionId}`}
              >
                {english ? "Start training" : "Training starten"}
              </Link>
              <Link className="text-link inline" href="/app/coach?space=plan">
                {english ? "View plan" : "Plan ansehen"}
              </Link>
            </div>
          </section>
        ) : (
          <section className="inline-training-card held">
            <div className="inline-card-heading">
              <span>{english ? "Training held" : "Training pausiert"}</span>
              <em>{english ? "Review" : "Prüfung"}</em>
              <strong>
                {english
                  ? "Professional handoff first"
                  : "Zuerst fachlich abklären"}
              </strong>
            </div>
            <p>
              {english
                ? "DogOS keeps the plan visible, but does not show a session start action while autonomous training is blocked."
                : "DogOS zeigt den Plan weiter, aber keine Startaktion, solange autonomes Training blockiert ist."}
            </p>
          </section>
        )}

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
        <button
          aria-label={english ? "Add attachment" : "Anhang hinzufügen"}
          className="composer-tool"
          type="button"
        >
          <Plus size={19} />
        </button>
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
          placeholder={placeholder}
          rows={1}
          value={input}
        />
        <button
          aria-label={english ? "Voice note" : "Sprachnotiz"}
          className="composer-tool optional"
          type="button"
        >
          <Mic size={18} />
        </button>
        <button
          aria-label={english ? "Camera" : "Kamera"}
          className="composer-tool optional"
          type="button"
        >
          <Camera size={18} />
        </button>
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
            <Send size={19} />
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
