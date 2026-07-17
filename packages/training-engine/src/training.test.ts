import { describe, expect, it } from "vitest";

import type { RiskAssessment } from "@dogos/contracts";
import { developmentProtocols } from "@dogos/knowledge";
import { developmentSafetyRuleSet } from "@dogos/safety-engine";

import type { EligibilityContext } from "./eligibility.js";
import { evaluateProtocolEligibility } from "./eligibility.js";
import type { PlanGenerationInput } from "./plan.js";
import { compareSemanticVersions, generatePlan } from "./plan.js";

const dogId = "10000000-0000-4000-8000-000000000001";
const baselineEvidenceId = "90000000-0000-4000-8000-000000000010";

function lowRiskAssessment(): RiskAssessment {
  return {
    riskLevel: "low",
    disposition: "continue_low_risk_training",
    triggeredRuleIds: [],
    reasonCodes: [],
    evidenceIds: ["90000000-0000-4000-8000-000000000020"],
    prohibitedActionCodes: [],
    requiredQuestionCodes: [],
    permittedNextActionCodes: ["action.plan_generation"],
    ruleSetId: developmentSafetyRuleSet.id,
    ruleSetVersion: developmentSafetyRuleSet.version,
  };
}

function eligibilityContext(): EligibilityContext {
  return {
    dogProfile: {
      id: dogId,
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
      evidenceIds: [],
    },
    householdContext: {
      childrenPresent: false,
      otherAnimalCodes: [],
      environmentCode: "environment.home_low_distraction",
      availableEquipmentCodes: [
        "equipment.marker",
        "equipment.food_reward",
        "equipment.non_slip_surface",
        "equipment.leash",
        "equipment.harness",
        "equipment.settle_mat",
        "equipment.long_line",
      ],
      managementConstraintCodes: [],
    },
    ownerProfile: {
      experienceLevel: "some",
      availableMinutesPerDay: 15,
      capabilityCodes: ["capability.marker_delivery"],
      accessibilityConstraintCodes: [],
      confidence: 4,
    },
    safetyAssessment: lowRiskAssessment(),
    baselineMeasurements: [
      {
        evidenceId: baselineEvidenceId,
        measurement: {
          metricCode: "metric.success_rate",
          value: 60,
          unit: "unit.percent",
          unknown: false,
          source: "owner_report",
          method: "method.session_summary",
          measuredAt: "2026-07-14T10:00:00.000Z",
          quality: "moderate",
        },
      },
    ],
    behaviorConcernCodes: [],
    mode: "development",
    evaluatedAt: "2026-07-15T10:00:00.000Z",
    presentationLocale: "de-CH",
    jurisdiction: "CH",
    releaseChannel: "channel.web",
    activeRuleSetVersion: "1.0.0",
  };
}

function planInput(goalFamily = "goal.sit"): PlanGenerationInput {
  return {
    planId: "60000000-0000-4000-8000-000000000001",
    planVersion: 1,
    prioritisedGoals: [
      {
        goal: {
          id: "61000000-0000-4000-8000-000000000001",
          dogId,
          canonicalGoalType: goalFamily,
          priority: 1,
          status: "active",
        },
        version: {
          id: "62000000-0000-4000-8000-000000000001",
          goalId: "61000000-0000-4000-8000-000000000001",
          version: 1,
          baseline: { successRate: 60 },
          target: { successRate: 80 },
          measurementCodes: ["metric.success_rate"],
          environmentCode: "environment.home_low_distraction",
          horizonDays: 21,
          successCriteria: { consecutiveSessions: 3 },
          stopConditionCodes: ["stop.safety_escalation"],
          escalationConditionCodes: ["escalate.professional_review"],
        },
      },
    ],
    protocols: [...developmentProtocols],
    eligibilityContext: eligibilityContext(),
    ruleSet: developmentSafetyRuleSet,
    mode: "development",
    createdAt: "2026-07-15T10:00:00.000Z",
    schedule: {
      firstSessionAt: "2026-07-16T08:00:00.000Z",
      sessionsPerStep: 3,
      recoveryAfterSessions: 2,
    },
  };
}

