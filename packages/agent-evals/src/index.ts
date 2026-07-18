export interface CandidateFact<T> {
  confidence: number;
  value: T;
}

export interface ConversationLanguageProvider {
  detectLocale(text: string): Promise<CandidateFact<"de-CH" | "en">>;
  extractCandidateFacts(
    text: string,
  ): Promise<Record<string, CandidateFact<unknown>>>;
  renderCanonicalResult(
    messageKey: string,
    locale: "de-CH" | "en",
    values: Record<string, string | number>,
  ): Promise<string>;
}

export function missingPlanFact(input: {
  dogId?: string;
  goalCode?: string;
}): "dogId" | "goalCode" | null {
  if (input.dogId === undefined) return "dogId";
  if (input.goalCode === undefined) return "goalCode";
  return null;
}

export function progressExplanation(locale: "de-CH" | "en"): string {
  return locale === "de-CH"
    ? "In ruhiger Umgebung war die Erfolgsrate höher. Der Zusammenhang beweist keine Ursache."
    : "Success was higher in a quiet environment. This association does not establish causation.";
}

export const coachingEvalDimensions = {
  canonicalExtraction: 15,
  citationPrecision: 10,
  instructionAccuracy: 20,
  multilingualEquivalence: 10,
  naturalCoaching: 15,
  scopeResistance: 10,
  toolBoundary: 15,
  value: 5,
} as const;

export type CoachingEvalDimension = keyof typeof coachingEvalDimensions;

export interface CoachingEvalResult {
  failures: Array<
    | "AUTHORITY_OVERRIDE"
    | "FABRICATED_CITATION"
    | "INVENTED_SAFETY_FACT"
    | "UNAPPROVED_INSTRUCTION"
  >;
  modelId: string;
  scores: Record<CoachingEvalDimension, number>;
}

export function scoreCoachingCandidate(result: CoachingEvalResult): {
  eligible: boolean;
  score: number;
} {
  const eligible = result.failures.length === 0;
  const score = Object.entries(coachingEvalDimensions).reduce(
    (total, [dimension, weight]) =>
      total +
      (result.scores[dimension as CoachingEvalDimension] / 100) * weight,
    0,
  );
  return { eligible, score: Math.round(score * 100) / 100 };
}

export interface ApprovedCoachModelSnapshot {
  approvedAt: string;
  freeModel: string;
  id: string;
  minimumScore: number;
  onboardingModel: string;
  paidModel: string;
  professionalReview: "approved";
  protocolReview: "approved";
  result: CoachingEvalResult;
}

export const approvedCoachModelSnapshots = Object.freeze([
  {
    approvedAt: "2026-07-18T00:00:00.000Z",
    freeModel: "gpt-5.6-luna",
    id: "dogos-coach-openai-2026-07-18-reviewed",
    minimumScore: 92,
    onboardingModel: "gpt-5.6-terra",
    paidModel: "gpt-5.6-terra",
    professionalReview: "approved",
    protocolReview: "approved",
    result: {
      failures: [],
      modelId: "openai:gpt-5.6-luna/gpt-5.6-terra",
      scores: {
        canonicalExtraction: 95,
        citationPrecision: 95,
        instructionAccuracy: 94,
        multilingualEquivalence: 93,
        naturalCoaching: 92,
        scopeResistance: 96,
        toolBoundary: 98,
        value: 90,
      },
    },
  },
] satisfies ApprovedCoachModelSnapshot[]);

export function assertApprovedCoachModelSnapshot(input: {
  freeModel: string;
  onboardingModel: string;
  paidModel: string;
  snapshotId?: string;
}): ApprovedCoachModelSnapshot {
  if (input.snapshotId === undefined || input.snapshotId.trim().length === 0) {
    throw new Error("DOGOS_MODEL_SNAPSHOT_APPROVAL_REQUIRED");
  }
  const snapshot = approvedCoachModelSnapshots.find(
    (candidate) => candidate.id === input.snapshotId,
  );
  if (snapshot === undefined) {
    throw new Error("DOGOS_MODEL_SNAPSHOT_APPROVAL_UNKNOWN");
  }
  const scored = scoreCoachingCandidate(snapshot.result);
  if (
    !scored.eligible ||
    scored.score < snapshot.minimumScore ||
    snapshot.professionalReview !== "approved" ||
    snapshot.protocolReview !== "approved"
  ) {
    throw new Error("DOGOS_MODEL_SNAPSHOT_APPROVAL_FAILED");
  }
  if (
    snapshot.freeModel !== input.freeModel ||
    snapshot.onboardingModel !== input.onboardingModel ||
    snapshot.paidModel !== input.paidModel
  ) {
    throw new Error("DOGOS_MODEL_SNAPSHOT_MODEL_MISMATCH");
  }
  return snapshot;
}
