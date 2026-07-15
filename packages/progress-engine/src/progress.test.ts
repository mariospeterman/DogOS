import { describe, expect, it } from "vitest";

import type {
  Measurement,
  RiskAssessment,
  SessionEvidence,
} from "@dogos/contracts";

import { decidePlanAdjustment } from "./adjustment.js";
import type { ProgressEvaluationInput } from "./progress.js";
import { evaluateProgress } from "./progress.js";

const ruleSet = {
  id: "70000000-0000-4000-8000-000000000001",
  ruleSetCode: "rules.progress_development",
  version: "1.0.0",
  developmentOnly: true,
  rules: [],
};

function measurement(
  metricCode: Measurement["metricCode"],
  value: number | boolean,
  measuredAt: string,
  quality: Measurement["quality"] = "high",
): Measurement {
  const units: Record<Measurement["metricCode"], string | null> = {
    "metric.continuous_loose_steps": "unit.count",
    "metric.duration_seconds": "unit.second",
    "metric.engagement_rate": "unit.percent",
    "metric.food_acceptance": null,
    "metric.handler_execution_rate": "unit.percent",
    "metric.recovery_seconds": "unit.second",
    "metric.repetitions": "unit.count",
    "metric.response_latency_ms": "unit.millisecond",
    "metric.success_rate": "unit.percent",
    "metric.trigger_distance_m": "unit.meter",
  };
  return {
    metricCode,
    value,
    unit: units[metricCode],
    unknown: false,
    source: "owner_report",
    method: "method.session_summary",
    measuredAt,
    quality,
  };
}

function session(
  sequence: number,
  successRate: number,
  extras: Measurement[] = [],
): SessionEvidence {
  const suffix = sequence.toString().padStart(12, "0");
  const completedAt = `2026-07-${(10 + sequence).toString().padStart(2, "0")}T10:00:00.000Z`;
  return {
    sessionId: `71000000-0000-4000-8000-${suffix}`,
    completedAt,
    measurements: [
      measurement("metric.success_rate", successRate, completedAt),
      ...extras,
    ],
    ownerCheckin: null,
    observations: [],
  };
}

function input(sessions: SessionEvidence[]): ProgressEvaluationInput {
  return {
    sessions,
    requiredMetricCodes: ["metric.success_rate"],
    currentDifficulty: 3,
    progressionRules: [
      {
        ruleId: "progression.success_three",
        metricCode: "metric.success_rate",
        operator: "gte",
        threshold: 80,
        consecutiveSessions: 3,
      },
    ],
    regressionRules: [
      {
        ruleId: "regression.food_refusal",
        metricCode: "metric.food_acceptance",
        operator: "eq",
        threshold: false,
      },
      {
        ruleId: "regression.recovery_too_long",
        metricCode: "metric.recovery_seconds",
        operator: "gte",
        threshold: 120,
      },
    ],
    evaluatedAt: "2026-07-15T12:00:00.000Z",
    recencyWindowDays: 14,
    minimumSessions: 3,
    ruleSet,
  };
}

function lowRisk(): RiskAssessment {
  return {
    riskLevel: "low",
    disposition: "continue_low_risk_training",
    triggeredRuleIds: [],
    reasonCodes: [],
    evidenceIds: [],
    prohibitedActionCodes: [],
    requiredQuestionCodes: [],
    permittedNextActionCodes: ["action.plan_generation"],
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
  };
}

