import { describe, expect, it } from "vitest";

import type { BreedContext } from "@dogos/contracts";
import { developmentProtocols } from "@dogos/knowledge";
import { adjustPlan } from "@dogos/progress-engine";
import { assessSafety } from "@dogos/safety-engine";
import { evaluateProtocolEligibility } from "@dogos/training-engine";

import {
  canonicalizeLocalizedCase,
  englishOwnerCase,
  germanOwnerCase,
} from "./fixtures.js";
import { runCanonicalCase } from "./run-case.js";

describe("multilingual canonical equivalence", () => {
  it("maps German and English owner answers to identical canonical facts", () => {
    const de = canonicalizeLocalizedCase(germanOwnerCase);
    const en = canonicalizeLocalizedCase(englishOwnerCase);

    expect(de.safetyInput.anamnesis.behaviorConcerns).toEqual(
      en.safetyInput.anamnesis.behaviorConcerns,
    );
    expect(de.safetyInput.anamnesis.safetyEvents).toEqual(
      en.safetyInput.anamnesis.safetyEvents,
    );
    expect(de.goalFamily).toBe(en.goalFamily);
  });

  it("produces identical safety, eligibility, plan, progress, and adjustment decisions", () => {
    const de = runCanonicalCase(canonicalizeLocalizedCase(germanOwnerCase));
    const en = runCanonicalCase(canonicalizeLocalizedCase(englishOwnerCase));

    expect(de).toEqual(en);
    expect(de.safety.disposition).toBe("continue_low_risk_training");
    expect(de.eligibility.status).toBe("eligible");
    expect(de.plan.status).toBe("generated");
    expect(de.progress.status).toBe("improving");
    expect(de.adjustment.decision).toBe("increase_difficulty");
  });

  it("is invariant across presentation locale, currency, and development jurisdiction", () => {
    const variants = Array.from({ length: 30 }, (_, index) => ({
      ...englishOwnerCase,
      locale: index % 2 === 0 ? ("en" as const) : ("de-CH" as const),
      currency: index % 3 === 0 ? ("CHF" as const) : ("EUR" as const),
      jurisdiction: index % 2 === 0 ? ("CH" as const) : ("DE" as const),
    }));
    const baseline = runCanonicalCase(canonicalizeLocalizedCase(variants[0]!));

    for (const variant of variants) {
      expect(runCanonicalCase(canonicalizeLocalizedCase(variant))).toEqual(
        baseline,
      );
    }
  });

  it("returns identical output over repeated runs", () => {
    const canonicalCase = canonicalizeLocalizedCase(englishOwnerCase);
    const expected = runCanonicalCase(canonicalCase);

    for (let iteration = 0; iteration < 50; iteration += 1) {
      expect(runCanonicalCase(canonicalCase)).toEqual(expected);
    }
  });
});

