import {
  goalSchema,
  goalVersionSchema,
  isoTimestampSchema,
  planGenerationResultSchema,
  protocolVersionSchema,
  ruleSetSchema,
  type Goal,
  type GoalVersion,
  type PlanGenerationResult,
  type ProtocolVersion,
  type RuleSet,
} from "@dogos/contracts";
import { z } from "zod";

import {
  eligibilityContextSchema,
  evaluateProtocolEligibility,
  type EligibilityContext,
} from "./eligibility.js";

const prioritisedGoalSchema = z.strictObject({
  goal: goalSchema,
  version: goalVersionSchema,
});

export const planGenerationInputSchema = z.strictObject({
  planId: z.uuid(),
  planVersion: z.number().int().positive(),
  prioritisedGoals: z.array(prioritisedGoalSchema).min(1),
  protocols: z.array(protocolVersionSchema),
  eligibilityContext: eligibilityContextSchema,
  ruleSet: ruleSetSchema,
  mode: z.enum(["development", "production"]),
  createdAt: isoTimestampSchema,
  schedule: z.strictObject({
    firstSessionAt: isoTimestampSchema,
    sessionsPerStep: z.number().int().positive().max(14),
    recoveryAfterSessions: z.number().int().positive().max(14).nullable(),
  }),
});

export interface PlanGenerationInput {
  planId: string;
  planVersion: number;
  prioritisedGoals: Array<{ goal: Goal; version: GoalVersion }>;
  protocols: ProtocolVersion[];
  eligibilityContext: EligibilityContext;
  ruleSet: RuleSet;
  mode: "development" | "production";
  createdAt: string;
  schedule: {
    firstSessionAt: string;
    sessionsPerStep: number;
    recoveryAfterSessions: number | null;
  };
}

function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

interface ParsedSemanticVersion {
  core: [number, number, number];
  prerelease: string[] | null;
}

function parseSemanticVersion(version: string): ParsedSemanticVersion {
  const separator = version.indexOf("-");
  const core = separator === -1 ? version : version.slice(0, separator);
  const prerelease =
    separator === -1 ? undefined : version.slice(separator + 1);
  const [major, minor, patch] = core.split(".").map(Number);
  return {
    core: [major!, minor!, patch!],
    prerelease: prerelease === undefined ? null : prerelease.split("."),
  };
}

