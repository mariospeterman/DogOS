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
        if (!response.ok) throw new Error("PRODUCT_UNAVAILABLE");
        const body = (await response.json()) as
          ProductDashboard | { status: "onboarding_required" };
        if (!active) return;
        setProduct(body.status === "ready" ? body : null);
      } catch {
        if (active) setError("DogOS konnte die Trainingsdaten nicht laden.");
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
