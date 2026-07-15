import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  isoDateSchema,
  isoTimestampSchema,
} from "./common.js";

export const breedContextSchema = z.strictObject({
  status: z.enum(["known", "mixed", "unknown"]),
  breeds: z.array(
    z.strictObject({
      breedCode: canonicalCodeSchema,
      source: z.enum(["owner_report", "verified_registry", "unknown"]),
      confidence: z.number().min(0).max(1),
    }),
  ),
  sourcedPhysicalConstraintCodes: z.array(canonicalCodeSchema).default([]),
});

export const dogProfileSchema = z.strictObject({
  id: entityIdSchema,
  birthDateEstimate: isoDateSchema.nullable(),
  developmentStage: z.enum([
    "puppy",
    "adolescent",
    "adult",
    "senior",
    "unknown",
  ]),
  sex: z.enum(["female", "male", "intersex", "unknown"]),
  neuterStatus: z.enum(["neutered", "intact", "unknown"]),
  weightKg: z.number().positive().nullable(),
  breedContext: breedContextSchema,
});

export const healthContextSchema = z.strictObject({
  reportedConditionCodes: z.array(canonicalCodeSchema),
  medicationCodes: z.array(canonicalCodeSchema),
  suspectedPain: z.boolean().nullable(),
  suddenBehaviorChange: z.boolean().nullable(),
  physicalConstraintCodes: z.array(canonicalCodeSchema),
  evidenceIds: z.array(entityIdSchema),
});

export const householdContextSchema = z.strictObject({
  childrenPresent: z.boolean().nullable(),
  otherAnimalCodes: z.array(canonicalCodeSchema),
  environmentCode: canonicalCodeSchema.nullable(),
  availableEquipmentCodes: z.array(canonicalCodeSchema),
  managementConstraintCodes: z.array(canonicalCodeSchema),
});

export const ownerProfileSchema = z.strictObject({
  experienceLevel: z.enum(["first_time", "some", "experienced", "unknown"]),
  availableMinutesPerDay: z.number().int().nonnegative().nullable(),
  capabilityCodes: z.array(canonicalCodeSchema),
  accessibilityConstraintCodes: z.array(canonicalCodeSchema),
  confidence: z.number().int().min(1).max(5).nullable(),
});

const answeredAnamnesisAnswerSchema = z
  .strictObject({
    state: z.literal("answered"),
    questionCode: canonicalCodeSchema,
    questionVersion: z.number().int().positive(),
    canonicalAnswerCode: canonicalCodeSchema.optional(),
    value: z
      .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
      .optional(),
    evidenceId: entityIdSchema,
  })
  .refine(
    (answer) =>
      answer.canonicalAnswerCode !== undefined || answer.value !== undefined,
    {
      message: "answered anamnesis values require canonicalAnswerCode or value",
    },
  );

const unavailableAnamnesisAnswerSchema = z.strictObject({
  state: z.enum(["unknown", "refused", "not_applicable"]),
  questionCode: canonicalCodeSchema,
  questionVersion: z.number().int().positive(),
  unknownReason: canonicalCodeSchema,
  evidenceId: entityIdSchema,
});

export const anamnesisAnswerSchema = z.union([
  answeredAnamnesisAnswerSchema,
  unavailableAnamnesisAnswerSchema,
]);

export const behaviorConcernSchema = z.strictObject({
  id: entityIdSchema,
  concernCode: canonicalCodeSchema,
  triggerCodes: z.array(canonicalCodeSchema),
  frequencyCode: canonicalCodeSchema.nullable(),
  intensity: z.number().int().min(1).max(5).nullable(),
  evidenceIds: z.array(entityIdSchema),
});

export const safetyEventSchema = z.strictObject({
  id: entityIdSchema,
  eventCode: z.enum([
    "safety.bite",
    "safety.snap",
    "safety.injury",
    "safety.escape",
    "safety.child_involved",
    "safety.uncontrolled_aggression",
    "safety.severe_fear_or_panic",
  ]),
  occurredAt: isoTimestampSchema.nullable(),
  recency: z.enum(["recent", "historical", "unknown"]),
  severity: z.number().int().min(1).max(5).nullable(),
  childInvolved: z.boolean().nullable(),
  injuryOccurred: z.boolean().nullable(),
  evidenceIds: z.array(entityIdSchema),
});

export const anamnesisSchema = z.strictObject({
  id: entityIdSchema,
  version: z.number().int().positive(),
  completed: z.boolean(),
  answers: z.array(anamnesisAnswerSchema),
  behaviorConcerns: z.array(behaviorConcernSchema),
  safetyEvents: z.array(safetyEventSchema),
});

export const sessionContextSchema = z.strictObject({
  sessionId: entityIdSchema,
  occurredAt: isoTimestampSchema,
  environmentCode: canonicalCodeSchema,
  distractionLevel: z.number().int().min(0).max(5).nullable(),
  triggerDistanceM: z.number().nonnegative().nullable(),
  sleepStatusCode: canonicalCodeSchema.nullable(),
  foodAccepted: z.boolean().nullable(),
  handlerConfidence: z.number().int().min(1).max(5).nullable(),
  exerciseTypeCode: canonicalCodeSchema.nullable(),
  durationSeconds: z.number().int().positive().nullable(),
});

export type BreedContext = z.infer<typeof breedContextSchema>;
export type DogProfile = z.infer<typeof dogProfileSchema>;
export type HealthContext = z.infer<typeof healthContextSchema>;
export type HouseholdContext = z.infer<typeof householdContextSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
export type AnamnesisAnswer = z.infer<typeof anamnesisAnswerSchema>;
export type BehaviorConcern = z.infer<typeof behaviorConcernSchema>;
export type SafetyEvent = z.infer<typeof safetyEventSchema>;
export type Anamnesis = z.infer<typeof anamnesisSchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
