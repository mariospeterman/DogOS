import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  isoTimestampSchema,
} from "./common.js";
import { measurementSchema } from "./measurement.js";

const localizedTextSchema = z.strictObject({
  "de-CH": z.string().min(1).max(240),
  en: z.string().min(1).max(240),
});

export const coachingSourceSchema = z.strictObject({
  id: entityIdSchema,
  title: z.string().min(1).max(240),
  url: z.string().url(),
  publisher: z.string().min(1).max(160),
  publicationYear: z.number().int().min(1900).max(2100).nullable(),
  reviewedAt: isoTimestampSchema,
});

export const coachingClaimSchema = z.strictObject({
  claimCode: canonicalCodeSchema,
  summary: localizedTextSchema,
  sourceIds: z.array(entityIdSchema).min(1),
  evidenceLevel: z.enum([
    "systematic_review",
    "peer_reviewed_study",
    "professional_consensus",
    "development_assumption",
  ]),
});

export const coachingMemoryFactSchema = z.strictObject({
  id: entityIdSchema,
  factCode: canonicalCodeSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  source: z.enum([
    "owner_report",
    "trainer_report",
    "system_measurement",
    "verified_profile",
  ]),
  observedAt: isoTimestampSchema,
  evidenceIds: z.array(entityIdSchema),
});

export const coachingAdvisorySchema = z.strictObject({
  code: canonicalCodeSchema,
  level: z.enum(["notice", "professional_review"]),
  affectedActivityCode: canonicalCodeSchema.nullable(),
  message: localizedTextSchema,
});

export const coachingContextCapsuleSchema = z.strictObject({
  version: z.literal("1.0"),
  generatedAt: isoTimestampSchema,
  locale: z.enum(["de-CH", "en"]),
  dog: z.strictObject({
    id: entityIdSchema,
    name: z.string().min(1).max(80),
    developmentStage: z.enum([
      "puppy",
      "adolescent",
      "adult",
      "senior",
      "unknown",
    ]),
    breedDescription: z.string().min(1).max(160),
  }),
  goal: z.strictObject({
    code: canonicalCodeSchema,
    ownerDescription: z.string().min(1).max(500),
  }),
  activeStep: z
    .strictObject({
      code: canonicalCodeSchema,
      version: z.number().int().positive(),
      durationSeconds: z.number().int().positive(),
      repetitionCap: z.number().int().positive(),
      difficulty: z.number().int().min(1).max(10),
    })
    .nullable(),
  recentMeasurements: z.array(measurementSchema).max(12),
  relevantMemory: z.array(coachingMemoryFactSchema).max(16),
  advisories: z.array(coachingAdvisorySchema).max(4),
  claims: z.array(coachingClaimSchema).max(8),
  sources: z.array(coachingSourceSchema).max(12),
  unknownFactCodes: z.array(canonicalCodeSchema).max(12),
});

export const coachingDraftSchema = z.strictObject({
  message: z.string().min(1).max(4_000),
  citedSourceIds: z.array(entityIdSchema).max(8),
  suggestedActions: z
    .array(
      z.strictObject({
        label: z.string().min(1).max(80),
        action: z.enum([
          "open_today",
          "open_plan",
          "open_progress",
          "open_session",
          "open_trainers",
          "report_observation",
        ]),
        subjectId: entityIdSchema,
      }),
    )
    .max(3),
  memoryCandidates: z
    .array(
      z.strictObject({
        factCode: canonicalCodeSchema,
        value: z.union([z.string(), z.number(), z.boolean()]),
        source: z.literal("owner_report"),
      }),
    )
    .max(6),
});

export const coachingTraceSchema = z.strictObject({
  id: entityIdSchema,
  generatedAt: isoTimestampSchema,
  provider: z.string().min(1).max(80),
  model: z.string().min(1).max(120),
  modelSnapshot: z.string().min(1).max(160),
  promptVersion: z.string().min(1).max(40),
  contextVersion: z.literal("1.0"),
  citedSourceIds: z.array(entityIdSchema).max(8),
  aiDisclosureShown: z.boolean(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative(),
});

export type CoachingSource = z.infer<typeof coachingSourceSchema>;
export type CoachingClaim = z.infer<typeof coachingClaimSchema>;
export type CoachingMemoryFact = z.infer<typeof coachingMemoryFactSchema>;
export type CoachingAdvisory = z.infer<typeof coachingAdvisorySchema>;
export type CoachingContextCapsule = z.infer<
  typeof coachingContextCapsuleSchema
>;
export type CoachingDraft = z.infer<typeof coachingDraftSchema>;
export type CoachingTrace = z.infer<typeof coachingTraceSchema>;
