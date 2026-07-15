import { describe, expect, it } from "vitest";

import {
  hypothesisSchema,
  measurementFromDatabaseRow,
  measurementSchema,
  planGenerationResultSchema,
  riskAssessmentSchema,
} from "./index.js";

const measuredAt = "2026-07-15T08:00:00.000Z";

describe("measurement contract", () => {
  it("preserves zero as a known value", () => {
    const measurement = measurementSchema.parse({
      metricCode: "metric.continuous_loose_steps",
      value: 0,
      unit: "unit.count",
      unknown: false,
      source: "owner_report",
      method: "method.direct_count",
      measuredAt,
      quality: "moderate",
    });

    expect(measurement.value).toBe(0);
    expect(measurement.unknown).toBe(false);
  });

  it("rejects unknown measurements with values", () => {
    expect(() =>
      measurementSchema.parse({
        metricCode: "metric.success_rate",
        value: 0,
        unit: "unit.percent",
        unknown: true,
        unknownReason: "unknown.not_measured",
        source: "owner_report",
        method: null,
        measuredAt,
        quality: "unavailable",
      }),
    ).toThrow(/value = null/);
  });

  it.each([-0.1, 100.1])("rejects out-of-range percentages: %s", (value) => {
    expect(() =>
      measurementSchema.parse({
        metricCode: "metric.success_rate",
        value,
        unit: "unit.percent",
        unknown: false,
        source: "system",
        method: "method.calculated_rate",
        measuredAt,
        quality: "high",
      }),
    ).toThrow(/metric (minimum|maximum)/);
  });

  it("rejects unsupported metrics and incorrect units", () => {
    expect(() =>
      measurementSchema.parse({
        metricCode: "metric.unreviewed_magic_score",
        value: 2,
        unit: "unit.count",
        unknown: false,
        source: "system",
        method: null,
        measuredAt,
        quality: "low",
      }),
    ).toThrow();
    expect(() =>
      measurementSchema.parse({
        metricCode: "metric.response_latency_ms",
        value: 20,
        unit: "unit.second",
        unknown: false,
        source: "system",
        method: null,
        measuredAt,
        quality: "high",
      }),
    ).toThrow(/unit.millisecond/);
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      measurementSchema.parse({
        metricCode: "metric.food_acceptance",
        value: true,
        unit: null,
        unknown: false,
        source: "owner_report",
        method: null,
        measuredAt: "yesterday",
        quality: "moderate",
      }),
    ).toThrow();
  });

  it("maps a database unknown without treating it as zero", () => {
    const measurement = measurementFromDatabaseRow({
      metric_code: "metric.continuous_loose_steps",
      value_numeric: null,
      value_boolean: null,
      value_text: null,
      is_unknown: true,
      unknown_reason: "unknown.not_observed",
      unit_code: "unit.count",
      source: "owner_report",
      method_code: null,
      measured_at: measuredAt,
      environment_code: null,
      quality: "unavailable",
    });

    expect(measurement).toMatchObject({ unknown: true, value: null });
  });
});

describe("decision contracts", () => {
  it("rejects localized prose and unknown keys", () => {
    expect(() =>
      riskAssessmentSchema.parse({
        riskLevel: "low",
        disposition: "continue_low_risk_training",
        triggeredRuleIds: [],
        reasonCodes: [],
        evidenceIds: [],
        prohibitedActionCodes: [],
        requiredQuestionCodes: [],
        permittedNextActionCodes: ["action.training_plan_generation"],
        ruleSetId: "52000000-0000-0000-0000-000000000001",
        ruleSetVersion: "1.0.0",
        germanExplanation: "Weiter trainieren",
      }),
    ).toThrow();
  });

  it("uses a discriminated plan result", () => {
    const result = planGenerationResultSchema.parse({
      status: "blocked",
      reasonCodes: ["PLAN_NO_ELIGIBLE_PROTOCOL"],
      requiredQuestionCodes: [],
      evidenceIds: [],
    });
    expect(result.status).toBe("blocked");
  });

  it.each([
    "hypothesis.clinical_anxiety",
    "hypothesis.trauma",
    "hypothesis.depression",
    "hypothesis.dominance",
    "hypothesis.medical_pain_diagnosis",
  ])("rejects diagnostic hypothesis %s", (hypothesisCode) => {
    expect(() =>
      hypothesisSchema.parse({
        id: "10000000-0000-0000-0000-000000000001",
        hypothesisCode,
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        confidence: "low",
        excludedClaimCodes: [],
        reviewStatus: "unreviewed",
      }),
    ).toThrow();
  });
});
