"use client";

import { ArrowUpRight, CreditCard } from "lucide-react";
import { useState } from "react";
import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";

export function BillingActions({ tier }: { tier: string }) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function open(path: string, body: object, operation: string) {
    setPending(operation);
    setMessage(null);
    try {
      const response = await fetch(dogosApiUrl(path), {
        body: JSON.stringify(body),
        headers: await dogosApiHeaders(true),
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: { message?: string };
        url?: string;
      };
      if (!response.ok || result.url === undefined) {
        throw new Error(
          result.error?.message ??
            "Abrechnung ist im Pilot noch nicht aktiviert.",
        );
      }
      window.location.assign(result.url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Abrechnung ist im Pilot noch nicht aktiviert.",
      );
      setPending(null);
    }
  }

  if (tier !== "freemium") {
    return (
      <section className="billing-actions">
        <div>
          <strong>Tarif verwalten</strong>
          <span>Zahlungsmittel, Rechnungen und Kündigung bei Stripe.</span>
        </div>
        <button
          className="button secondary"
          disabled={pending !== null}
          onClick={() => void open("/v1/billing/portal", {}, "portal")}
        >
          <CreditCard size={18} /> Verwalten
        </button>
        {message ? <p className="error-note">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="billing-actions">
      <div>
        <strong>Mehr Analyse, nicht mehr Ablenkung</strong>
        <span>Wähle den Umfang passend zu Training und Videoeinsatz.</span>
      </div>
      <div className="tier-actions">
        {(["plus", "pro", "ultra"] as const).map((nextTier) => (
          <button
            className={
              nextTier === "plus" ? "button primary" : "button secondary"
            }
            disabled={pending !== null}
            key={nextTier}
            onClick={() =>
              void open("/v1/billing/checkout", { tier: nextTier }, nextTier)
            }
          >
            {nextTier[0]!.toUpperCase() + nextTier.slice(1)}
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {message ? <p className="error-note">{message}</p> : null}
    </section>
  );
}
