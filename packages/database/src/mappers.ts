import {
  measurementSchema,
  planAdjustmentSchema,
  progressEvaluationSchema,
  riskAssessmentSchema,
  type AdjustmentDecision,
  type Measurement,
  type PlanAdjustment,
  type ProfessionalDisposition,
  type ProgressEvaluation,
  type RiskAssessment,
  type SafetyDisposition,
} from "@dogos/contracts";

function decode<T extends string>(
  map: Readonly<Record<T, string>>,
  value: string,
  label: string,
): T {
  const entry = Object.entries(map).find(([, encoded]) => encoded === value);
  if (entry === undefined) throw new Error(`Unsupported ${label}: ${value}`);
  return entry[0] as T;
}

export const riskLevelEncoding = {
  unknown: "risk.unknown",
  low: "risk.low",
  moderate: "risk.moderate",
  high: "risk.high",
  urgent: "risk.urgent",
} as const satisfies Record<RiskAssessment["riskLevel"], string>;
export const safetyDispositionEncoding = {
  continue_low_risk_training: "disposition.continue_low_risk_training",
  require_more_information: "disposition.require_more_information",
  require_trainer_review: "disposition.require_trainer_review",
  require_veterinary_review: "disposition.require_veterinary_review",
  stop_training: "disposition.stop_training",
  urgent_safety_message: "disposition.urgent_safety_message",
} as const satisfies Record<SafetyDisposition, string>;
export const progressStatusEncoding = {
  insufficient_data: "progress.insufficient_data",
  stable: "progress.stable",
  improving: "progress.improving",
  regressing: "progress.regressing",
  mixed: "progress.mixed",
  requires_review: "progress.requires_review",
} as const satisfies Record<ProgressEvaluation["status"], string>;
export const candidateActionEncoding = {
  continue_plan: "action.continue_plan",
  repeat_step: "action.repeat_step",
  reduce_difficulty: "action.reduce_difficulty",
  increase_difficulty: "action.increase_difficulty",
  ask_for_information: "action.ask_for_information",
  require_professional_review: "action.require_professional_review",
} as const satisfies Record<ProgressEvaluation["candidateNextAction"], string>;
export const adjustmentDecisionEncoding = {
  continue_plan: "adjustment.continue_plan",
  repeat_step: "adjustment.repeat_step",
  reduce_difficulty: "adjustment.reduce_difficulty",
  increase_difficulty: "adjustment.increase_difficulty",
  train_prerequisite: "adjustment.train_prerequisite",
  schedule_rest: "adjustment.schedule_rest",
  ask_for_information: "adjustment.ask_for_information",
  require_professional_review: "adjustment.require_professional_review",
  stop_training: "adjustment.stop_training",
} as const satisfies Record<AdjustmentDecision, string>;
export const professionalDispositionEncoding = {
  none: "escalate.none",
  trainer_review: "escalate.trainer_review",
  veterinary_review: "escalate.veterinary_review",
  urgent_support: "escalate.urgent_support",
} as const satisfies Record<ProfessionalDisposition["type"], string>;

export interface MeasurementPersistenceDTO {
  metric_code: string;
  value_numeric: number | null;
  value_boolean: boolean | null;
  value_text: string | null;
  value_json: unknown | null;
  is_unknown: boolean;
  unknown_reason: string | null;
  unit_code: string | null;
  source: Measurement["source"];
  method_code: string | null;
  measured_at: string;
  environment_code: string | null;
  quality: Measurement["quality"];
}

export function measurementToPersistenceDTO(
  raw: Measurement,
): MeasurementPersistenceDTO {
  const value = measurementSchema.parse(raw);
  return {
    metric_code: value.metricCode,
    value_numeric: typeof value.value === "number" ? value.value : null,
    value_boolean: typeof value.value === "boolean" ? value.value : null,
    value_text: typeof value.value === "string" ? value.value : null,
    value_json: null,
    is_unknown: value.unknown,
    unknown_reason: value.unknownReason ?? null,
    unit_code: value.unit,
    source: value.source,
    method_code: value.method,
    measured_at: value.measuredAt,
    environment_code: value.environmentCode ?? null,
    quality: value.quality,
  };
}

export function measurementFromPersistenceDTO(
  row: MeasurementPersistenceDTO,
): Measurement {
  const values = [
    row.value_numeric,
    row.value_boolean,
    row.value_text,
    row.value_json,
  ].filter((value) => value !== null);
  if (!row.is_unknown && values.length !== 1)
    throw new Error("Known measurement DTO requires exactly one value");
  return measurementSchema.parse({
    metricCode: row.metric_code,
    value: row.is_unknown ? null : values[0],
    unit: row.unit_code,
    unknown: row.is_unknown,
    ...(row.unknown_reason === null
      ? {}
      : { unknownReason: row.unknown_reason }),
    source: row.source,
    method: row.method_code,
    measuredAt: row.measured_at,
    ...(row.environment_code === null
      ? {}
      : { environmentCode: row.environment_code }),
    quality: row.quality,
  });
}

