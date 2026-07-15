import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  isoTimestampSchema,
  semanticVersionSchema,
} from "./common.js";
import { metricCodeSchema } from "./measurement.js";
import { reasonCodeSchema } from "./reason-codes.js";

export const knowledgeClaimSchema = z.strictObject({
  id: entityIdSchema,
  claimCode: canonicalCodeSchema,
  version: z.number().int().positive(),
  fact: z.record(z.string(), z.unknown()),
  evidenceLevel: z.enum([
    "verified_fact",
    "professional_consensus",
    "pending_professional_review",
    "product_assumption",
  ]),
  sourceIds: z.array(entityIdSchema),
  valid: z.boolean(),
});

export const protocolApprovalSchema = z.strictObject({
  status: z.enum(["unapproved", "approved", "expired"]),
  approvedAt: isoTimestampSchema.nullable(),
  expiresAt: isoTimestampSchema.nullable(),
  jurisdictions: z.array(z.string().length(2)),
  releaseChannels: z.array(canonicalCodeSchema),
});

export const protocolRequirementSchema = z.strictObject({
  code: canonicalCodeSchema,
  type: z.enum([
    "capability",
    "equipment",
    "environment",
    "baseline_metric",
    "development_stage",
    "physical_constraint_absent",
  ]),
  valueCode: canonicalCodeSchema.optional(),
  metricCode: metricCodeSchema.optional(),
});

export const protocolExclusionSchema = z.strictObject({
  code: canonicalCodeSchema,
  type: z.enum([
    "safety_disposition",
    "health_constraint",
    "behavior_concern",
    "environment",
  ]),
  valueCode: canonicalCodeSchema,
});

export const protocolStepDefinitionSchema = z.strictObject({
  stepCode: canonicalCodeSchema,
  sequence: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  repetitions: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(10),
  measurementCodes: z.array(metricCodeSchema).min(1),
  prerequisiteStepCodes: z.array(canonicalCodeSchema),
  stopConditionCodes: z.array(canonicalCodeSchema),
});

export const progressionRuleSchema = z.strictObject({
  ruleId: canonicalCodeSchema,
  metricCode: metricCodeSchema,
  operator: z.enum(["gte", "lte"]),
  threshold: z.number(),
  consecutiveSessions: z.number().int().positive(),
});

export const regressionRuleSchema = z.strictObject({
  ruleId: canonicalCodeSchema,
  metricCode: metricCodeSchema,
  operator: z.enum(["eq", "gte", "lte"]),
  threshold: z.union([z.number(), z.boolean()]),
});

export const trainingProtocolSchema = z.strictObject({
  id: entityIdSchema,
  protocolCode: canonicalCodeSchema,
  goalFamily: canonicalCodeSchema,
});

export const protocolVersionSchema = z.strictObject({
  id: entityIdSchema,
  protocolId: entityIdSchema,
  protocolCode: canonicalCodeSchema,
  semanticVersion: semanticVersionSchema,
  goalFamily: canonicalCodeSchema,
  developmentOnly: z.boolean(),
  approval: protocolApprovalSchema,
  sourcePlaceholders: z.array(z.string().min(1)).min(1),
  prerequisites: z.array(protocolRequirementSchema),
  exclusions: z.array(protocolExclusionSchema),
  requiredBaselineMetrics: z.array(metricCodeSchema),
  steps: z.array(protocolStepDefinitionSchema).min(1),
  progressionRules: z.array(progressionRuleSchema),
  regressionRules: z.array(regressionRuleSchema),
  stopRuleIds: z.array(canonicalCodeSchema),
  escalationRuleIds: z.array(canonicalCodeSchema),
  maximumDurationSeconds: z.number().int().positive(),
  maximumRepetitions: z.number().int().positive(),
  requiredEquipmentCodes: z.array(canonicalCodeSchema),
  supportedDevelopmentStages: z.array(
    z.enum(["puppy", "adolescent", "adult", "senior", "unknown"]),
  ),
  supportedEnvironmentCodes: z.array(canonicalCodeSchema),
  ruleSetVersion: semanticVersionSchema.nullable(),
  safetyCriticalPresentation: z.boolean(),
  releasedLocales: z.array(z.string().min(2)),
});

export const protocolEligibilitySchema = z.strictObject({
  protocolVersionId: entityIdSchema,
  status: z.enum(["eligible", "blocked", "unsupported"]),
  reasonCodes: z.array(reasonCodeSchema),
  satisfiedRequirementCodes: z.array(canonicalCodeSchema),
  missingRequirementCodes: z.array(canonicalCodeSchema),
  triggeredExclusionCodes: z.array(canonicalCodeSchema),
  evidenceIds: z.array(entityIdSchema),
});

export const ruleSchema = z.strictObject({
  ruleId: canonicalCodeSchema,
  priority: z.number().int().nonnegative(),
  reasonCode: reasonCodeSchema,
});

export const ruleSetSchema = z.strictObject({
  id: entityIdSchema,
  ruleSetCode: canonicalCodeSchema,
  version: semanticVersionSchema,
  developmentOnly: z.boolean(),
  rules: z.array(ruleSchema),
});

export const ruleEvaluationSchema = z.strictObject({
  ruleId: canonicalCodeSchema,
  matched: z.boolean(),
  reasonCode: reasonCodeSchema.nullable(),
  evidenceIds: z.array(entityIdSchema),
});

export type KnowledgeClaim = z.infer<typeof knowledgeClaimSchema>;
export type TrainingProtocol = z.infer<typeof trainingProtocolSchema>;
export type ProtocolVersion = z.infer<typeof protocolVersionSchema>;
export type ProtocolEligibility = z.infer<typeof protocolEligibilitySchema>;
export type RuleSet = z.infer<typeof ruleSetSchema>;
export type RuleEvaluation = z.infer<typeof ruleEvaluationSchema>;
export type ProtocolRequirement = z.infer<typeof protocolRequirementSchema>;
export type ProtocolExclusion = z.infer<typeof protocolExclusionSchema>;
export type ProtocolStepDefinition = z.infer<
  typeof protocolStepDefinitionSchema
>;
