import { describe, expect, it } from "vitest";

import type { Measurement } from "@dogos/contracts";

import { findCorrelations, observeCorrelation } from "./correlation.js";
import { createBoundedHypothesis, validateObservation } from "./observation.js";

function outcome(
  value: number,
  quality: Measurement["quality"] = "high",
): Measurement {
  return {
    metricCode: "metric.success_rate",
    value,
    unit: "unit.percent",
    unknown: false,
    source: "owner_report",
    method: "method.session_summary",
    measuredAt: "2026-07-14T10:00:00.000Z",
    quality,
  };
}

function record(sequence: number, exposed: boolean, value: number) {
  return {
    sessionId: `81000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
    occurredAt: `2026-07-${(10 + sequence).toString().padStart(2, "0")}T10:00:00.000Z`,
    factors: { "factor.reduced_sleep": exposed },
    measurements: [outcome(value)],
  };
}

describe("bounded observations and hypotheses", () => {
  it("accepts a canonical observation without adding an inference", () => {
    const observation = validateObservation({
      id: "80000000-0000-4000-8000-000000000001",
      sessionId: null,
      observationCode: "observation.engaged_with_handler",
      value: true,
      source: "owner_report",
      confidence: 0.8,
      observedAt: "2026-07-14T10:00:00.000Z",
      evidenceIds: [],
      unsupportedInferenceCodes: [],
    });

    expect(observation.observationCode).toBe(
      "observation.engaged_with_handler",
    );
  });

  it("accepts bounded hypotheses and rejects diagnostic labels", () => {
    const base = {
      id: "80000000-0000-4000-8000-000000000002",
      supportingEvidenceIds: ["80000000-0000-4000-8000-000000000001"],
      contradictingEvidenceIds: [],
      confidence: "low",
      excludedClaimCodes: [],
      reviewStatus: "unreviewed",
    } as const;

    expect(
      createBoundedHypothesis({
        ...base,
        hypothesisCode: "hypothesis.reduced_training_tolerance",
      }).hypothesisCode,
    ).toBe("hypothesis.reduced_training_tolerance");
    expect(() =>
      createBoundedHypothesis({
        ...base,
        hypothesisCode: "hypothesis.clinical_anxiety",
      }),
    ).toThrow();
  });
});

describe("descriptive correlations", () => {
  it("observes a qualified lower outcome with mandatory caveats", () => {
    const input = {
      records: [
        record(1, true, 40),
        record(2, true, 50),
        record(3, false, 80),
        record(4, false, 90),
      ],
      factorCode: "factor.reduced_sleep",
      outcomeMetric: "metric.success_rate" as const,
      minimumGroupSize: 2,
      minimumAbsoluteDifference: 10,
    };

    const result = observeCorrelation(input);

    expect(result.status).toBe("observed");
    if (result.status !== "observed") return;
    expect(result.observation.direction).toBe("lower");
    expect(result.observation.caveatCodes).toEqual([
      "CORRELATION_NOT_CAUSATION",
      "CORRELATION_SMALL_SAMPLE",
    ]);
    expect(result.observation.supportingSessionIds).toEqual(
      [...result.observation.supportingSessionIds].sort(),
    );
    expect(result).toEqual(observeCorrelation(input));
    expect(findCorrelations(input)).toEqual([result.observation]);
  });

  it("suppresses an undersized comparison group", () => {
    const result = observeCorrelation({
      records: [
        record(1, true, 40),
        record(2, false, 80),
        record(3, false, 90),
      ],
      factorCode: "factor.reduced_sleep",
      outcomeMetric: "metric.success_rate",
      minimumGroupSize: 2,
      minimumAbsoluteDifference: 10,
    });

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCodes: ["CORRELATION_SAMPLE_TOO_SMALL"],
    });
  });

  it("excludes low-quality outcomes and reports the quality limitation", () => {
    const records = [
      record(1, true, 40),
      record(2, true, 50),
      record(3, false, 80),
      record(4, false, 90),
    ];
    records[0]!.measurements = [outcome(40, "low")];

    const result = observeCorrelation({
      records,
      factorCode: "factor.reduced_sleep",
      outcomeMetric: "metric.success_rate",
      minimumGroupSize: 2,
      minimumAbsoluteDifference: 10,
    });

    expect(result).toMatchObject({
      status: "suppressed",
      reasonCodes: [
        "CORRELATION_DATA_QUALITY_INSUFFICIENT",
        "CORRELATION_SAMPLE_TOO_SMALL",
      ],
    });
  });
});
