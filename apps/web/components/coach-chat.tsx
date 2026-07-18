"use client";

import { useChat } from "@ai-sdk/react";
import {
  Camera,
  CircleUserRound,
  Clock3,
  CreditCard,
  History,
  Mic,
  Moon,
  Plus,
  Route,
  Send,
  Settings,
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

type TrainingActionState =
  "ready" | "not_scheduled" | "needs_information" | "stopped";

function trainingActionState(product: ProductDashboard): TrainingActionState {
  if (product.riskDisposition === "require_more_information") {
    return "needs_information";
  }
  if (product.riskDisposition !== "continue_low_risk_training") {
    return "stopped";
  }
  if (product.planStatus !== "active" || product.todaySessionId === null) {
    return "not_scheduled";
  }
  return "ready";
}

function trainingDecisionLabel(decision: string, english: boolean): string {
  if (decision === "increase_difficulty") {
    return english ? "ready for the next level" : "nächste Stufe möglich";
  }
  if (decision === "reduce_difficulty") {
    return english ? "make this easier" : "Übung vereinfachen";
  }
  if (decision === "ask_for_information") {
    return english ? "one observation missing" : "eine Beobachtung fehlt";
  }
  return english ? "repeat this level" : "aktuelle Stufe wiederholen";
}

function heldTrainingCopy(
  state: TrainingActionState,
  english: boolean,
): { label: string; status: string; title: string; body: string } {
  if (state === "needs_information") {
    return english
      ? {
          body: "DogOS needs one more observation before it shows another autonomous training start.",
          label: "Training held",
          status: "Info",
          title: "One observation is missing",
        }
      : {
          body: "DogOS braucht zuerst eine weitere Beobachtung, bevor eine neue autonome Trainingseinheit startet.",
          label: "Training pausiert",
          status: "Info",
          title: "Eine Beobachtung fehlt",
        };
  }
  if (state === "not_scheduled") {
    return english
      ? {
          body: "The plan stays visible, but there is no startable session scheduled right now.",
          label: "No session",
          status: "Plan",
          title: "Nothing scheduled yet",
        }
      : {
          body: "Der Plan bleibt sichtbar, aber aktuell ist keine startbare Einheit geplant.",
          label: "Keine Einheit",
          status: "Plan",
          title: "Noch nichts geplant",
        };
  }
  return english
    ? {
        body: "DogOS keeps the history visible, but stops autonomous training until the risk state is reviewed.",
        label: "Training stopped",
        status: "Stop",
        title: "Review before training",
      }
    : {
        body: "DogOS zeigt den Verlauf weiter, stoppt aber autonomes Training bis zur Abklärung des Risikozustands.",
        label: "Training gestoppt",
        status: "Stop",
        title: "Abklärung vor Training",
      };
}

function historyLabel(text: string, fallback: string): string {
  const first = text.replace(/\s+/g, " ").trim();
  if (first.length === 0) return fallback;
  return first.length > 42 ? `${first.slice(0, 42)}...` : first;
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
  const trainingState = trainingActionState(product);
  const trainingAllowed = trainingState === "ready";
  const historyEntries = messages
    .filter((message) => message.role === "user")
    .slice(-8)
    .reverse()
    .map((message, index) => ({
      href: `#message-${message.id}`,
      id: message.id,
      label: historyLabel(textOf(message), english ? "Conversation" : "Chat"),
      meta:
        index === 0
          ? english
            ? "Latest"
            : "Aktuell"
          : english
            ? "Coach"
            : "Coach",
    }));
  const quickActions = [
    {
      action: () =>
        submit(
          english
            ? `Explain ${product.dogName}'s current plan.`
            : `Erkläre mir ${product.dogName}s aktuellen Plan.`,
        ),
      icon: Route,
      id: "plan",
      label: "Plan",
    },
    {
      action: () =>
        trainingAllowed
          ? window.location.assign(
              `/app/coach?space=train&session=${product.todaySessionId}`,
            )
          : submit(
              english
                ? `What is blocking ${product.dogName}'s next training session?`
                : `Was blockiert ${product.dogName}s nächste Trainingseinheit?`,
            ),
      icon: Clock3,
      id: "train",
      label: english ? "Train" : "Training",
    },
    {
      action: () =>
        submit(
          english
            ? `Show ${product.dogName}'s recent progress.`
            : `Zeig mir ${product.dogName}s Fortschritt.`,
        ),
      icon: Target,
      id: "progress",
      label: english ? "Progress" : "Fortschritt",
    },
    {
      icon: Video,
      id: "live",
      label: "Live",
      action: () => window.location.assign("/app/live"),
    },
  ] as const;
  const heldCopy = heldTrainingCopy(trainingState, english);
  return (
    <div className="coach-shell" data-theme={theme}>
      <aside className="coach-sidebar" aria-label="DogOS navigation">
        <div className="sidebar-brand">
          <span className="coach-mark">D</span>
          <strong>DogOS</strong>
        </div>
        <Link className="new-chat-link" href="/app/coach">
          <Sparkles size={16} />
          {english ? "Coach chat" : "Coach Chat"}
        </Link>
        <section className="sidebar-section">
          <span>{english ? "History" : "Verlauf"}</span>
          {historyEntries.length === 0 ? (
            <p>{english ? "No messages yet" : "Noch keine Nachrichten"}</p>
          ) : (
            historyEntries.map((entry) => (
              <a href={entry.href} key={entry.id}>
                <strong>{entry.label}</strong>
                <small>{entry.meta}</small>
              </a>
            ))
          )}
        </section>
        <section className="sidebar-section">
          <span>{english ? "Training" : "Training"}</span>
          <Link href="/app/coach?space=plan">Plan</Link>
          <Link href="/app/coach?space=train">
            {english ? "Session overview" : "Einheitenübersicht"}
          </Link>
          <Link href="/app/coach?space=progress">
            {english ? "Progress" : "Fortschritt"}
          </Link>
        </section>
        <div className="sidebar-account">
          <Link href="/app/account">
            <CircleUserRound size={17} />
            {english ? "Profile" : "Profil"}
          </Link>
          <Link href="/app/account/settings">
            <Settings size={17} />
            Settings
          </Link>
          <Link href="/app/account/billing">
            <CreditCard size={17} />
            Billing
          </Link>
        </div>
      </aside>

      <main className="coach-main">
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
                {product.baselineSuccessRate}% →{" "}
                {product.targetSuccessRate ?? 80}%
              </span>
            </div>
          </div>
          <div className="coach-header-actions">
            <Link
              className="icon-link mobile-only"
              href="/app/account/history"
              aria-label={english ? "History" : "Verlauf"}
            >
              <History size={20} />
            </Link>
            <button
              aria-pressed={theme === "dark"}
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
                id={`message-${message.id}`}
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
                  ? `Why this: ${product.sessionCount} sessions; ${trainingDecisionLabel(product.latestDecision, english)}.`
                  : `Warum: ${product.sessionCount} Einheiten; ${trainingDecisionLabel(product.latestDecision, english)}.`}
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
                <span>{heldCopy.label}</span>
                <em>{heldCopy.status}</em>
                <strong>{heldCopy.title}</strong>
              </div>
              <p>{heldCopy.body}</p>
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

        <div className="composer-quick-actions" aria-label="Coach actions">
          {quickActions.map(({ action, icon: Icon, id, label }) => (
            <button
              aria-pressed={activeSpace === id}
              key={id}
              onClick={() => void action()}
              type="button"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <form
          className="coach-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Link
            aria-label={
              english ? "Upload training video" : "Trainingsvideo hochladen"
            }
            className="composer-tool"
            href="/app/video"
            title={
              english
                ? "Video analysis is available on paid plans."
                : "Videoanalyse ist in bezahlten Tarifen verfügbar."
            }
          >
            <Plus size={19} />
          </Link>
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
            aria-label={
              english ? "Voice note not available yet" : "Sprachnotiz folgt"
            }
            className="composer-tool optional"
            disabled
            title={
              english
                ? "Voice notes are not enabled in this pilot yet."
                : "Sprachnotizen sind in diesem Pilot noch nicht aktiv."
            }
            type="button"
          >
            <Mic size={18} />
          </button>
          <Link
            aria-label={
              english ? "Start live video coaching" : "Live Video starten"
            }
            className="composer-tool optional"
            href="/app/live"
            title={
              english
                ? "Live video coaching requires Pro or Ultra."
                : "Live Video Coaching erfordert Pro oder Ultra."
            }
          >
            <Camera size={18} />
          </Link>
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
      </main>
    </div>
  );
}
