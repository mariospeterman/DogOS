import {
  canonicalCodeSchema,
  entityIdSchema,
  isoTimestampSchema,
  metricCodeSchema,
  progressEvaluationSchema,
  progressionRuleSchema,
  regressionRuleSchema,
  ruleSetSchema,
  sessionEvidenceSchema,
  type Measurement,
  type MetricCode,
  type ProgressDimension,
  type ProgressEvaluation,
  type ReasonCode,
  type SessionEvidence,
} from "@dogos/contracts";
import { z } from "zod";

export const progressEvaluationInputSchema = z.strictObject({
  sessions: z.array(sessionEvidenceSchema),
  requiredMetricCodes: z.array(metricCodeSchema).min(1),
  currentDifficulty: z.number().int().min(1).max(10),
  progressionRules: z.array(progressionRuleSchema),
  regressionRules: z.array(regressionRuleSchema),
  evaluatedAt: isoTimestampSchema,
  recencyWindowDays: z.number().int().positive(),
  minimumSessions: z.number().int().positive(),
  ruleSet: ruleSetSchema,
});

export interface ProgressEvaluationInput {
  sessions: SessionEvidence[];
  requiredMetricCodes: MetricCode[];
  currentDifficulty: number;
  progressionRules: z.infer<typeof progressionRuleSchema>[];
  regressionRules: z.infer<typeof regressionRuleSchema>[];
  evaluatedAt: string;
  recencyWindowDays: number;
  minimumSessions: number;
  ruleSet: z.infer<typeof ruleSetSchema>;
}

const dimensionMetric: Partial<
  Record<ProgressDimension["dimensionCode"], MetricCode>
> = {
  goal_attainment: "metric.success_rate",
  success_rate: "metric.success_rate",
  response_latency: "metric.response_latency_ms",
  distance_or_duration: "metric.duration_seconds",
  engagement: "metric.engagement_rate",
  recovery: "metric.recovery_seconds",
  handler_execution: "metric.handler_execution_rate",
};

const dimensionCodes: ProgressDimension["dimensionCode"][] = [
  "goal_attainment",
  "consistency",
  "success_rate",
  "current_difficulty",
  "response_latency",
  "distance_or_duration",
  "engagement",
  "recovery",
  "handler_execution",
  "data_quality",
];

function knownMeasurement(
  session: SessionEvidence,
  metricCode: MetricCode,
): Measurement | undefined {
  return session.measurements.find(
    (measurement) =>
      measurement.metricCode === metricCode &&
      !measurement.unknown &&
      typeof measurement.value !== "string" &&
      measurement.value !== null,
  );
}

function numericValues(sessions: SessionEvidence[], metricCode: MetricCode) {
  return sessions.flatMap((session) => {
    const measurement = knownMeasurement(session, metricCode);
    return measurement !== undefined && typeof measurement.value === "number"
      ? [measurement.value]
      : [];
  });
}

function compare(
  value: number | boolean,
  operator: "eq" | "gte" | "lte",
  threshold: number | boolean,
) {
  if (operator === "eq") return value === threshold;
  if (typeof value !== "number" || typeof threshold !== "number") return false;
  return operator === "gte" ? value >= threshold : value <= threshold;
}

function confidenceFor(
  sessions: SessionEvidence[],
  conflict: boolean,
  missingCount: number,
  stale: boolean,
): ProgressEvaluation["confidence"] {
  const reliable = sessions.filter((session) =>
    session.measurements.some(
      (measurement) =>
        measurement.quality === "high" || measurement.quality === "moderate",
    ),
  ).length;
  if (sessions.length === 0) return "unavailable";
  if (conflict || missingCount > 0 || reliable < 2) return "low";
  if (stale) return sessions.length >= 3 ? "moderate" : "low";
  if (sessions.length >= 5 && reliable >= 4) return "high";
  return sessions.length >= 3 ? "moderate" : "low";
}

function buildDimensions(
  sessions: SessionEvidence[],
  requiredMetricCodes: MetricCode[],
  currentDifficulty: number,
  progressionMet: boolean,
  regression: boolean,
  evidenceIds: string[],
): ProgressDimension[] {
  const completeness =
    sessions.length === 0
      ? 0
      : sessions.filter((session) =>
          requiredMetricCodes.every(
            (metricCode) => knownMeasurement(session, metricCode) !== undefined,
          ),
        ).length / sessions.length;

  return dimensionCodes.map((dimensionCode) => {
    if (dimensionCode === "current_difficulty") {
      return {
        dimensionCode,
        status: "stable",
        value: currentDifficulty,
        evidenceIds,
        reasonCodes: [],
      };
    }
    if (dimensionCode === "consistency") {
      return {
        dimensionCode,
        status:
          completeness >= 0.8
            ? "met"
            : completeness > 0
              ? "below"
              : "unavailable",
        value: completeness * 100,
        evidenceIds,
        reasonCodes:
          completeness < 1 ? ["DATA_REQUIRED_METRIC_MISSING" as const] : [],
      };
    }
    if (dimensionCode === "data_quality") {
      return {
        dimensionCode,
        status:
          completeness >= 0.8
            ? "met"
            : sessions.length > 0
              ? "below"
              : "unavailable",
        value: completeness * 100,
        evidenceIds,
        reasonCodes:
          completeness < 0.8 ? ["DATA_QUALITY_INSUFFICIENT" as const] : [],
      };
    }
    const metricCode = dimensionMetric[dimensionCode];
    const values =
      metricCode === undefined ? [] : numericValues(sessions, metricCode);
    const value =
      values.length === 0
        ? null
        : values.reduce((sum, item) => sum + item, 0) / values.length;
    return {
      dimensionCode,
      status:
        value === null
          ? "unavailable"
          : regression
            ? "worsening"
            : progressionMet
              ? dimensionCode === "goal_attainment"
                ? "met"
                : "improving"
              : "stable",
      value,
      evidenceIds: value === null ? [] : evidenceIds,
      reasonCodes: [],
    };
  });
}

