import { describe, expect, it } from "vitest";

import type { SafetyAssessmentInput } from "./safety.js";
import { assessSafety } from "./safety.js";

const answerEvidenceId = "90000000-0000-4000-8000-000000000001";
const healthEvidenceId = "90000000-0000-4000-8000-000000000002";

function baseInput(): SafetyAssessmentInput {
  return {
    dogProfile: {
      id: "10000000-0000-4000-8000-000000000001",
      birthDateEstimate: "2022-04-01",
      developmentStage: "adult",
      sex: "female",
      neuterStatus: "neutered",
      weightKg: 18,
      breedContext: {
        status: "unknown",
        breeds: [],
        sourcedPhysicalConstraintCodes: [],
      },
    },
    healthContext: {
      reportedConditionCodes: [],
      medicationCodes: [],
      suspectedPain: false,
      suddenBehaviorChange: false,
      physicalConstraintCodes: [],
      evidenceIds: [healthEvidenceId],
    },
    householdContext: {
      childrenPresent: false,
      otherAnimalCodes: [],
      environmentCode: "environment.home_low_distraction",
      availableEquipmentCodes: [],
      managementConstraintCodes: [],
    },
    anamnesis: {
      id: "20000000-0000-4000-8000-000000000001",
      version: 1,
      completed: true,
      answers: [
        {
          state: "answered",
          questionCode: "question.recent_bite",
          questionVersion: 1,
          canonicalAnswerCode: "answer.no",
          evidenceId: answerEvidenceId,
        },
      ],
      behaviorConcerns: [],
      safetyEvents: [],
    },
    observations: [],
    currentEnvironmentCode: "environment.home_low_distraction",
    supportedEnvironmentCodes: ["environment.home_low_distraction"],
    requiredSafetyQuestionCodes: ["question.recent_bite"],
  };
}

function event(
  eventCode:
    | "safety.bite"
    | "safety.snap"
    | "safety.injury"
    | "safety.escape"
    | "safety.child_involved"
    | "safety.uncontrolled_aggression"
    | "safety.severe_fear_or_panic",
  childInvolved = false,
) {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    eventCode,
    occurredAt: "2026-07-14T10:00:00.000Z",
    recency: "recent" as const,
    severity: 3,
    childInvolved,
    injuryOccurred: eventCode === "safety.injury",
    evidenceIds: ["90000000-0000-4000-8000-000000000003"],
  };
}

describe("safety assessment", () => {
  it("allows only complete low-risk cases", () => {
    const result = assessSafety(baseInput());

    expect(result.disposition).toBe("continue_low_risk_training");
    expect(result.reasonCodes).toEqual([]);
  });

  it.each([
    ["safety.bite", false, "require_trainer_review", "SAFETY_RECENT_BITE"],
    ["safety.snap", false, "require_trainer_review", "SAFETY_RECENT_SNAP"],
    ["safety.injury", false, "require_veterinary_review", "SAFETY_INJURY"],
    ["safety.escape", false, "require_trainer_review", "SAFETY_ESCAPE_RISK"],
    [
      "safety.uncontrolled_aggression",
      false,
      "urgent_safety_message",
      "SAFETY_UNCONTROLLED_AGGRESSION",
    ],
    [
      "safety.severe_fear_or_panic",
      false,
      "stop_training",
      "SAFETY_SEVERE_FEAR_OR_PANIC",
    ],
    ["safety.bite", true, "urgent_safety_message", "SAFETY_CHILD_INVOLVED"],
  ] as const)(
    "%s produces the expected safety disposition",
    (eventCode, childInvolved, disposition, reasonCode) => {
      const input = baseInput();
      input.anamnesis.safetyEvents = [event(eventCode, childInvolved)];

      const result = assessSafety(input);

      expect(result.disposition).toBe(disposition);
      expect(result.reasonCodes).toContain(reasonCode);
      expect(result.prohibitedActionCodes).toContain(
        "action.autonomous_training",
      );
    },
  );

  it("routes suspected pain and sudden change to veterinary review", () => {
    const input = baseInput();
    input.healthContext.suspectedPain = true;
    input.healthContext.suddenBehaviorChange = true;

    const result = assessSafety(input);

    expect(result.disposition).toBe("require_veterinary_review");
    expect(result.reasonCodes).toEqual([
      "SAFETY_SUSPECTED_PAIN",
      "SAFETY_SUDDEN_BEHAVIOR_CHANGE",
    ]);
    expect(result.evidenceIds).toEqual([healthEvidenceId]);
  });

  it("stops for food refusal combined with avoidance", () => {
    const input = baseInput();
    input.observations = [
      {
        id: "40000000-0000-4000-8000-000000000001",
        sessionId: null,
        observationCode: "observation.food_refused",
        value: true,
        source: "owner_report",
        confidence: 0.8,
        observedAt: "2026-07-14T10:00:00.000Z",
        evidenceIds: [],
        unsupportedInferenceCodes: [],
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        sessionId: null,
        observationCode: "observation.avoidance_indicator",
        value: true,
        source: "owner_report",
        confidence: 0.8,
        observedAt: "2026-07-14T10:01:00.000Z",
        evidenceIds: [],
        unsupportedInferenceCodes: [],
      },
    ];

    expect(assessSafety(input).disposition).toBe("stop_training");
  });

  it("fails closed on unanswered safety questions", () => {
    const input = baseInput();
    input.anamnesis.completed = false;
    input.anamnesis.answers = [];

    const result = assessSafety(input);

    expect(result.disposition).toBe("require_more_information");
    expect(result.requiredQuestionCodes).toEqual(["question.recent_bite"]);
  });

  it("orders rules and evidence deterministically", () => {
    const input = baseInput();
    input.anamnesis.safetyEvents = [
      event("safety.escape"),
      { ...event("safety.bite"), id: "30000000-0000-4000-8000-000000000002" },
    ];

    const first = assessSafety(input);
    const second = assessSafety(input);

    expect(first).toEqual(second);
    expect(first.triggeredRuleIds).toEqual([
      "safety.recent_bite",
      "safety.escape_risk",
    ]);
    expect(first.evidenceIds).toEqual([...first.evidenceIds].sort());
  });
});
