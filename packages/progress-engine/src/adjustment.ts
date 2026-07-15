import {
  canonicalCodeSchema,
  planAdjustmentSchema,
  progressEvaluationSchema,
  riskAssessmentSchema,
  type PlanAdjustment,
  type ProgressEvaluation,
  type RiskAssessment,
} from "@dogos/contracts";
import { z } from "zod";

export const adjustmentInputSchema = z.strictObject({
  safetyAssessment: riskAssessmentSchema,
  progress: progressEvaluationSchema,
  previousPlanVersion: z.number().int().positive(),
  currentDifficulty: z.number().int().min(1).max(10),
  currentStepCode: canonicalCodeSchema,
  prerequisiteStepCode: canonicalCodeSchema.nullable(),
  triggeredProtocolStopRuleIds: z.array(canonicalCodeSchema),
  requiredQuestionCodes: z.array(canonicalCodeSchema),
});

export interface AdjustmentInput {
  safetyAssessment: RiskAssessment;
  progress: ProgressEvaluation;
  previousPlanVersion: number;
  currentDifficulty: number;
  currentStepCode: string;
  prerequisiteStepCode: string | null;
  triggeredProtocolStopRuleIds: string[];
  requiredQuestionCodes: string[];
}

export function decidePlanAdjustment(
  rawInput: AdjustmentInput,
): PlanAdjustment {
  const input = adjustmentInputSchema.parse(rawInput);
  const evidenceIds = [
    ...new Set([
      ...input.safetyAssessment.evidenceIds,
      ...input.progress.evidenceIds,
    ]),
  ].sort();

  let decision: PlanAdjustment["decision"] = "continue_plan";
  if (input.safetyAssessment.disposition !== "continue_low_risk_training") {
    decision =
      input.safetyAssessment.disposition === "require_more_information"
        ? "ask_for_information"
        : input.safetyAssessment.disposition === "require_trainer_review" ||
            input.safetyAssessment.disposition === "require_veterinary_review"
          ? "require_professional_review"
          : "stop_training";
  } else if (input.progress.status === "insufficient_data") {
    decision = "ask_for_information";
  } else if (input.triggeredProtocolStopRuleIds.length > 0) {
    decision = "stop_training";
  } else if (input.progress.reasonCodes.includes("REGRESSION_FOOD_REFUSAL")) {
    decision = "schedule_rest";
  } else if (
    input.progress.status === "regressing" ||
    input.progress.status === "mixed"
  ) {
    decision = "reduce_difficulty";
  } else if (input.prerequisiteStepCode !== null) {
    decision = "train_prerequisite";
  } else if (input.progress.status === "improving") {
    decision = "increase_difficulty";
  } else if (input.progress.status === "stable") {
    decision = "repeat_step";
  }

  const professionalDisposition: PlanAdjustment["professionalDisposition"] =
    input.safetyAssessment.disposition === "require_veterinary_review"
      ? {
          type: "veterinary_review",
          reasonCodes: ["REQUIRE_VETERINARY_REVIEW"],
          urgency: "prompt",
        }
      : input.safetyAssessment.disposition === "require_trainer_review"
        ? {
            type: "trainer_review",
            reasonCodes: ["REQUIRE_TRAINER_REVIEW"],
            urgency: "prompt",
          }
        : input.safetyAssessment.disposition === "urgent_safety_message"
          ? {
              type: "urgent_support",
              reasonCodes: input.safetyAssessment.reasonCodes,
              urgency: "urgent",
            }
          : { type: "none", reasonCodes: [], urgency: "none" };

  const reasonByDecision: Record<
    PlanAdjustment["decision"],
    PlanAdjustment["reasonCodes"][number]
  > = {
    continue_plan: "ADJUSTMENT_CONTINUE",
    repeat_step: "ADJUSTMENT_REPEAT_STEP",
    reduce_difficulty: "ADJUSTMENT_REDUCE_DIFFICULTY",
    increase_difficulty: "ADJUSTMENT_INCREASE_DIFFICULTY",
    train_prerequisite: "ADJUSTMENT_TRAIN_PREREQUISITE",
    schedule_rest: "ADJUSTMENT_SCHEDULE_REST",
    ask_for_information: "ADJUSTMENT_ASK_FOR_INFORMATION",
    require_professional_review:
      input.safetyAssessment.disposition === "require_veterinary_review"
        ? "REQUIRE_VETERINARY_REVIEW"
        : "REQUIRE_TRAINER_REVIEW",
    stop_training: "ADJUSTMENT_STOP_TRAINING",
  };

  return planAdjustmentSchema.parse({
    decision,
    previousPlanVersion: input.previousPlanVersion,
    proposedDifficulty:
      decision === "increase_difficulty"
        ? Math.min(10, input.currentDifficulty + 1)
        : decision === "reduce_difficulty"
          ? Math.max(1, input.currentDifficulty - 1)
          : null,
    proposedStepCode:
      decision === "train_prerequisite"
        ? input.prerequisiteStepCode
        : decision === "repeat_step" || decision === "continue_plan"
          ? input.currentStepCode
          : null,
    evidenceIds,
    triggeredRuleIds: [
      ...new Set([
        ...input.safetyAssessment.triggeredRuleIds,
        ...input.triggeredProtocolStopRuleIds,
      ]),
    ].sort(),
    reasonCodes: [reasonByDecision[decision]],
    requiredQuestionCodes: [
      ...new Set([
        ...input.safetyAssessment.requiredQuestionCodes,
        ...input.requiredQuestionCodes,
      ]),
    ].sort(),
    professionalDisposition,
    newPlanVersionRequired: [
      "reduce_difficulty",
      "increase_difficulty",
      "train_prerequisite",
      "schedule_rest",
      "stop_training",
    ].includes(decision),
  });
}

export const adjustPlan = decidePlanAdjustment;
