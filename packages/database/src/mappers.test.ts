import { describe, expect, it } from "vitest";
import type {
  Measurement,
  PlanAdjustment,
  ProgressEvaluation,
  RiskAssessment,
} from "@dogos/contracts";
import {
  measurementFromPersistenceDTO,
  measurementToPersistenceDTO,
  planAdjustmentFromPersistenceDTO,
  planAdjustmentToPersistenceDTO,
  progressEvaluationFromPersistenceDTO,
  progressEvaluationToPersistenceDTO,
  riskAssessmentFromPersistenceDTO,
  riskAssessmentToPersistenceDTO,
} from "./mappers.js";

const ruleSetId = "52000000-0000-4000-8000-000000000101";
const baseRisk: RiskAssessment = {
  riskLevel: "low",
  disposition: "continue_low_risk_training",
  triggeredRuleIds: [],
  reasonCodes: [],
  evidenceIds: [],
  prohibitedActionCodes: [],
  requiredQuestionCodes: [],
  permittedNextActionCodes: [],
  ruleSetId,
  ruleSetVersion: "1.0.0",
};

describe("exhaustive persistence mappers", () => {
  it.each([
    "continue_low_risk_training",
    "require_more_information",
    "require_trainer_review",
    "require_veterinary_review",
    "stop_training",
    "urgent_safety_message",
  ] as const)("round-trips safety disposition %s", (disposition) => {
    const decision = { ...baseRisk, disposition };
    expect(
      riskAssessmentFromPersistenceDTO(
        riskAssessmentToPersistenceDTO(decision),
      ),
    ).toEqual(decision);
  });

  it.each([
    "insufficient_data",
    "stable",
    "improving",
    "regressing",
    "mixed",
    "requires_review",
  ] as const)("round-trips progress status %s", (status) => {
    const decision: ProgressEvaluation = {
      status,
      dimensions: [],
      evidenceIds: [],
      missingMetricCodes: [],
      confidence: "low",
      reasonCodes: [],
      candidateNextAction: "repeat_step",
      engineVersion: "1.0.0",
      ruleSetId,
      ruleSetVersion: "1.0.0",
    };
    expect(
      progressEvaluationFromPersistenceDTO(
        progressEvaluationToPersistenceDTO(decision),
      ),
    ).toEqual(decision);
  });

  it.each([
    "continue_plan",
    "repeat_step",
    "reduce_difficulty",
    "increase_difficulty",
    "train_prerequisite",
    "schedule_rest",
    "ask_for_information",
    "require_professional_review",
    "stop_training",
  ] as const)("round-trips adjustment %s", (decisionCode) => {
    const decision: PlanAdjustment = {
      decision: decisionCode,
      previousPlanVersion: 1,
      proposedDifficulty: null,
      proposedStepCode: null,
      evidenceIds: [],
      triggeredRuleIds: [],
      reasonCodes: ["ADJUSTMENT_CONTINUE"],
      requiredQuestionCodes: [],
      professionalDisposition: {
        type: "none",
        reasonCodes: [],
        urgency: "none",
      },
      newPlanVersionRequired: false,
    };
    expect(
      planAdjustmentFromPersistenceDTO(
        planAdjustmentToPersistenceDTO(decision),
      ),
    ).toEqual(decision);
  });

  it.each([
    { value: 0, unknown: false, unknownReason: undefined },
    { value: null, unknown: true, unknownReason: "unknown.not_measured" },
  ] as const)("preserves known zero and explicit unknown %#", (state) => {
    const measurement: Measurement = {
      metricCode: "metric.success_rate",
      value: state.value,
      unit: "unit.percent",
      unknown: state.unknown,
      ...(state.unknownReason === undefined
        ? {}
        : { unknownReason: state.unknownReason }),
      source: "owner_report",
      method: "method.session_summary",
      measuredAt: "2026-07-15T10:00:00.000Z",
      quality: state.unknown ? "unavailable" : "moderate",
    };
    const dto = measurementToPersistenceDTO(measurement);
    expect(dto.source).toBe("owner_report");
    expect(measurementFromPersistenceDTO(dto)).toEqual(measurement);
  });

  it("rejects unsupported values instead of defaulting", () => {
    expect(() =>
      riskAssessmentFromPersistenceDTO({
        ...riskAssessmentToPersistenceDTO(baseRisk),
        disposition_code: "disposition.future",
      }),
    ).toThrow("Unsupported safety disposition");
  });
});