describe("progress evaluation", () => {
  it("returns all ten unavailable dimensions for no evidence", () => {
    const result = evaluateProgress(input([]));

    expect(result.status).toBe("insufficient_data");
    expect(result.dimensions).toHaveLength(10);
    expect(result.confidence).toBe("unavailable");
    expect(result.missingMetricCodes).toEqual(["metric.success_rate"]);
  });

  it("meets an inclusive threshold for the exact consecutive count", () => {
    const result = evaluateProgress(
      input([session(1, 80), session(2, 80), session(3, 80)]),
    );

    expect(result.status).toBe("improving");
    expect(result.reasonCodes).toContain("PROGRESSION_THRESHOLD_MET");
    expect(result.candidateNextAction).toBe("increase_difficulty");
  });

  it("does not progress when one boundary value is below the threshold", () => {
    const result = evaluateProgress(
      input([session(1, 80), session(2, 79), session(3, 80)]),
    );

    expect(result.status).toBe("stable");
    expect(result.reasonCodes).toContain(
      "PROGRESSION_CONSECUTIVE_SESSIONS_NOT_MET",
    );
  });

  it("reports mixed evidence while regression controls the next action", () => {
    const latestAt = "2026-07-13T10:00:00.000Z";
    const result = evaluateProgress(
      input([
        session(1, 90),
        session(2, 90),
        session(3, 90, [
          measurement("metric.food_acceptance", false, latestAt),
        ]),
      ]),
    );

    expect(result.status).toBe("mixed");
    expect(result.reasonCodes).toContain("REGRESSION_FOOD_REFUSAL");
    expect(result.candidateNextAction).toBe("reduce_difficulty");
  });

  it("treats recovery equal to its ceiling as regression", () => {
    const result = evaluateProgress(
      input([
        session(1, 70),
        session(2, 70),
        session(3, 70, [
          measurement(
            "metric.recovery_seconds",
            120,
            "2026-07-13T10:00:00.000Z",
          ),
        ]),
      ]),
    );

    expect(result.reasonCodes).toContain("REGRESSION_RECOVERY_TOO_LONG");
  });

  it("detects a strictly declining three-session success trend", () => {
    const result = evaluateProgress(
      input([session(1, 80), session(2, 70), session(3, 60)]),
    );

    expect(result.status).toBe("regressing");
    expect(result.reasonCodes).toContain("REGRESSION_SUCCESS_RATE_DECLINING");
  });

  it("requires review for a high metric conflicting with the owner report", () => {
    const sessions = [session(1, 80), session(2, 80), session(3, 80)];
    sessions[2]!.ownerCheckin = {
      id: "72000000-0000-4000-8000-000000000001",
      sessionId: sessions[2]!.sessionId,
      difficulty: 5,
      confidence: 1,
      perceivedOutcomeCode: "outcome.poor",
      concernCodes: [],
      evidenceId: "72000000-0000-4000-8000-000000000002",
    };

    const result = evaluateProgress(input(sessions));

    expect(result.status).toBe("requires_review");
    expect(result.confidence).toBe("low");
    expect(result.reasonCodes).toContain("DATA_CONFLICTING_EVIDENCE");
  });

  it("is deterministic and flags evidence outside the recency window", () => {
    const old = session(1, 70);
    old.completedAt = "2026-05-01T10:00:00.000Z";
    const evaluationInput = input([old, session(2, 70), session(3, 70)]);

    const first = evaluateProgress(evaluationInput);

    expect(first).toEqual(evaluateProgress(evaluationInput));
    expect(first.reasonCodes).toContain("DATA_STALE");
    expect(first.evidenceIds).toEqual([...first.evidenceIds].sort());
  });
});

describe("plan adjustment", () => {
  it("gives safety escalation precedence over progress", () => {
    const progress = evaluateProgress(
      input([session(1, 90), session(2, 90), session(3, 90)]),
    );
    const result = decidePlanAdjustment({
      safetyAssessment: {
        ...lowRisk(),
        riskLevel: "high",
        disposition: "require_veterinary_review",
        reasonCodes: ["SAFETY_SUSPECTED_PAIN"],
      },
      progress,
      previousPlanVersion: 1,
      currentDifficulty: 3,
      currentStepCode: "step.sit",
      prerequisiteStepCode: null,
      triggeredProtocolStopRuleIds: [],
      requiredQuestionCodes: [],
    });

    expect(result.decision).toBe("require_professional_review");
    expect(result.professionalDisposition.type).toBe("veterinary_review");
  });

  it("schedules rest for food refusal after safety passes", () => {
    const progress = evaluateProgress(
      input([
        session(1, 90),
        session(2, 90),
        session(3, 90, [
          measurement(
            "metric.food_acceptance",
            false,
            "2026-07-13T10:00:00.000Z",
          ),
        ]),
      ]),
    );
    const result = decidePlanAdjustment({
      safetyAssessment: lowRisk(),
      progress,
      previousPlanVersion: 1,
      currentDifficulty: 3,
      currentStepCode: "step.sit",
      prerequisiteStepCode: null,
      triggeredProtocolStopRuleIds: [],
      requiredQuestionCodes: [],
    });

    expect(result.decision).toBe("schedule_rest");
    expect(result.newPlanVersionRequired).toBe(true);
  });
});
