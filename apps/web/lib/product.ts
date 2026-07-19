"use client";

import { useEffect, useState } from "react";
import { dogosApiHeaders, dogosApiUrl } from "./api-client";

export interface ProductDashboard {
  baselineSuccessRate: number;
  behaviorConcernDescription?: string;
  calendar: Array<{
    durationSeconds: number;
    id: string;
    isRecovery: boolean;
    plannedStart: string;
    purposeCode: string;
    status: string;
  }>;
  currentStep: {
    difficulty: number;
    durationSeconds: number;
    repetitions: number;
    stepCode: string;
    stopConditionCodes: string[];
  } | null;
  dogId: string;
  dogName: string;
  dogProfileSummary?: string;
  goal: string;
  goalText: string;
  latestDecision: string;
  planId: string | null;
  planStatus: "active" | "blocked";
  riskDisposition: string;
  requiredConsecutiveSessions?: number;
  sessionCount: number;
  status: "ready";
  targetSuccessRate?: number;
  todaySessionId: string | null;
}

export function useProductDashboard() {
  const [product, setProduct] = useState<ProductDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(dogosApiUrl("/v1/product"), {
          cache: "no-store",
          headers: await dogosApiHeaders(),
        });
        if (response.status === 401) {
          window.location.assign(
            `/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`,
          );
          return;
        }
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(
              "DogOS konnte dein Konto nicht mit diesem Workspace verbinden. Prüfe DOGOS_AUTH_MODE und starte Web/API neu.",
            );
          }
          if (response.status === 404) {
            throw new Error(
              "DogOS hat dein Konto noch nicht vollständig vorbereitet. Lade die Seite erneut oder starte das Onboarding.",
            );
          }
          throw new Error("DogOS konnte die Trainingsdaten nicht laden.");
        }
        const body = (await response.json()) as
          ProductDashboard | { status: "onboarding_required" };
        if (!active) return;
        setProduct(body.status === "ready" ? body : null);
      } catch (caught) {
        if (active) {
          const message =
            caught instanceof Error ? caught.message : String(caught);
          setError(
            message === "Failed to fetch" || message === "fetch failed"
              ? "DogOS konnte die API nicht erreichen. Starte `pnpm dev` oder prüfe NEXT_PUBLIC_API_URL/DOGOS_INTERNAL_API_URL."
              : message,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { error, loading, product };
}
