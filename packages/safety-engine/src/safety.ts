import {
  anamnesisSchema,
  canonicalCodeSchema,
  dogProfileSchema,
  healthContextSchema,
  householdContextSchema,
  observationSchema,
  riskAssessmentSchema,
  ruleSetSchema,
  type Anamnesis,
  type DogProfile,
  type HealthContext,
  type HouseholdContext,
  type Observation,
  type ReasonCode,
  type RiskAssessment,
  type SafetyDisposition,
} from "@dogos/contracts";
import { z } from "zod";

export const developmentSafetyRuleSet = ruleSetSchema.parse({
  id: "52000000-0000-4000-8000-000000000101",
  ruleSetCode: "rules.safety_development",
  version: "1.0.0",
  developmentOnly: true,
  rules: [
    {
      ruleId: "safety.recent_bite_child",
      priority: 1,
      reasonCode: "SAFETY_CHILD_INVOLVED",
    },
    {
      ruleId: "safety.uncontrolled_aggression",
      priority: 2,
      reasonCode: "SAFETY_UNCONTROLLED_AGGRESSION",
    },
    { ruleId: "safety.injury", priority: 3, reasonCode: "SAFETY_INJURY" },
    {
      ruleId: "safety.suspected_pain",
      priority: 4,
      reasonCode: "SAFETY_SUSPECTED_PAIN",
    },
    {
      ruleId: "safety.sudden_behavior_change",
      priority: 5,
      reasonCode: "SAFETY_SUDDEN_BEHAVIOR_CHANGE",
    },
    {
      ruleId: "safety.recent_bite",
      priority: 6,
      reasonCode: "SAFETY_RECENT_BITE",
    },
    {
      ruleId: "safety.recent_snap",
      priority: 7,
      reasonCode: "SAFETY_RECENT_SNAP",
    },
    {
      ruleId: "safety.severe_fear_or_panic",
      priority: 8,
      reasonCode: "SAFETY_SEVERE_FEAR_OR_PANIC",
    },
    {
      ruleId: "safety.food_refusal_avoidance",
      priority: 9,
      reasonCode: "SAFETY_FOOD_REFUSAL_WITH_AVOIDANCE",
    },
    {
      ruleId: "safety.escape_risk",
      priority: 10,
      reasonCode: "SAFETY_ESCAPE_RISK",
    },
    {
      ruleId: "safety.missing_critical_answers",
      priority: 11,
      reasonCode: "SAFETY_INSUFFICIENT_INFORMATION",
    },
    {
      ruleId: "safety.unsupported_environment",
      priority: 12,
      reasonCode: "SAFETY_UNSUPPORTED_ENVIRONMENT",
    },
  ],
});

export const safetyAssessmentInputSchema = z.strictObject({
  dogProfile: dogProfileSchema,
  healthContext: healthContextSchema,
  householdContext: householdContextSchema,
  anamnesis: anamnesisSchema,
  observations: z.array(observationSchema),
  currentEnvironmentCode: canonicalCodeSchema.nullable(),
  supportedEnvironmentCodes: z.array(canonicalCodeSchema),
  requiredSafetyQuestionCodes: z.array(canonicalCodeSchema),
});

export interface SafetyAssessmentInput {
  dogProfile: DogProfile;
  healthContext: HealthContext;
  householdContext: HouseholdContext;
  anamnesis: Anamnesis;
  observations: Observation[];
  currentEnvironmentCode: string | null;
  supportedEnvironmentCodes: string[];
  requiredSafetyQuestionCodes: string[];
}

interface MatchedRule {
  ruleId: string;
  reasonCode: ReasonCode;
  evidenceIds: string[];
}

function findAnswer(input: SafetyAssessmentInput, questionCode: string) {
  return input.anamnesis.answers.find(
    (answer) => answer.questionCode === questionCode,
  );
}