function comparePrerelease(
  left: string[] | null,
  right: string[] | null,
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart);
    const rightNumber = /^\d+$/.test(rightPart);
    if (leftNumber && rightNumber) return Number(leftPart) - Number(rightPart);
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export function compareSemanticVersions(left: string, right: string): number {
  const parsedLeft = parseSemanticVersion(left);
  const parsedRight = parseSemanticVersion(right);
  for (let index = 0; index < parsedLeft.core.length; index += 1) {
    const difference = parsedLeft.core[index]! - parsedRight.core[index]!;
    if (difference !== 0) return difference;
  }
  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

function buildSchedule(protocol: ProtocolVersion, input: PlanGenerationInput) {
  const sessions: Array<{
    sessionKey: string;
    stepCode: string;
    plannedStart: string;
    durationSeconds: number;
    purposeCode: string;
    recoveryDay: boolean;
    observationOnly: boolean;
  }> = [];
  let dayOffset = 0;
  let trainingCount = 0;

  for (const step of protocol.steps) {
    for (
      let repetition = 1;
      repetition <= input.schedule.sessionsPerStep;
      repetition += 1
    ) {
      if (
        input.schedule.recoveryAfterSessions !== null &&
        trainingCount > 0 &&
        trainingCount % input.schedule.recoveryAfterSessions === 0
      ) {
        sessions.push({
          sessionKey: `${step.stepCode}:recovery:${trainingCount}`,
          stepCode: step.stepCode,
          plannedStart: addDays(input.schedule.firstSessionAt, dayOffset),
          durationSeconds: 60,
          purposeCode: "session.recovery_observation",
          recoveryDay: true,
          observationOnly: true,
        });
        dayOffset += 1;
      }
      sessions.push({
        sessionKey: `${step.stepCode}:training:${repetition}`,
        stepCode: step.stepCode,
        plannedStart: addDays(input.schedule.firstSessionAt, dayOffset),
        durationSeconds: Math.min(
          step.durationSeconds,
          protocol.maximumDurationSeconds,
        ),
        purposeCode: "session.protocol_training",
        recoveryDay: false,
        observationOnly: false,
      });
      dayOffset += 1;
      trainingCount += 1;
    }
  }
  return sessions;
}

export function generatePlan(
  rawInput: PlanGenerationInput,
): PlanGenerationResult {
  const input = planGenerationInputSchema.parse(rawInput);
  const activeGoals = input.prioritisedGoals.filter(
    ({ goal }) => goal.status === "active",
  );
  const highestPriority = Math.min(
    ...activeGoals.map(({ goal }) => goal.priority),
  );
  const topGoals = activeGoals.filter(
    ({ goal }) => goal.priority === highestPriority,
  );
  if (topGoals.length !== 1) {
    return planGenerationResultSchema.parse({
      status: "blocked",
      reasonCodes: ["PLAN_MULTIPLE_PRIORITISED_GOALS"],
      requiredQuestionCodes: [],
      evidenceIds: [],
    });
  }
  const selectedGoal = topGoals[0];
  if (
    selectedGoal === undefined ||
    selectedGoal.version.measurementCodes.length === 0
  ) {
    return planGenerationResultSchema.parse({
      status: "blocked",
      reasonCodes: ["PLAN_GOAL_NOT_MEASURABLE"],
      requiredQuestionCodes: [],
      evidenceIds: [],
    });
  }

  const matching = input.protocols
    .filter(
      (protocol) => protocol.goalFamily === selectedGoal.goal.canonicalGoalType,
    )
    .sort(
      (left, right) =>
        compareSemanticVersions(right.semanticVersion, left.semanticVersion) ||
        left.protocolCode.localeCompare(right.protocolCode),
    );
  if (matching.length === 0) {
    return planGenerationResultSchema.parse({
      status: "unsupported",
      reasonCodes: ["PLAN_UNSUPPORTED_GOAL"],
      requiredQuestionCodes: [],
      evidenceIds: [],
    });
  }

  const evaluations = matching.map((protocol) => ({
    protocol,
    eligibility: evaluateProtocolEligibility(protocol, {
      ...input.eligibilityContext,
      mode: input.mode,
      activeRuleSetVersion: input.ruleSet.version,
    }),
  }));
  const selected = evaluations.find(
    ({ eligibility }) => eligibility.status === "eligible",
  );
  if (selected === undefined) {
    return planGenerationResultSchema.parse({
      status: "blocked",
      reasonCodes: [
        "PLAN_NO_ELIGIBLE_PROTOCOL",
        ...[
          ...new Set(
            evaluations.flatMap(({ eligibility }) => eligibility.reasonCodes),
          ),
        ].sort(),
      ],
      requiredQuestionCodes:
        input.eligibilityContext.safetyAssessment.requiredQuestionCodes,
      evidenceIds: [
        ...new Set(
          evaluations.flatMap(({ eligibility }) => eligibility.evidenceIds),
        ),
      ].sort(),
    });
  }

  const protocol = selected.protocol;
  return planGenerationResultSchema.parse({
    status: "generated",
    plan: {
      id: input.planId,
      dogId: selectedGoal.goal.dogId,
      goalVersionId: selectedGoal.version.id,
      status: "active",
      activeVersion: {
        version: input.planVersion,
        protocolVersionId: protocol.id,
        protocolSemanticVersion: protocol.semanticVersion,
        ruleSetId: input.ruleSet.id,
        ruleSetVersion: input.ruleSet.version,
        generationMode: input.mode,
        generationReasonCodes:
          input.mode === "development"
            ? ["PLAN_GENERATED_DEVELOPMENT_ONLY"]
            : [],
        steps: protocol.steps.map((step) => ({
          stepCode: step.stepCode,
          sequence: step.sequence,
          difficulty: step.difficulty,
          durationSeconds: Math.min(
            step.durationSeconds,
            protocol.maximumDurationSeconds,
          ),
          repetitions: Math.min(step.repetitions, protocol.maximumRepetitions),
          measurementCodes: step.measurementCodes,
          prerequisiteStepCodes: step.prerequisiteStepCodes,
          stopConditionCodes: step.stopConditionCodes,
        })),
        scheduledSessions: buildSchedule(protocol, input),
        progressionRules: protocol.progressionRules,
        regressionRules: protocol.regressionRules,
        stopRuleIds: protocol.stopRuleIds,
        escalationRuleIds: protocol.escalationRuleIds,
        createdAt: input.createdAt,
      },
    },
    eligibility: evaluations.map(({ protocol: candidate, eligibility }) => ({
      protocolVersionId: candidate.id,
      status: eligibility.status,
    })),
  });
}