export interface RiskAssessmentPersistenceDTO {
  risk_level_code: string;
  disposition_code: string;
  triggered_rule_codes: string[];
  reason_codes: RiskAssessment["reasonCodes"];
  evidence_ids: string[];
  permitted_action_codes: string[];
  prohibited_action_codes: string[];
  required_question_codes: string[];
  rule_set_id: string;
  rule_set_version: string;
}
export function riskAssessmentToPersistenceDTO(
  raw: RiskAssessment,
): RiskAssessmentPersistenceDTO {
  const value = riskAssessmentSchema.parse(raw);
  return {
    risk_level_code: riskLevelEncoding[value.riskLevel],
    disposition_code: safetyDispositionEncoding[value.disposition],
    triggered_rule_codes: value.triggeredRuleIds,
    reason_codes: value.reasonCodes,
    evidence_ids: value.evidenceIds,
    permitted_action_codes: value.permittedNextActionCodes,
    prohibited_action_codes: value.prohibitedActionCodes,
    required_question_codes: value.requiredQuestionCodes,
    rule_set_id: value.ruleSetId,
    rule_set_version: value.ruleSetVersion,
  };
}
export function riskAssessmentFromPersistenceDTO(
  row: RiskAssessmentPersistenceDTO,
): RiskAssessment {
  return riskAssessmentSchema.parse({
    riskLevel: decode(riskLevelEncoding, row.risk_level_code, "risk level"),
    disposition: decode(
      safetyDispositionEncoding,
      row.disposition_code,
      "safety disposition",
    ),
    triggeredRuleIds: row.triggered_rule_codes,
    reasonCodes: row.reason_codes,
    evidenceIds: row.evidence_ids,
    permittedNextActionCodes: row.permitted_action_codes,
    prohibitedActionCodes: row.prohibited_action_codes,
    requiredQuestionCodes: row.required_question_codes,
    ruleSetId: row.rule_set_id,
    ruleSetVersion: row.rule_set_version,
  });
}

export interface ProgressEvaluationPersistenceDTO {
  status_code: string;
  confidence: ProgressEvaluation["confidence"];
  evidence_ids: string[];
  missing_metric_codes: ProgressEvaluation["missingMetricCodes"];
  reason_codes: ProgressEvaluation["reasonCodes"];
  candidate_next_action: string;
  engine_version: string;
  rule_set_id: string;
  rule_set_version: string;
  dimensions: ProgressEvaluation["dimensions"];
}
export function progressEvaluationToPersistenceDTO(
  raw: ProgressEvaluation,
): ProgressEvaluationPersistenceDTO {
  const value = progressEvaluationSchema.parse(raw);
  return {
    status_code: progressStatusEncoding[value.status],
    confidence: value.confidence,
    evidence_ids: value.evidenceIds,
    missing_metric_codes: value.missingMetricCodes,
    reason_codes: value.reasonCodes,
    candidate_next_action: candidateActionEncoding[value.candidateNextAction],
    engine_version: value.engineVersion,
    rule_set_id: value.ruleSetId,
    rule_set_version: value.ruleSetVersion,
    dimensions: value.dimensions,
  };
}
export function progressEvaluationFromPersistenceDTO(
  row: ProgressEvaluationPersistenceDTO,
): ProgressEvaluation {
  return progressEvaluationSchema.parse({
    status: decode(progressStatusEncoding, row.status_code, "progress status"),
    confidence: row.confidence,
    evidenceIds: row.evidence_ids,
    missingMetricCodes: row.missing_metric_codes,
    reasonCodes: row.reason_codes,
    candidateNextAction: decode(
      candidateActionEncoding,
      row.candidate_next_action,
      "candidate action",
    ),
    engineVersion: row.engine_version,
    ruleSetId: row.rule_set_id,
    ruleSetVersion: row.rule_set_version,
    dimensions: row.dimensions,
  });
}

export interface PlanAdjustmentPersistenceDTO {
  decision_code: string;
  previous_plan_version: number;
  proposed_difficulty: number | null;
  proposed_step_code: string | null;
  evidence_ids: string[];
  triggered_rule_ids: string[];
  reason_codes: PlanAdjustment["reasonCodes"];
  required_question_codes: string[];
  escalation_code: string;
  professional_disposition: ProfessionalDisposition;
  new_plan_version_required: boolean;
}
export function planAdjustmentToPersistenceDTO(
  raw: PlanAdjustment,
): PlanAdjustmentPersistenceDTO {
  const value = planAdjustmentSchema.parse(raw);
  return {
    decision_code: adjustmentDecisionEncoding[value.decision],
    previous_plan_version: value.previousPlanVersion,
    proposed_difficulty: value.proposedDifficulty,
    proposed_step_code: value.proposedStepCode,
    evidence_ids: value.evidenceIds,
    triggered_rule_ids: value.triggeredRuleIds,
    reason_codes: value.reasonCodes,
    required_question_codes: value.requiredQuestionCodes,
    escalation_code:
      professionalDispositionEncoding[value.professionalDisposition.type],
    professional_disposition: value.professionalDisposition,
    new_plan_version_required: value.newPlanVersionRequired,
  };
}
export function planAdjustmentFromPersistenceDTO(
  row: PlanAdjustmentPersistenceDTO,
): PlanAdjustment {
  const disposition = decode(
    professionalDispositionEncoding,
    row.escalation_code,
    "professional disposition",
  );
  if (row.professional_disposition.type !== disposition)
    throw new Error("Professional disposition encoding mismatch");
  return planAdjustmentSchema.parse({
    decision: decode(
      adjustmentDecisionEncoding,
      row.decision_code,
      "adjustment decision",
    ),
    previousPlanVersion: row.previous_plan_version,
    proposedDifficulty: row.proposed_difficulty,
    proposedStepCode: row.proposed_step_code,
    evidenceIds: row.evidence_ids,
    triggeredRuleIds: row.triggered_rule_ids,
    reasonCodes: row.reason_codes,
    requiredQuestionCodes: row.required_question_codes,
    professionalDisposition: row.professional_disposition,
    newPlanVersionRequired: row.new_plan_version_required,
  });
}
