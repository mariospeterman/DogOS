import type {
  PlanAdjustment,
  ProgressEvaluation,
  RiskAssessment,
} from "./decisions.js";
import { measurementSchema, type Measurement } from "./measurement.js";

export interface MeasurementDatabaseRow {
  metric_code: string;
  value_numeric: number | null;
  value_boolean: boolean | null;
  value_text: string | null;
  value_json?: unknown | null;
  is_unknown: boolean;
  unknown_reason: string | null;
  unit_code: string | null;
  source: string;
  method_code: string | null;
  measured_at: string;
  environment_code: string | null;
  quality: string;
}

export interface PersistRiskAssessmentCommand {
  readonly kind: "persist_risk_assessment";
  readonly decision: RiskAssessment;
}

export interface PersistProgressEvaluationCommand {
  readonly kind: "persist_progress_evaluation";
  readonly decision: ProgressEvaluation;
}

export interface PersistPlanAdjustmentCommand {
  readonly kind: "persist_plan_adjustment";
  readonly decision: PlanAdjustment;
}

export type PersistenceCommand =
  | PersistRiskAssessmentCommand
  | PersistProgressEvaluationCommand
  | PersistPlanAdjustmentCommand;

const sourceMap = {
  user_report: "owner_report",
  owner_report: "owner_report",
  trainer_report: "trainer_report",
  system: "system",
  future_video: "future_video",
} as const;

export function measurementFromDatabaseRow(
  row: MeasurementDatabaseRow,
): Measurement {
  const populatedValues = [
    row.value_numeric,
    row.value_boolean,
    row.value_text,
    row.value_json ?? null,
  ].filter((value) => value !== null);

  if (!row.is_unknown && populatedValues.length !== 1) {
    throw new Error("Known measurement rows require exactly one value");
  }

  const source = sourceMap[row.source as keyof typeof sourceMap];
  if (source === undefined) {
    throw new Error(`Unsupported measurement source: ${row.source}`);
  }

  return measurementSchema.parse({
    metricCode: row.metric_code,
    value: row.is_unknown ? null : populatedValues[0],
    unit: row.unit_code,
    unknown: row.is_unknown,
    ...(row.unknown_reason === null
      ? {}
      : { unknownReason: row.unknown_reason }),
    source,
    method: row.method_code,
    measuredAt: row.measured_at,
    ...(row.environment_code === null
      ? {}
      : { environmentCode: row.environment_code }),
    quality: row.quality,
  });
}

export function toPersistenceCommand(
  decision: RiskAssessment | ProgressEvaluation | PlanAdjustment,
): PersistenceCommand {
  if ("riskLevel" in decision) {
    return { kind: "persist_risk_assessment", decision };
  }
  if ("dimensions" in decision) {
    return { kind: "persist_progress_evaluation", decision };
  }
  return { kind: "persist_plan_adjustment", decision };
}
