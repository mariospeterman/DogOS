import type { Measurement } from "@dogos/contracts";
import { developmentProtocols } from "@dogos/knowledge";
import { adjustPlan, evaluateProgress } from "@dogos/progress-engine";
import { assessSafety, developmentSafetyRuleSet } from "@dogos/safety-engine";
import {
  evaluateProtocolEligibility,
  generatePlan,
  type EligibilityContext,
} from "@dogos/training-engine";

import type { CanonicalCase } from "./fixtures.js";

const baselineMeasurement: Measurement = {
  metricCode: "metric.success_rate",
  value: 60,
  unit: "unit.percent",
  unknown: false,
  source: "owner_report",
  method: "method.session_summary",
  measuredAt: "2026-07-10T10:00:00.000Z",
  quality: "moderate",
};

export function runCanonicalCase(canonicalCase: CanonicalCase) {
  const safety = assessSafety(canonicalCase.safetyInput);
  const protocol = developmentProtocols.find(
    (candidate) => candidate.goalFamily === canonicalCase.goalFamily,
  );
  if (protocol === undefined) throw new Error("Fixture protocol is missing");
  const eligibilityContext: EligibilityContext = {
    dogProfile: canonicalCase.safetyInput.dogProfile,
    healthContext: canonicalCase.safetyInput.healthContext,
    householdContext: canonicalCase.safetyInput.householdContext,
    ownerProfile: {
      experienceLevel: "some",
      availableMinutesPerDay: 15,
      capabilityCodes: ["capability.marker_delivery"],
      accessibilityConstraintCodes: [],
      confidence: 4,
    },
    safetyAssessment: safety,
    baselineMeasurements: [
      {
        evidenceId: "94000000-0000-4000-8000-000000000001",
        measurement: baselineMeasurement,
      },
    ],
    behaviorConcernCodes:
      canonicalCase.safetyInput.anamnesis.behaviorConcerns.map(
        (concern) => concern.concernCode,
      ),
    mode: "development",
    evaluatedAt: "2026-07-15T12:00:00.000Z",
    presentationLocale: canonicalCase.presentationLocale,
    jurisdiction: canonicalCase.jurisdiction,
    releaseChannel: "channel.web",
    activeRuleSetVersion: developmentSafetyRuleSet.version,
  };
  const eligibility = evaluateProtocolEligibility(protocol, eligibilityContext);
  const plan = generatePlan({
    planId: "95000000-0000-4000-8000-000000000001",
    planVersion: 1,
    prioritisedGoals: [
      {
        goal: {
          id: "95000000-0000-4000-8000-000000000002",
          dogId: canonicalCase.safetyInput.dogProfile.id,
          canonicalGoalType: canonicalCase.goalFamily,
          priority: 1,
          status: "active",
        },
        version: {
          id: "95000000-0000-4000-8000-000000000003",
          goalId: "95000000-0000-4000-8000-000000000002",
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
    protocols: [protocol],
    eligibilityContext,
    ruleSet: developmentSafetyRuleSet,
    mode: "development",
    createdAt: "2026-07-15T12:00:00.000Z",
    schedule: {
      firstSessionAt: "2026-07-16T08:00:00.000Z",
      sessionsPerStep: 3,
      recoveryAfterSessions: 2,
    },
  });
  const progress = evaluateProgress({
    sessions: canonicalCase.progressSessions,
    requiredMetricCodes: ["metric.success_rate"],
    currentDifficulty: 1,
    progressionRules: protocol.progressionRules,
    regressionRules: protocol.regressionRules,
    evaluatedAt: "2026-07-15T12:00:00.000Z",
    recencyWindowDays: 14,
    minimumSessions: 3,
    ruleSet: developmentSafetyRuleSet,
  });
  const adjustment = adjustPlan({
    safetyAssessment: safety,
    progress,
    previousPlanVersion: 1,
    currentDifficulty: 1,
    currentStepCode: protocol.steps[0]!.stepCode,
    prerequisiteStepCode: null,
    triggeredProtocolStopRuleIds: [],
    requiredQuestionCodes: [],
  });

  return { safety, eligibility, plan, progress, adjustment };
}
