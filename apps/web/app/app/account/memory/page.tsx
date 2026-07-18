"use client";

import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../../lib/api-client";

interface MemoryFact {
  category: string;
  confidence: number;
  id: string;
  status: string;
  subject: string;
  value: string;
}

export default function MemoryPage() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch(dogosApiUrl("/v1/memory"), {
      cache: "no-store",
      headers: await dogosApiHeaders(),
    });
    if (response.ok) {
      const body = (await response.json()) as { facts: MemoryFact[] };
      setFacts(body.facts);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function post(path: string, body: object = {}) {
    const response = await fetch(dogosApiUrl(path), {
      body: JSON.stringify(body),
      headers: await dogosApiHeaders(true),
      method: "POST",
    });
    setMessage(
      response.ok ? "Gedächtnis aktualisiert." : "Aktion fehlgeschlagen.",
    );
    await load();
  }

  return (
    <AppShell title="Memory" eyebrow="Warum DogOS sich erinnert">
      <section className="settings">
        {facts.length === 0 ? (
          <div>
            <span>
              <CheckCircle2 />
              Keine gespeicherten Erinnerungen
              <small>DogOS speichert bestätigte Fakten erst nach Bedarf.</small>
            </span>
            <strong>Leer</strong>
          </div>
        ) : (
          facts.map((fact) => (
            <div key={fact.id}>
              <span>
                <CheckCircle2 />
                {fact.subject}
                <small>
                  {fact.value} · {fact.category} · {fact.status}
                </small>
              </span>
              <span className="row-actions">
                {fact.status === "candidate" ? (
                  <button
                    aria-label="Bestätigen"
                    className="icon-action"
                    onClick={() => void post(`/v1/memory/${fact.id}/confirm`)}
                  >
                    <CheckCircle2 size={17} />
                  </button>
                ) : null}
                <button
                  aria-label="Korrigieren"
                  className="icon-action"
                  onClick={() => {
                    const value = window.prompt(
                      "Korrigierter Wert",
                      fact.value,
                    );
                    if (value !== null && value.trim().length > 0) {
                      void post(`/v1/memory/${fact.id}/correct`, { value });
                    }
                  }}
                >
                  <Pencil size={17} />
                </button>
                <button
                  aria-label="Vergessen"
                  className="icon-action"
                  onClick={() => void post(`/v1/memory/${fact.id}/forget`)}
                >
                  <Trash2 size={17} />
                </button>
              </span>
            </div>
          ))
        )}
      </section>
      {message === null ? null : <p className="helper">{message}</p>}
    </AppShell>
  );
}