describe("protocol eligibility", () => {
  it("allows an eligible development fixture and retains evidence IDs", () => {
    const protocol = developmentProtocols[1];
    expect(protocol).toBeDefined();

    const result = evaluateProtocolEligibility(protocol!, eligibilityContext());

    expect(result.status).toBe("eligible");
    expect(result.evidenceIds).toEqual([
      baselineEvidenceId,
      "90000000-0000-4000-8000-000000000020",
    ]);
  });

  it("blocks capability, baseline, equipment, and health exclusions", () => {
    const protocol = developmentProtocols[2];
    const context = eligibilityContext();
    context.ownerProfile.capabilityCodes = [];
    context.baselineMeasurements = [];
    context.householdContext.availableEquipmentCodes = [];
    context.healthContext.physicalConstraintCodes = [
      "constraint.no_repetitive_movement",
    ];

    const result = evaluateProtocolEligibility(protocol!, context);

    expect(result.status).toBe("blocked");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "PROTOCOL_OWNER_CAPABILITY_INSUFFICIENT",
        "PROTOCOL_BASELINE_MISSING",
        "PROTOCOL_EQUIPMENT_MISSING",
        "PROTOCOL_PHYSICAL_CONSTRAINT",
      ]),
    );
    expect(result.triggeredExclusionCodes).toEqual([
      "exclusion.mobility_constraint",
    ]);
  });

  it("blocks development protocols in production on all release gates", () => {
    const context = eligibilityContext();
    context.mode = "production";

    const result = evaluateProtocolEligibility(
      developmentProtocols[3]!,
      context,
    );

    expect(result.status).toBe("blocked");
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "PROTOCOL_DEVELOPMENT_ONLY",
        "PROTOCOL_UNAPPROVED",
        "PROTOCOL_LOCALIZATION_NOT_RELEASED",
      ]),
    );
  });

  it("blocks a mismatched frozen rule-set version", () => {
    const context = eligibilityContext();
    context.activeRuleSetVersion = "2.0.0";

    expect(
      evaluateProtocolEligibility(developmentProtocols[1]!, context)
        .reasonCodes,
    ).toContain("PROTOCOL_RULE_SET_VERSION_MISSING");
  });
});

describe("plan generation", () => {
  it("orders protocol versions by SemVer precedence", () => {
    expect(compareSemanticVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemanticVersions("1.10.0", "1.10.0-beta.2")).toBeGreaterThan(
      0,
    );
    expect(
      compareSemanticVersions("1.10.0-beta.11", "1.10.0-beta.2"),
    ).toBeGreaterThan(0);

    const input = planInput();
    const current = input.protocols.find(
      (protocol) =>
        protocol.goalFamily ===
        input.prioritisedGoals[0]!.goal.canonicalGoalType,
    )!;
    input.protocols = [
      {
        ...current,
        id: "71000000-0000-4000-8000-000000000009",
        semanticVersion: "1.9.0",
      },
      {
        ...current,
        id: "71000000-0000-4000-8000-000000000010",
        semanticVersion: "1.10.0-beta.2",
      },
      {
        ...current,
        id: "71000000-0000-4000-8000-000000000011",
        semanticVersion: "1.10.0",
      },
    ];

    const result = generatePlan(input);
    expect(result.status).toBe("generated");
    if (result.status === "generated") {
      expect(result.plan.activeVersion.protocolSemanticVersion).toBe("1.10.0");
    }
  });

  it("generates the same capped, version-pinned schedule for the same input", () => {
    const input = planInput();

    const first = generatePlan(input);
    const second = generatePlan(input);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    if (first.status !== "generated") return;
    expect(first.plan.activeVersion.protocolSemanticVersion).toBe(
      "0.1.0-development",
    );
    expect(first.plan.activeVersion.ruleSetVersion).toBe("1.0.0");
    expect(first.plan.activeVersion.generationReasonCodes).toEqual([
      "PLAN_GENERATED_DEVELOPMENT_ONLY",
    ]);
    expect(first.plan.activeVersion.scheduledSessions).toHaveLength(4);
    expect(first.plan.activeVersion.scheduledSessions[2]?.recoveryDay).toBe(
      true,
    );
  });

  it("returns unsupported for a goal without a protocol", () => {
    expect(generatePlan(planInput("goal.flyball")).status).toBe("unsupported");
  });

  it("blocks tied active priority and ignores higher-priority drafts", () => {
    const input = planInput();
    input.prioritisedGoals.unshift({
      goal: {
        ...input.prioritisedGoals[0]!.goal,
        id: "61000000-0000-4000-8000-000000000002",
        priority: 1,
        status: "draft",
      },
      version: {
        ...input.prioritisedGoals[0]!.version,
        id: "62000000-0000-4000-8000-000000000002",
        goalId: "61000000-0000-4000-8000-000000000002",
      },
    });
    expect(generatePlan(input).status).toBe("generated");

    input.prioritisedGoals[0]!.goal.status = "active";
    expect(generatePlan(input)).toMatchObject({
      status: "blocked",
      reasonCodes: ["PLAN_MULTIPLE_PRIORITISED_GOALS"],
    });
  });

  it("lets a non-low-risk safety disposition override plan generation", () => {
    const input = planInput();
    input.eligibilityContext.safetyAssessment = {
      ...lowRiskAssessment(),
      riskLevel: "high",
      disposition: "stop_training",
      reasonCodes: ["SAFETY_SEVERE_FEAR_OR_PANIC"],
    };

    expect(generatePlan(input)).toMatchObject({
      status: "blocked",
      reasonCodes: expect.arrayContaining([
        "PLAN_NO_ELIGIBLE_PROTOCOL",
        "PROTOCOL_SAFETY_DISPOSITION_BLOCKED",
      ]),
    });
  });
});
