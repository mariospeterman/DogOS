import { z } from "zod";

const id = z.string().min(1).max(120);
const command = z.object({ idempotencyKey: z.string().min(4).max(120) });

export const dogosToolSchemas = {
  dogos_get_profile: z.object({}).strict(),
  dogos_get_current_state: z.object({ dogId: id }).strict(),
  dogos_record_anamnesis_answer: command
    .extend({
      anamnesisId: id,
      questionCode: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
      answerCode: z.string().max(120).optional(),
      observedText: z.string().max(500).optional(),
    })
    .strict(),
  dogos_run_safety_assessment: command
    .extend({ dogId: id, kind: z.enum(["low", "pain", "child_bite"]) })
    .strict(),
  dogos_create_goal: command
    .extend({ dogId: id, goalCode: z.literal("goal.loose_leash_walking") })
    .strict(),
  dogos_generate_plan: command.extend({ goalId: id }).strict(),
  dogos_get_today: z.object({ dogId: id }).strict(),
  dogos_start_session: command.extend({ sessionId: id }).strict(),
  dogos_record_session: command
    .extend({
      sessionId: id,
      repetitions: z.number().int().min(0).max(20).optional(),
      successes: z.number().int().min(0).max(20).optional(),
      foodAccepted: z.boolean().optional(),
      distractionLevel: z.number().int().min(0).max(5).optional(),
      difficulty: z.number().int().min(1).max(5).optional(),
      confidence: z.number().int().min(1).max(5).optional(),
      avoidance: z.boolean().optional(),
      concern: z.string().max(500).optional(),
    })
    .strict(),
  dogos_complete_checkin: command
    .extend({
      sessionId: id,
      success: z.number().min(0).max(100),
      foodAccepted: z.boolean(),
      avoidance: z.boolean().optional(),
    })
    .strict(),
  dogos_get_progress: z.object({ planId: id }).strict(),
  dogos_adjust_plan: command
    .extend({ planId: id, expectedVersion: z.number().int().min(1) })
    .strict(),
  dogos_request_professional_handoff: command
    .extend({
      dogId: id,
      reason: z.string().min(1).max(500).optional(),
      targetProfessionalType: z.enum(["trainer", "veterinary"]).optional(),
      ttlDays: z.number().int().min(1).max(30).optional(),
    })
    .strict(),
} as const;

export type DogosToolName = keyof typeof dogosToolSchemas;
export const dogosToolNames = Object.keys(dogosToolSchemas) as DogosToolName[];
export const dogosWriteTools = new Set<DogosToolName>([
  "dogos_record_anamnesis_answer",
  "dogos_run_safety_assessment",
  "dogos_create_goal",
  "dogos_generate_plan",
  "dogos_start_session",
  "dogos_record_session",
  "dogos_complete_checkin",
  "dogos_adjust_plan",
  "dogos_request_professional_handoff",
]);
