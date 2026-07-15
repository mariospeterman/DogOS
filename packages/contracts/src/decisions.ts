import { z } from "zod";

import {
  canonicalCodeSchema,
  confidenceSchema,
  entityIdSchema,
  isoTimestampSchema,
  semanticVersionSchema,
} from "./common.js";
import { metricCodeSchema } from "./measurement.js";
import { caveatCodeSchema, reasonCodeSchema } from "./reason-codes.js";

export const safetyDispositionSchema = z.enum([
  "continue_low_risk_training",
  "require_more_information",
  "require_trainer_review",
  "require_veterinary_review",
  "stop_training",
  "urgent_safety_message",
]);

export const riskAssessmentSchema = z.strictObject({
  riskLevel: z.enum(["unknown", "low", "moderate", "high", "urgent"]),
  disposition: safetyDispositionSchema,
  triggeredRuleIds: z.array(canonicalCodeSchema),
  reasonCodes: z.array(reasonCodeSchema),
  evidenceIds: z.array(entityIdSchema),
  prohibitedActionCodes: z.array(canonicalCodeSchema),
  requiredQuestionCodes: z.array(canonicalCodeSchema),
  permittedNextActionCodes: z.array(canonicalCodeSchema),
  ruleSetId: entityIdSchema,
  ruleSetVersion: semanticVersionSchema,
});

export const progressDimensionSchema = z.strictObject({
  dimensionCode: z.enum([
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
  ]),
  status: z.enum([
    "unavailable",
    "below",
    "stable",
    "improving",
    "met",
    "worsening",
  ]),
  value: z.number().nullable(),
  evidenceIds: z.array(entityIdSchema),
  reasonCodes: z.array(reasonCodeSchema),
});

export const progressEvaluationSchema = z.strictObject({
  status: z.enum([
    "insufficient_data",
    "stable",
    "improving",
    "regressing",
    "mixed",
    "requires_review",
  ]),
  dimensions: z.array(progressDimensionSchema),
  evidenceIds: z.array(entityIdSchema),
  missingMetricCodes: z.array(metricCodeSchema),
  confidence: confidenceSchema,
  reasonCodes: z.array(reasonCodeSchema),
  candidateNextAction: z.enum([
    "continue_plan",
    "repeat_step",
    "reduce_difficulty",
    "increase_difficulty",
    "ask_for_information",
    "require_professional_review",
  ]),
  engineVersion: semanticVersionSchema,
  ruleSetId: entityIdSchema,
  ruleSetVersion: semanticVersionSchema,
});

export const correlationObservationSchema = z.strictObject({
  factorCode: canonicalCodeSchema,
  outcomeMetric: metricCodeSchema,
  direction: z.enum(["higher", "lower"]),
  sampleCount: z.number().int().positive(),
  supportingCount: z.number().int().nonnegative(),
  contradictingCount: z.number().int().nonnegative(),
  supportingSessionIds: z.array(entityIdSchema),
  contradictingSessionIds: z.array(entityIdSchema),
  observedFrom: isoTimestampSchema,
  observedUntil: isoTimestampSchema,
  confidence: confidenceSchema,
  caveatCodes: z.array(caveatCodeSchema).min(1),
});

export const adjustmentDecisionSchema = z.enum([
  "continue_plan",
  "repeat_step",
  "reduce_difficulty",
  "increase_difficulty",
  "train_prerequisite",
  "schedule_rest",
  "ask_for_information",
  "require_professional_review",
  "stop_training",
]);

export const professionalDispositionSchema = z.strictObject({
  type: z.enum([
    "none",
    "trainer_review",
    "veterinary_review",
    "urgent_support",
  ]),
  reasonCodes: z.array(reasonCodeSchema),
  urgency: z.enum(["none", "routine", "prompt", "urgent"]),
});

export const planAdjustmentSchema = z.strictObject({
  decision: adjustmentDecisionSchema,
  previousPlanVersion: z.number().int().positive(),
  proposedDifficulty: z.number().int().min(1).max(10).nullable(),
  proposedStepCode: canonicalCodeSchema.nullable(),
  evidenceIds: z.array(entityIdSchema),
  triggeredRuleIds: z.array(canonicalCodeSchema),
  reasonCodes: z.array(reasonCodeSchema),
  requiredQuestionCodes: z.array(canonicalCodeSchema),
  professionalDisposition: professionalDispositionSchema,
  newPlanVersionRequired: z.boolean(),
});

export type SafetyDisposition = z.infer<typeof safetyDispositionSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type ProgressEvaluation = z.infer<typeof progressEvaluationSchema>;
export type ProgressDimension = z.infer<typeof progressDimensionSchema>;
export type CorrelationObservation = z.infer<
  typeof correlationObservationSchema
>;
export type PlanAdjustment = z.infer<typeof planAdjustmentSchema>;
export type ProfessionalDisposition = z.infer<
  typeof professionalDispositionSchema
>;
export type AdjustmentDecision = z.infer<typeof adjustmentDecisionSchema>;
