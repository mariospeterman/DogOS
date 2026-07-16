"use client";

import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { buildShareUrl } from "../lib/distribution";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DistributionActions({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  async function install() {
    if (installPrompt !== null) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    setNote(
      /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? "In Safari: Teilen und dann ‘Zum Home-Bildschirm’."
        : "Öffne das Browser-Menü und wähle ‘App installieren’.",
    );
  }

  async function share() {
    const data = {
      title: "DogOS",
      text: "Kurzes, messbares Hundetraining mit deinem Coach in WhatsApp.",
      url: buildShareUrl(window.location.origin),
    };
    if (navigator.share !== undefined) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(data.url);
      setNote("Link kopiert.");
    } catch {
      setNote("Teilen wird von diesem Browser nicht unterstützt.");
    }
  }

  return (
    <div
      className={
        compact ? "distribution-actions compact" : "distribution-actions"
      }
    >
      <button className="button secondary" onClick={install} type="button">
        <Download size={18} /> Installieren
      </button>
      <button className="button secondary" onClick={share} type="button">
        <Share2 size={18} /> Teilen
      </button>
      {note === null ? null : <p className="distribution-note">{note}</p>}
    </div>
  );
}
