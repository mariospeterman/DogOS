import {
  canonicalCodeSchema,
  correlationObservationSchema,
  entityIdSchema,
  isoTimestampSchema,
  measurementSchema,
  metricCodeSchema,
  reasonCodeSchema,
  type CorrelationObservation,
  type Measurement,
  type MetricCode,
  type ReasonCode,
} from "@dogos/contracts";
import { z } from "zod";

const correlationRecordSchema = z.strictObject({
  sessionId: entityIdSchema,
  occurredAt: isoTimestampSchema,
  factors: z.record(canonicalCodeSchema, z.boolean().nullable()),
  measurements: z.array(measurementSchema),
});

export const correlationInputSchema = z.strictObject({
  records: z.array(correlationRecordSchema),
  factorCode: canonicalCodeSchema,
  outcomeMetric: metricCodeSchema,
  minimumGroupSize: z.number().int().min(2),
  minimumAbsoluteDifference: z.number().nonnegative(),
});

export interface CorrelationInput {
  records: Array<{
    sessionId: string;
    occurredAt: string;
    factors: Record<string, boolean | null>;
    measurements: Measurement[];
  }>;
  factorCode: string;
  outcomeMetric: MetricCode;
  minimumGroupSize: number;
  minimumAbsoluteDifference: number;
}

export type CorrelationResult =
  | { status: "observed"; observation: CorrelationObservation }
  | {
      status: "suppressed";
      reasonCodes: ReasonCode[];
      evidenceIds: string[];
    };

function outcomeValue(
  measurements: Measurement[],
  metricCode: MetricCode,
): number | undefined {
  const measurement = measurements.find(
    (item) =>
      item.metricCode === metricCode &&
      !item.unknown &&
      typeof item.value === "number",
  );
  if (
    measurement === undefined ||
    typeof measurement.value !== "number" ||
    measurement.quality === "low" ||
    measurement.quality === "unavailable"
  ) {
    return undefined;
  }
  return measurement.value;
}

export function observeCorrelation(
  rawInput: CorrelationInput,
): CorrelationResult {
  const input = correlationInputSchema.parse(rawInput);
  const knownFactorRecords = input.records.filter(
    (record) =>
      record.factors[input.factorCode] !== null &&
      record.factors[input.factorCode] !== undefined,
  );
  const usable = knownFactorRecords.flatMap((record) => {
    const value = outcomeValue(record.measurements, input.outcomeMetric);
    return value === undefined
      ? []
      : [
          {
            sessionId: record.sessionId,
            occurredAt: record.occurredAt,
            exposed: record.factors[input.factorCode]!,
            value,
          },
        ];
  });
  const exposed = usable.filter((record) => record.exposed);
  const unexposed = usable.filter((record) => !record.exposed);
  const evidenceIds = usable.map((record) => record.sessionId).sort();
  const reasons: ReasonCode[] = [];
  if (knownFactorRecords.length > usable.length)
    reasons.push("CORRELATION_DATA_QUALITY_INSUFFICIENT");
  if (
    exposed.length < input.minimumGroupSize ||
    unexposed.length < input.minimumGroupSize
  ) {
    reasons.push("CORRELATION_SAMPLE_TOO_SMALL");
  }
  if (reasons.includes("CORRELATION_SAMPLE_TOO_SMALL")) {
    return {
      status: "suppressed",
      reasonCodes: [...new Set(reasons)]
        .sort()
        .map((reason) => reasonCodeSchema.parse(reason)),
      evidenceIds,
    };
  }

  const mean = (values: typeof exposed) =>
    values.reduce((sum, record) => sum + record.value, 0) / values.length;
  const exposedMean = mean(exposed);
  const baselineMean = mean(unexposed);
  const difference = exposedMean - baselineMean;
  if (Math.abs(difference) < input.minimumAbsoluteDifference) {
    return {
      status: "suppressed",
      reasonCodes: ["CORRELATION_DATA_QUALITY_INSUFFICIENT"],
      evidenceIds,
    };
  }
  const direction = difference > 0 ? "higher" : "lower";
  const supports = (value: number) =>
    direction === "higher" ? value > baselineMean : value < baselineMean;
  const supportingSessionIds = exposed
    .filter((record) => supports(record.value))
    .map((record) => record.sessionId)
    .sort();
  const contradictingSessionIds = exposed
    .filter((record) => !supports(record.value))
    .map((record) => record.sessionId)
    .sort();
  const dates = usable.map((record) => record.occurredAt).sort();

  return {
    status: "observed",
    observation: correlationObservationSchema.parse({
      factorCode: input.factorCode,
      outcomeMetric: input.outcomeMetric,
      direction,
      sampleCount: usable.length,
      supportingCount: supportingSessionIds.length,
      contradictingCount: contradictingSessionIds.length,
      supportingSessionIds,
      contradictingSessionIds,
      observedFrom: dates[0],
      observedUntil: dates.at(-1),
      confidence:
        usable.length >= 10 && contradictingSessionIds.length === 0
          ? "moderate"
          : "low",
      caveatCodes:
        usable.length < 10
          ? ["CORRELATION_NOT_CAUSATION", "CORRELATION_SMALL_SAMPLE"]
          : ["CORRELATION_NOT_CAUSATION"],
    }),
  };
}