function eventMatches(
  input: SafetyAssessmentInput,
  eventCode: string,
  recency?: "recent" | "historical" | "unknown",
) {
  return input.anamnesis.safetyEvents.filter(
    (event) =>
      event.eventCode === eventCode &&
      (recency === undefined || event.recency === recency),
  );
}

function matchRules(input: SafetyAssessmentInput): MatchedRule[] {
  const matched: MatchedRule[] = [];
  const add = (ruleId: string, reasonCode: ReasonCode, evidenceIds: string[]) =>
    matched.push({ ruleId, reasonCode, evidenceIds });

  const recentBites = eventMatches(input, "safety.bite", "recent");
  const recentSnaps = eventMatches(input, "safety.snap", "recent");
  const childEvents = input.anamnesis.safetyEvents.filter(
    (event) =>
      event.eventCode === "safety.child_involved" ||
      event.childInvolved === true,
  );
  if (
    recentBites.some((event) => event.childInvolved === true) ||
    childEvents.length > 0
  ) {
    add(
      "safety.recent_bite_child",
      "SAFETY_CHILD_INVOLVED",
      [...recentBites, ...childEvents].flatMap((event) => [
        event.id,
        ...event.evidenceIds,
      ]),
    );
  }

  const uncontrolled = eventMatches(input, "safety.uncontrolled_aggression");
  if (uncontrolled.length > 0) {
    add(
      "safety.uncontrolled_aggression",
      "SAFETY_UNCONTROLLED_AGGRESSION",
      uncontrolled.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }

  const injuries = input.anamnesis.safetyEvents.filter(
    (event) =>
      event.eventCode === "safety.injury" || event.injuryOccurred === true,
  );
  if (injuries.length > 0) {
    add(
      "safety.injury",
      "SAFETY_INJURY",
      injuries.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }
  if (input.healthContext.suspectedPain === true) {
    add(
      "safety.suspected_pain",
      "SAFETY_SUSPECTED_PAIN",
      input.healthContext.evidenceIds,
    );
  }
  if (input.healthContext.suddenBehaviorChange === true) {
    add(
      "safety.sudden_behavior_change",
      "SAFETY_SUDDEN_BEHAVIOR_CHANGE",
      input.healthContext.evidenceIds,
    );
  }
  if (recentBites.length > 0) {
    add(
      "safety.recent_bite",
      "SAFETY_RECENT_BITE",
      recentBites.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }
  if (recentSnaps.length > 0) {
    add(
      "safety.recent_snap",
      "SAFETY_RECENT_SNAP",
      recentSnaps.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }

  const fearEvents = eventMatches(input, "safety.severe_fear_or_panic");
  if (fearEvents.length > 0) {
    add(
      "safety.severe_fear_or_panic",
      "SAFETY_SEVERE_FEAR_OR_PANIC",
      fearEvents.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }

  const foodRefusal = input.observations.filter(
    (observation) => observation.observationCode === "observation.food_refused",
  );
  const avoidance = input.observations.filter((observation) =>
    [
      "observation.moved_away_from_trigger",
      "observation.avoidance_indicator",
    ].includes(observation.observationCode),
  );
  if (foodRefusal.length > 0 && avoidance.length > 0) {
    add(
      "safety.food_refusal_avoidance",
      "SAFETY_FOOD_REFUSAL_WITH_AVOIDANCE",
      [...foodRefusal, ...avoidance].flatMap((observation) => [
        observation.id,
        ...observation.evidenceIds,
      ]),
    );
  }

  const escapes = eventMatches(input, "safety.escape");
  if (escapes.length > 0) {
    add(
      "safety.escape_risk",
      "SAFETY_ESCAPE_RISK",
      escapes.flatMap((event) => [event.id, ...event.evidenceIds]),
    );
  }

  const missingQuestions = input.requiredSafetyQuestionCodes.filter(
    (question) => {
      const answer = findAnswer(input, question);
      return answer === undefined || answer.state !== "answered";
    },
  );
  if (!input.anamnesis.completed || missingQuestions.length > 0) {
    add(
      "safety.missing_critical_answers",
      "SAFETY_INSUFFICIENT_INFORMATION",
      [],
    );
  }

  if (
    input.currentEnvironmentCode === null ||
    !input.supportedEnvironmentCodes.includes(input.currentEnvironmentCode)
  ) {
    add("safety.unsupported_environment", "SAFETY_UNSUPPORTED_ENVIRONMENT", []);
  }

  const priorities = new Map(
    developmentSafetyRuleSet.rules.map((rule) => [rule.ruleId, rule.priority]),
  );
  return matched.sort(
    (left, right) =>
      (priorities.get(left.ruleId) ?? Number.MAX_SAFE_INTEGER) -
        (priorities.get(right.ruleId) ?? Number.MAX_SAFE_INTEGER) ||
      left.ruleId.localeCompare(right.ruleId),
  );
}

function dispositionFor(matched: MatchedRule[]): {
  disposition: SafetyDisposition;
  riskLevel: RiskAssessment["riskLevel"];
} {
  const reasons = new Set(matched.map((rule) => rule.reasonCode));
  if (
    reasons.has("SAFETY_CHILD_INVOLVED") ||
    reasons.has("SAFETY_UNCONTROLLED_AGGRESSION")
  ) {
    return { disposition: "urgent_safety_message", riskLevel: "urgent" };
  }
  if (
    reasons.has("SAFETY_INJURY") ||
    reasons.has("SAFETY_SUSPECTED_PAIN") ||
    reasons.has("SAFETY_SUDDEN_BEHAVIOR_CHANGE")
  ) {
    return { disposition: "require_veterinary_review", riskLevel: "high" };
  }
  if (
    reasons.has("SAFETY_RECENT_BITE") ||
    reasons.has("SAFETY_RECENT_SNAP") ||
    reasons.has("SAFETY_ESCAPE_RISK")
  ) {
    return { disposition: "require_trainer_review", riskLevel: "high" };
  }
  if (
    reasons.has("SAFETY_SEVERE_FEAR_OR_PANIC") ||
    reasons.has("SAFETY_FOOD_REFUSAL_WITH_AVOIDANCE")
  ) {
    return { disposition: "stop_training", riskLevel: "high" };
  }
  if (
    reasons.has("SAFETY_INSUFFICIENT_INFORMATION") ||
    reasons.has("SAFETY_UNSUPPORTED_ENVIRONMENT")
  ) {
    return { disposition: "require_more_information", riskLevel: "unknown" };
  }
  return { disposition: "continue_low_risk_training", riskLevel: "low" };
}

export function assessSafety(rawInput: SafetyAssessmentInput): RiskAssessment {
  const input = safetyAssessmentInputSchema.parse(rawInput);
  const matched = matchRules(input);
  const { disposition, riskLevel } = dispositionFor(matched);
  const requiredQuestionCodes = input.requiredSafetyQuestionCodes
    .filter((question) => {
      const answer = findAnswer(input, question);
      return answer === undefined || answer.state !== "answered";
    })
    .sort();

  return riskAssessmentSchema.parse({
    riskLevel,
    disposition,
    triggeredRuleIds: matched.map((rule) => rule.ruleId),
    reasonCodes: [...new Set(matched.map((rule) => rule.reasonCode))],
    evidenceIds: [
      ...new Set(matched.flatMap((rule) => rule.evidenceIds)),
    ].sort(),
    prohibitedActionCodes:
      disposition === "continue_low_risk_training"
        ? []
        : ["action.autonomous_training", "action.plan_generation"],
    requiredQuestionCodes,
    permittedNextActionCodes:
      disposition === "continue_low_risk_training"
        ? ["action.plan_generation", "action.low_risk_training"]
        : disposition === "require_more_information"
          ? ["action.collect_required_information"]
          : ["action.professional_escalation", "action.management_only"],
    ruleSetId: developmentSafetyRuleSet.id,
    ruleSetVersion: developmentSafetyRuleSet.version,
  });
}