describe("breed safeguards", () => {
  const variants: BreedContext[] = [
    { status: "unknown", breeds: [], sourcedPhysicalConstraintCodes: [] },
    {
      status: "known",
      breeds: [
        {
          breedCode: "breed.labrador_retriever",
          source: "owner_report",
          confidence: 0.7,
        },
      ],
      sourcedPhysicalConstraintCodes: [],
    },
    {
      status: "mixed",
      breeds: [
        {
          breedCode: "breed.mixed_unknown",
          source: "owner_report",
          confidence: 0.4,
        },
      ],
      sourcedPhysicalConstraintCodes: [],
    },
  ];

  it("supports known, mixed, and unknown breed labels without changing decisions", () => {
    const outputs = variants.map((breed) =>
      runCanonicalCase(canonicalizeLocalizedCase(englishOwnerCase, breed)),
    );

    expect(outputs[1]).toEqual(outputs[0]);
    expect(outputs[2]).toEqual(outputs[0]);
    expect(outputs[0]!.safety.reasonCodes).not.toContain(
      "SAFETY_UNCONTROLLED_AGGRESSION",
    );
  });

  it("uses only explicit sourced physical constraints for eligibility", () => {
    const unconstrained = canonicalizeLocalizedCase(
      englishOwnerCase,
      variants[1],
    );
    const constrained = canonicalizeLocalizedCase(englishOwnerCase, {
      ...variants[1]!,
      sourcedPhysicalConstraintCodes: ["constraint.no_repetitive_movement"],
    });
    const protocol = developmentProtocols.find(
      (candidate) => candidate.goalFamily === unconstrained.goalFamily,
    )!;
    const normalRun = runCanonicalCase(unconstrained);
    const constrainedSafety = assessSafety(constrained.safetyInput);

    expect(normalRun.eligibility.status).toBe("eligible");
    expect(
      evaluateProtocolEligibility(protocol, {
        dogProfile: constrained.safetyInput.dogProfile,
        healthContext: constrained.safetyInput.healthContext,
        householdContext: constrained.safetyInput.householdContext,
        ownerProfile: {
          experienceLevel: "some",
          availableMinutesPerDay: 15,
          capabilityCodes: ["capability.marker_delivery"],
          accessibilityConstraintCodes: [],
          confidence: 4,
        },
        safetyAssessment: constrainedSafety,
        baselineMeasurements: [
          {
            evidenceId: "94000000-0000-4000-8000-000000000001",
            measurement: {
              metricCode: "metric.success_rate",
              value: 60,
              unit: "unit.percent",
              unknown: false,
              source: "owner_report",
              method: "method.session_summary",
              measuredAt: "2026-07-10T10:00:00.000Z",
              quality: "moderate",
            },
          },
        ],
        behaviorConcernCodes: ["concern.leash_pulling"],
        mode: "development",
        evaluatedAt: "2026-07-15T12:00:00.000Z",
        presentationLocale: "en",
        jurisdiction: "CH",
        releaseChannel: "channel.web",
        activeRuleSetVersion: "1.0.0",
      }).reasonCodes,
    ).toContain("PROTOCOL_PHYSICAL_CONSTRAINT");
  });
});

describe("cross-engine fail-closed behavior", () => {
  it("blocks plan generation for a recent bite involving a child", () => {
    const canonicalCase = canonicalizeLocalizedCase(englishOwnerCase);
    canonicalCase.safetyInput.anamnesis.safetyEvents = [
      {
        id: "96000000-0000-4000-8000-000000000001",
        eventCode: "safety.bite",
        occurredAt: "2026-07-14T10:00:00.000Z",
        recency: "recent",
        severity: 3,
        childInvolved: true,
        injuryOccurred: false,
        evidenceIds: ["96000000-0000-4000-8000-000000000002"],
      },
    ];

    const output = runCanonicalCase(canonicalCase);

    expect(output.safety.disposition).toBe("urgent_safety_message");
    expect(output.eligibility.status).toBe("blocked");
    expect(output.plan.status).toBe("blocked");
  });

  it("blocks plan eligibility when bite history is unknown", () => {
    const canonicalCase = canonicalizeLocalizedCase(englishOwnerCase);
    canonicalCase.safetyInput.anamnesis.completed = false;
    canonicalCase.safetyInput.anamnesis.answers = [];

    const output = runCanonicalCase(canonicalCase);

    expect(output.safety.disposition).toBe("require_more_information");
    expect(output.eligibility.status).toBe("blocked");
    expect(output.plan.status).toBe("blocked");
  });

  it("lets safety override successful progression in adjustment", () => {
    const canonicalCase = canonicalizeLocalizedCase(englishOwnerCase);
    const output = runCanonicalCase(canonicalCase);
    const adjustment = adjustPlan({
      safetyAssessment: {
        ...output.safety,
        riskLevel: "urgent",
        disposition: "urgent_safety_message",
        reasonCodes: ["SAFETY_CHILD_INVOLVED"],
      },
      progress: output.progress,
      previousPlanVersion: 1,
      currentDifficulty: 1,
      currentStepCode: "step.loose_leash_low_distraction",
      prerequisiteStepCode: null,
      triggeredProtocolStopRuleIds: [],
      requiredQuestionCodes: [],
    });

    expect(adjustment.decision).toBe("stop_training");
  });

  it("repeats a step after three sessions below progression threshold", () => {
    const canonicalCase = canonicalizeLocalizedCase(englishOwnerCase);
    for (const session of canonicalCase.progressSessions) {
      const success = session.measurements.find(
        (measurement) => measurement.metricCode === "metric.success_rate",
      );
      if (success !== undefined) success.value = 79;
    }
    const output = runCanonicalCase(canonicalCase);

    expect(output.progress.status).toBe("stable");
    expect(output.adjustment.decision).toBe("repeat_step");
  });
});
