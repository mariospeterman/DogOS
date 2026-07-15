import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  isoTimestampSchema,
  semanticVersionSchema,
} from "./common.js";
import { metricCodeSchema } from "./measurement.js";
import { progressionRuleSchema, regressionRuleSchema } from "./knowledge.js";
import { reasonCodeSchema } from "./reason-codes.js";

export const goalSchema = z.strictObject({
  id: entityIdSchema,
  dogId: entityIdSchema,
  canonicalGoalType: canonicalCodeSchema,
  priority: z.number().int().positive(),
  status: z.enum(["draft", "active", "achieved", "paused", "closed"]),
});

export const goalVersionSchema = z.strictObject({
  id: entityIdSchema,
  goalId: entityIdSchema,
  version: z.number().int().positive(),
  baseline: z.record(z.string(), z.unknown()),
  target: z.record(z.string(), z.unknown()),
  measurementCodes: z.array(metricCodeSchema).min(1),
  environmentCode: canonicalCodeSchema,
  horizonDays: z.number().int().positive(),
  successCriteria: z.record(z.string(), z.unknown()),
  stopConditionCodes: z.array(canonicalCodeSchema),
  escalationConditionCodes: z.array(canonicalCodeSchema),
});

export const planStepSchema = z.strictObject({
  stepCode: canonicalCodeSchema,
  sequence: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(10),
  durationSeconds: z.number().int().positive(),
  repetitions: z.number().int().positive(),
  measurementCodes: z.array(metricCodeSchema),
  prerequisiteStepCodes: z.array(canonicalCodeSchema),
  stopConditionCodes: z.array(canonicalCodeSchema),
});

export const scheduledSessionSchema = z.strictObject({
  sessionKey: z.string().min(1),
  stepCode: canonicalCodeSchema,
  plannedStart: isoTimestampSchema,
  durationSeconds: z.number().int().positive(),
  purposeCode: canonicalCodeSchema,
  recoveryDay: z.boolean(),
  observationOnly: z.boolean(),
});

export const planVersionSchema = z.strictObject({
  version: z.number().int().positive(),
  protocolVersionId: entityIdSchema,
  protocolSemanticVersion: semanticVersionSchema,
  ruleSetId: entityIdSchema,
  ruleSetVersion: semanticVersionSchema,
  generationMode: z.enum(["development", "production"]),
  generationReasonCodes: z.array(reasonCodeSchema),
  steps: z.array(planStepSchema).min(1),
  scheduledSessions: z.array(scheduledSessionSchema),
  progressionRules: z.array(progressionRuleSchema),
  regressionRules: z.array(regressionRuleSchema),
  stopRuleIds: z.array(canonicalCodeSchema),
  escalationRuleIds: z.array(canonicalCodeSchema),
  createdAt: isoTimestampSchema,
});

export const planSchema = z.strictObject({
  id: entityIdSchema,
  dogId: entityIdSchema,
  goalVersionId: entityIdSchema,
  status: z.enum(["draft", "active", "paused", "completed", "closed"]),
  activeVersion: planVersionSchema,
});

export const planGenerationResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("generated"),
    plan: planSchema,
    eligibility: z.array(
      z.strictObject({
        protocolVersionId: entityIdSchema,
        status: z.enum(["eligible", "blocked", "unsupported"]),
      }),
    ),
  }),
  z.strictObject({
    status: z.enum(["blocked", "unsupported"]),
    reasonCodes: z.array(reasonCodeSchema).min(1),
    requiredQuestionCodes: z.array(canonicalCodeSchema),
    evidenceIds: z.array(entityIdSchema),
  }),
]);

export type Goal = z.infer<typeof goalSchema>;
export type GoalVersion = z.infer<typeof goalVersionSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>;
export type PlanGenerationResult = z.infer<typeof planGenerationResultSchema>;
