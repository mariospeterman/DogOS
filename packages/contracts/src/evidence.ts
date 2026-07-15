import { z } from "zod";

import {
  canonicalCodeSchema,
  confidenceSchema,
  entityIdSchema,
  evidenceQualitySchema,
  isoTimestampSchema,
} from "./common.js";
import { measurementSchema } from "./measurement.js";

export const ownerCheckinSchema = z.strictObject({
  id: entityIdSchema,
  sessionId: entityIdSchema,
  difficulty: z.number().int().min(1).max(5).nullable(),
  confidence: z.number().int().min(1).max(5).nullable(),
  perceivedOutcomeCode: canonicalCodeSchema.nullable(),
  concernCodes: z.array(canonicalCodeSchema),
  evidenceId: entityIdSchema,
});

export const observationCodeSchema = z.enum([
  "observation.food_refused",
  "observation.moved_away_from_trigger",
  "observation.cue_repeated",
  "observation.owner_reported_nervousness",
  "observation.avoidance_indicator",
  "observation.engaged_with_handler",
]);

export const observationSchema = z.strictObject({
  id: entityIdSchema,
  sessionId: entityIdSchema.nullable(),
  observationCode: observationCodeSchema,
  value: z.union([z.number(), z.boolean(), z.string()]),
  source: z.enum(["owner_report", "trainer_report", "system", "future_video"]),
  confidence: z.number().min(0).max(1),
  observedAt: isoTimestampSchema,
  evidenceIds: z.array(entityIdSchema),
  unsupportedInferenceCodes: z.array(canonicalCodeSchema),
});

export const prohibitedHypothesisCodes = [
  "hypothesis.clinical_anxiety",
  "hypothesis.trauma",
  "hypothesis.depression",
  "hypothesis.dominance",
  "hypothesis.medical_pain_diagnosis",
] as const;

export const allowedHypothesisCodeSchema = z.enum([
  "hypothesis.reduced_training_tolerance",
  "hypothesis.possible_environmental_overload",
  "hypothesis.possible_handler_timing_issue",
  "hypothesis.insufficient_evidence",
]);

export const hypothesisSchema = z.strictObject({
  id: entityIdSchema,
  hypothesisCode: allowedHypothesisCodeSchema,
  supportingEvidenceIds: z.array(entityIdSchema),
  contradictingEvidenceIds: z.array(entityIdSchema),
  confidence: confidenceSchema,
  excludedClaimCodes: z.array(canonicalCodeSchema),
  reviewStatus: z.enum([
    "unreviewed",
    "trainer_review_required",
    "reviewed",
    "rejected",
  ]),
});

export const dataQualityAssessmentSchema = z.strictObject({
  completeness: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  reliability: z.number().min(0).max(1),
  overall: evidenceQualitySchema,
  reasonCodes: z.array(canonicalCodeSchema),
  assessedAt: isoTimestampSchema,
});

export const sessionEvidenceSchema = z.strictObject({
  sessionId: entityIdSchema,
  completedAt: isoTimestampSchema,
  measurements: z.array(measurementSchema),
  ownerCheckin: ownerCheckinSchema.nullable(),
  observations: z.array(observationSchema),
});

export type OwnerCheckin = z.infer<typeof ownerCheckinSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export type DataQualityAssessment = z.infer<typeof dataQualityAssessmentSchema>;
export type SessionEvidence = z.infer<typeof sessionEvidenceSchema>;
