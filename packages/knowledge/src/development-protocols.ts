import {
  protocolVersionSchema,
  type MetricCode,
  type ProtocolVersion,
} from "@dogos/contracts";

interface DevelopmentProtocolInput {
  id: string;
  protocolId: string;
  protocolCode: string;
  goalFamily: string;
  stepCode: string;
  measurements: MetricCode[];
  equipment: string[];
  durationSeconds: number;
  repetitions: number;
  safetyCriticalPresentation?: boolean;
}

function developmentProtocol(input: DevelopmentProtocolInput): ProtocolVersion {
  return protocolVersionSchema.parse({
    id: input.id,
    protocolId: input.protocolId,
    protocolCode: input.protocolCode,
    semanticVersion: "0.1.0-development",
    goalFamily: input.goalFamily,
    developmentOnly: true,
    approval: {
      status: "unapproved",
      approvedAt: null,
      expiresAt: null,
      jurisdictions: [],
      releaseChannels: [],
    },
    sourcePlaceholders: [
      "SOURCE_REQUIRED_PROFESSIONAL_PROTOCOL_REVIEW",
      "SOURCE_REQUIRED_SAFETY_REVIEW",
    ],
    prerequisites: [
      {
        code: "prerequisite.owner_can_deliver_marker",
        type: "capability",
        valueCode: "capability.marker_delivery",
      },
      {
        code: "prerequisite.baseline_success_rate",
        type: "baseline_metric",
        metricCode: "metric.success_rate",
      },
    ],
    exclusions: [
      {
        code: "exclusion.non_low_risk_disposition",
        type: "safety_disposition",
        valueCode: "disposition.non_low_risk",
      },
      {
        code: "exclusion.mobility_constraint",
        type: "health_constraint",
        valueCode: "constraint.no_repetitive_movement",
      },
    ],
    requiredBaselineMetrics: ["metric.success_rate"],
    steps: [
      {
        stepCode: input.stepCode,
        sequence: 1,
        durationSeconds: input.durationSeconds,
        repetitions: input.repetitions,
        difficulty: 1,
        measurementCodes: input.measurements,
        prerequisiteStepCodes: [],
        stopConditionCodes: [
          "stop.food_refusal",
          "stop.avoidance",
          "stop.safety_escalation",
        ],
      },
    ],
    progressionRules: [
      {
        ruleId: "progression.success_rate_three_sessions",
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
    stopRuleIds: ["safety.stop_overrides_training"],
    escalationRuleIds: ["safety.require_professional_review"],
    maximumDurationSeconds: input.durationSeconds,
    maximumRepetitions: input.repetitions,
    requiredEquipmentCodes: input.equipment,
    supportedDevelopmentStages: [
      "puppy",
      "adolescent",
      "adult",
      "senior",
      "unknown",
    ],
    supportedEnvironmentCodes: [
      "environment.home_low_distraction",
      "environment.outdoor_low_distraction",
    ],
    ruleSetVersion: "1.0.0",
    safetyCriticalPresentation: input.safetyCriticalPresentation ?? false,
    releasedLocales: [],
  });
}

export const developmentProtocols = Object.freeze([
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000001",
    protocolId: "50000000-0000-4000-8000-000000000001",
    protocolCode: "protocol.marker_timing_foundation",
    goalFamily: "goal.marker_timing",
    stepCode: "step.marker_single_response",
    measurements: ["metric.response_latency_ms", "metric.success_rate"],
    equipment: ["equipment.marker", "equipment.food_reward"],
    durationSeconds: 120,
    repetitions: 8,
  }),
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000002",
    protocolId: "50000000-0000-4000-8000-000000000002",
    protocolCode: "protocol.sit_foundation",
    goalFamily: "goal.sit",
    stepCode: "step.sit_low_distraction",
    measurements: ["metric.success_rate", "metric.response_latency_ms"],
    equipment: ["equipment.food_reward"],
    durationSeconds: 180,
    repetitions: 6,
  }),
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000003",
    protocolId: "50000000-0000-4000-8000-000000000003",
    protocolCode: "protocol.down_foundation",
    goalFamily: "goal.down",
    stepCode: "step.down_low_distraction",
    measurements: ["metric.success_rate", "metric.response_latency_ms"],
    equipment: ["equipment.food_reward", "equipment.non_slip_surface"],
    durationSeconds: 180,
    repetitions: 6,
  }),
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000004",
    protocolId: "50000000-0000-4000-8000-000000000004",
    protocolCode: "protocol.loose_leash_foundation",
    goalFamily: "goal.loose_leash_walking",
    stepCode: "step.loose_leash_low_distraction",
    measurements: [
      "metric.continuous_loose_steps",
      "metric.success_rate",
      "metric.food_acceptance",
      "metric.recovery_seconds",
    ],
    equipment: [
      "equipment.leash",
      "equipment.harness",
      "equipment.food_reward",
    ],
    durationSeconds: 300,
    repetitions: 10,
    safetyCriticalPresentation: true,
  }),
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000005",
    protocolId: "50000000-0000-4000-8000-000000000005",
    protocolCode: "protocol.calm_engagement_foundation",
    goalFamily: "goal.calm_engagement",
    stepCode: "step.calm_engagement_low_distraction",
    measurements: ["metric.engagement_rate", "metric.recovery_seconds"],
    equipment: ["equipment.food_reward", "equipment.settle_mat"],
    durationSeconds: 240,
    repetitions: 8,
  }),
  developmentProtocol({
    id: "51000000-0000-4000-8000-000000000006",
    protocolId: "50000000-0000-4000-8000-000000000006",
    protocolCode: "protocol.recall_low_distraction",
    goalFamily: "goal.recall",
    stepCode: "step.recall_short_distance",
    measurements: [
      "metric.success_rate",
      "metric.response_latency_ms",
      "metric.trigger_distance_m",
    ],
    equipment: [
      "equipment.long_line",
      "equipment.harness",
      "equipment.food_reward",
    ],
    durationSeconds: 240,
    repetitions: 6,
    safetyCriticalPresentation: true,
  }),
]);

export function findDevelopmentProtocols(
  goalFamily: string,
): ProtocolVersion[] {
  return developmentProtocols.filter(
    (protocol) => protocol.goalFamily === goalFamily,
  );
}
