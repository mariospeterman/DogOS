"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp, CircleUserRound, Sparkles } from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";

interface OnboardingConversation {
  messages: Array<{
    content: string;
    id: string;
    role: "assistant" | "user";
  }>;
  snapshot: { locale: "de-CH" | "en"; state: string };
}

function asUiMessages(conversation: OnboardingConversation): UIMessage[] {
  return conversation.messages.map((entry) => ({
    id: entry.id,
    parts: [{ text: entry.content, type: "text" as const }],
    role: entry.role,
  }));
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function OnboardingChat() {
  const [conversation, setConversation] =
    useState<OnboardingConversation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(dogosApiUrl("/v1/onboarding"), {
          cache: "no-store",
          headers: await dogosApiHeaders(),
        });
        if (response.status === 401) {
          window.location.assign("/auth/sign-in?next=/app/coach");
          return;
        }
        if (!response.ok) throw new Error("ONBOARDING_UNAVAILABLE");
        if (active)
          setConversation((await response.json()) as OnboardingConversation);
      } catch {
        if (active) setLoadError("DogOS konnte das Gespräch nicht öffnen.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  if (conversation === null)
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
        <p>{loadError ?? "DogOS wird vorbereitet"}</p>
      </div>
    );
  return (
    <OnboardingRuntime
      initialMessages={asUiMessages(conversation)}
      locale={conversation.snapshot.locale}
    />
  );
}

function OnboardingRuntime({
  initialMessages,
  locale,
}: {
  initialMessages: UIMessage[];
  locale: "de-CH" | "en";
}) {
  const [input, setInput] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => dogosApiHeaders(true),
      }),
    [],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: "owner-onboarding",
    messages: initialMessages,
    onFinish: async () => {
      const response = await fetch(dogosApiUrl("/v1/product"), {
        cache: "no-store",
        headers: await dogosApiHeaders(),
      });
      if (response.ok && (await response.json()).status === "ready") {
        window.location.reload();
      }
    },
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    viewport.current?.scrollTo({
      behavior: "smooth",
      top: viewport.current.scrollHeight,
    });
  }, [messages, status]);

  async function submit() {
    const value = input.trim();
    if (value.length === 0 || busy) return;
    setInput("");
    await sendMessage({ text: value });
  }

  return (
    <div className="coach-shell onboarding-shell">
      <header className="coach-header">
        <div className="coach-identity">
          <span className="coach-mark">D</span>
          <div>
            <strong>DogOS</strong>
            <span>
              <i />{" "}
              {locale === "de-CH" ? "lernt euch kennen" : "getting to know you"}
            </span>
          </div>
        </div>
        <Link className="icon-link" href="/app/account" aria-label="Konto">
          <CircleUserRound size={21} />
        </Link>
      </header>

      <div className="onboarding-progress" aria-label="Onboarding progress">
        <span />
        <small>
          {locale === "de-CH"
            ? "Profil und Trainingsziel"
            : "Profile and training goal"}
        </small>
      </div>

      <div className="coach-messages" ref={viewport} aria-live="polite">
        {messages.map((message) => {
          const text = textOf(message);
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
        {busy ? (
          <div className="coach-message assistant">
            <span className="coach-avatar">D</span>
            <div className="typing-indicator" aria-label="DogOS antwortet">
              <i />
              <i />
              <i />
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="coach-error">
            Die Antwort ist fehlgeschlagen. Versuch es noch einmal.
          </p>
        ) : null}
      </div>

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
          placeholder={
            locale === "de-CH"
              ? "Erzähl von deinem Hund ..."
              : "Tell me about your dog ..."
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
        <Sparkles size={12} /> KI-gestützt · keine Diagnose oder Notfallhilfe
      </div>
    </div>
  );
}