export function evaluateProgress(
  rawInput: ProgressEvaluationInput,
): ProgressEvaluation {
  const input = progressEvaluationInputSchema.parse(rawInput);
  const cutoff =
    new Date(input.evaluatedAt).getTime() -
    input.recencyWindowDays * 86_400_000;
  const sorted = [...input.sessions].sort(
    (left, right) =>
      left.completedAt.localeCompare(right.completedAt) ||
      left.sessionId.localeCompare(right.sessionId),
  );
  const sessions = sorted.filter(
    (session) => new Date(session.completedAt).getTime() >= cutoff,
  );
  const stale = sorted.length > 0 && sessions.length < sorted.length;
  const missingMetricCodes = input.requiredMetricCodes.filter(
    (metricCode) =>
      sessions.length === 0 ||
      sessions.some(
        (session) => knownMeasurement(session, metricCode) === undefined,
      ),
  );
  const evidenceIds = [
    ...new Set(
      sessions.flatMap((session) => [
        session.sessionId,
        ...(session.ownerCheckin === null
          ? []
          : [session.ownerCheckin.evidenceId]),
        ...session.observations.flatMap((observation) => [
          observation.id,
          ...observation.evidenceIds,
        ]),
      ]),
    ),
  ].sort();

  const conflict = sessions.some((session) => {
    const success = knownMeasurement(session, "metric.success_rate");
    return (
      session.ownerCheckin?.perceivedOutcomeCode === "outcome.poor" &&
      typeof success?.value === "number" &&
      success.value >= 80
    );
  });

  const triggeredRegressionRules = input.regressionRules.filter((rule) =>
    sessions.some((session) => {
      const measurement = knownMeasurement(session, rule.metricCode);
      return (
        measurement !== undefined &&
        typeof measurement.value !== "string" &&
        measurement.value !== null &&
        compare(measurement.value, rule.operator, rule.threshold)
      );
    }),
  );
  const successValues = numericValues(sessions, "metric.success_rate");
  const successDeclining =
    successValues.length >= 3 &&
    successValues
      .slice(-3)
      .every((value, index, values) =>
        index === 0 ? true : value < values[index - 1]!,
      );
  const progressionMet = input.progressionRules.some((rule) => {
    const values = numericValues(sessions, rule.metricCode).slice(
      -rule.consecutiveSessions,
    );
    return (
      values.length === rule.consecutiveSessions &&
      values.every((value) => compare(value, rule.operator, rule.threshold))
    );
  });

  const reasons: ReasonCode[] = [];
  if (missingMetricCodes.length > 0)
    reasons.push("DATA_REQUIRED_METRIC_MISSING");
  if (sessions.length < input.minimumSessions)
    reasons.push("DATA_QUALITY_INSUFFICIENT");
  if (conflict) reasons.push("DATA_CONFLICTING_EVIDENCE");
  if (stale) reasons.push("DATA_STALE");
  for (const rule of triggeredRegressionRules) {
    if (rule.metricCode === "metric.food_acceptance")
      reasons.push("REGRESSION_FOOD_REFUSAL");
    if (rule.metricCode === "metric.recovery_seconds")
      reasons.push("REGRESSION_RECOVERY_TOO_LONG");
  }
  if (successDeclining) reasons.push("REGRESSION_SUCCESS_RATE_DECLINING");
  if (progressionMet) reasons.push("PROGRESSION_THRESHOLD_MET");
  else if (sessions.length >= input.minimumSessions)
    reasons.push("PROGRESSION_CONSECUTIVE_SESSIONS_NOT_MET");

  const regression = triggeredRegressionRules.length > 0 || successDeclining;
  const insufficient =
    missingMetricCodes.length > 0 || sessions.length < input.minimumSessions;
  const status: ProgressEvaluation["status"] = regression
    ? progressionMet
      ? "mixed"
      : "regressing"
    : insufficient
      ? "insufficient_data"
      : conflict
        ? "requires_review"
        : progressionMet
          ? "improving"
          : "stable";

  return progressEvaluationSchema.parse({
    status,
    dimensions: buildDimensions(
      sessions,
      input.requiredMetricCodes,
      input.currentDifficulty,
      progressionMet,
      regression,
      evidenceIds,
    ),
    evidenceIds,
    missingMetricCodes: [...new Set(missingMetricCodes)].sort(),
    confidence: confidenceFor(
      sessions,
      conflict,
      missingMetricCodes.length,
      stale,
    ),
    reasonCodes: [...new Set(reasons)].sort(),
    candidateNextAction: regression
      ? "reduce_difficulty"
      : insufficient
        ? "ask_for_information"
        : conflict
          ? "require_professional_review"
          : progressionMet
            ? "increase_difficulty"
            : "repeat_step",
    engineVersion: "1.0.0",
    ruleSetId: input.ruleSet.id,
    ruleSetVersion: input.ruleSet.version,
  });
}
