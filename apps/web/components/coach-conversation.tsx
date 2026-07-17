"use client";

import { ArrowUp, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";
import { useProductDashboard } from "../lib/product";

interface CoachMessage {
  id: string;
  role: "user" | "assistant" | "system";
  channel: "web" | "whatsapp" | "system";
  content: string;
  contextKind: string | null;
  createdAt: string;
}

interface CoachConversation {
  id: string;
  locale: "de-CH" | "en";
  messages: CoachMessage[];
}

const contextLabels: Record<string, string> = {
  today: "Heutiger Trainingsblock",
  plan: "Aktiver Plan",
  progress: "Gemessener Fortschritt",
  session: "Trainingseinheit",
};

export function CoachConversation() {
  const {
    error: productError,
    loading: productLoading,
    product,
  } = useProductDashboard();
  const searchParams = useSearchParams();
  const contextKind = searchParams.get("context") ?? "general";
  const initialPrompt = searchParams.get("prompt") ?? "";
  const [conversation, setConversation] = useState<CoachConversation | null>(
    null,
  );
  const [message, setMessage] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef(0);

  const load = useCallback(async () => {
    if (product === null) return;
    const operation = ++operationRef.current;
    const response = await fetch(
      dogosApiUrl(
        `/v1/coach/conversation?dogId=${encodeURIComponent(product.dogId)}`,
      ),
      { headers: await dogosApiHeaders(), cache: "no-store" },
    );
    if (!response.ok) throw new Error("Coach konnte nicht geladen werden.");
    const nextConversation = (await response.json()) as CoachConversation;
    if (operation !== operationRef.current) return;
    setConversation(nextConversation);
    setError(null);
  }, [product]);

  useEffect(() => {
    load().catch((reason: unknown) =>
      setError(
        reason instanceof Error ? reason.message : "Coach nicht verfügbar.",
      ),
    );
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation?.messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending || product === null) return;
    const operation = ++operationRef.current;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(dogosApiUrl("/v1/coach/messages"), {
        method: "POST",
        headers: await dogosApiHeaders(true),
        body: JSON.stringify({
          dogId: product.dogId,
          message: text,
          contextKind,
        }),
      });
      if (!response.ok)
        throw new Error("Nachricht konnte nicht gesendet werden.");
      const result = (await response.json()) as {
        conversation: CoachConversation;
      };
      if (operation !== operationRef.current) return;
      setConversation(result.conversation);
      setMessage("");
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Nachricht fehlgeschlagen.",
      );
    } finally {
      setSending(false);
    }
  }

  const messages = conversation?.messages ?? [];
  const whatsappUrl = `${
    process.env.NEXT_PUBLIC_WHATSAPP_CHAT_URL ?? "https://wa.me/15551617622"
  }?text=${encodeURIComponent(message || `Was trainieren wir heute mit ${product?.dogName ?? "meinem Hund"}?`)}`;

  if (productLoading) {
    return <div className="coach-loading">Coach wird geladen ...</div>;
  }
  if (product === null) {
    return (
      <section className="success-panel">
        <strong>Starte mit DogOS in WhatsApp</strong>
        <p>
          {productError ?? "Dort erfassen wir zuerst deinen Hund und das Ziel."}
        </p>
        <a className="button primary" href={whatsappUrl}>
          WhatsApp öffnen
        </a>
      </section>
    );
  }

  return (
    <section className="coach-surface" aria-label="DogOS Coach">
      <div className="coach-contextbar">
        <span>
          <span className="status-dot" /> {product.dogName} · Coach aktiv
        </span>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          In WhatsApp fortsetzen <ExternalLink size={14} />
        </a>
      </div>
      <div className="coach-timeline" aria-live="polite">
        <div className="coach-day">HEUTE</div>
        <article className="coach-message assistant">
          <div className="coach-avatar">D</div>
          <div>
            <p>
              Frag mich nach {product.dogName}s heutigem Block, dem Plan oder
              dem gemessenen Fortschritt. Du kannst hier oder in WhatsApp
              weitermachen.
            </p>
            <span>DogOS Coach</span>
          </div>
        </article>
        {messages.map((entry) => (
          <article className={`coach-message ${entry.role}`} key={entry.id}>
            {entry.role === "assistant" ? (
              <div className="coach-avatar">D</div>
            ) : null}
            <div>
              <p>{entry.content}</p>
              <span>
                {entry.channel === "whatsapp" ? "WhatsApp" : "DogOS"} ·{" "}
                {new Intl.DateTimeFormat("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(entry.createdAt))}
              </span>
            </div>
          </article>
        ))}
        <div ref={endRef} />
      </div>
      <div className="coach-quick-actions" aria-label="Schnellfragen">
        {[
          "Was trainieren wir heute?",
          "Warum dieser Block?",
          "Wie ist der Fortschritt?",
        ].map((prompt) => (
          <button key={prompt} type="button" onClick={() => setMessage(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
      {contextKind !== "general" ? (
        <div className="coach-context-chip">
          <MessageCircle size={15} />{" "}
          {contextLabels[contextKind] ?? "Aktueller Kontext"}
          <Link href="/app/coach" aria-label="Kontext entfernen">
            ×
          </Link>
        </div>
      ) : null}
      {error ? (
        <button className="coach-error" type="button" onClick={() => load()}>
          {error} <RefreshCw size={14} />
        </button>
      ) : null}
      <form className="coach-composer" onSubmit={send}>
        <textarea
          aria-label="Nachricht an DogOS"
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={`Schreib DogOS über ${product.dogName} ...`}
          rows={1}
          value={message}
        />
        <button
          type="submit"
          disabled={!message.trim() || sending}
          aria-label="Senden"
        >
          <ArrowUp size={20} />
        </button>
      </form>
      <p className="coach-disclosure">
        Training und Beobachtung, keine Diagnose oder Notfallhilfe. Nachrichten
        werden nur auf ausdrückliche Aktion über WhatsApp zugestellt.
      </p>
    </section>
  );
}
