import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  evidenceQualitySchema,
  isoTimestampSchema,
} from "./common.js";

export const metricDefinitions = {
  "metric.continuous_loose_steps": {
    valueType: "number",
    unit: "unit.count",
    minimum: 0,
  },
  "metric.duration_seconds": {
    valueType: "number",
    unit: "unit.second",
    minimum: 0,
  },
  "metric.engagement_rate": {
    valueType: "number",
    unit: "unit.percent",
    minimum: 0,
    maximum: 100,
  },
  "metric.food_acceptance": {
    valueType: "boolean",
    unit: null,
  },
  "metric.handler_execution_rate": {
    valueType: "number",
    unit: "unit.percent",
    minimum: 0,
    maximum: 100,
  },
  "metric.recovery_seconds": {
    valueType: "number",
    unit: "unit.second",
    minimum: 0,
  },
  "metric.repetitions": {
    valueType: "number",
    unit: "unit.count",
    minimum: 0,
  },
  "metric.response_latency_ms": {
    valueType: "number",
    unit: "unit.millisecond",
    minimum: 0,
  },
  "metric.success_rate": {
    valueType: "number",
    unit: "unit.percent",
    minimum: 0,
    maximum: 100,
  },
  "metric.trigger_distance_m": {
    valueType: "number",
    unit: "unit.meter",
    minimum: 0,
  },
} as const;

export type MetricCode = keyof typeof metricDefinitions;
export const metricCodeSchema = z.enum(
  Object.keys(metricDefinitions) as [MetricCode, ...MetricCode[]],
);

const baseMeasurementSchema = z.strictObject({
  metricCode: metricCodeSchema,
  value: z.union([
    z.number().finite(),
    z.boolean(),
    z.string().min(1),
    z.null(),
  ]),
  unit: canonicalCodeSchema.nullable(),
  unknown: z.boolean(),
  unknownReason: canonicalCodeSchema.optional(),
  source: z.enum(["owner_report", "trainer_report", "system", "future_video"]),
  method: canonicalCodeSchema.nullable(),
  measuredAt: isoTimestampSchema,
  environmentCode: canonicalCodeSchema.optional(),
  quality: evidenceQualitySchema,
});

export const measurementSchema = baseMeasurementSchema.superRefine(
  (measurement, context) => {
    if (measurement.unknown) {
      if (measurement.value !== null) {
        context.addIssue({
          code: "custom",
          message: "unknown measurements require value = null",
          path: ["value"],
        });
      }
      if (measurement.unknownReason === undefined) {
        context.addIssue({
          code: "custom",
          message: "unknown measurements require unknownReason",
          path: ["unknownReason"],
        });
      }
      return;
    }

    if (measurement.value === null) {
      context.addIssue({
        code: "custom",
        message: "known measurements require a value",
        path: ["value"],
      });
      return;
    }
    if (measurement.unknownReason !== undefined) {
      context.addIssue({
        code: "custom",
        message: "known measurements cannot have unknownReason",
        path: ["unknownReason"],
      });
    }

    const definition = metricDefinitions[measurement.metricCode];
    if (typeof measurement.value !== definition.valueType) {
      context.addIssue({
        code: "custom",
        message: `metric requires ${definition.valueType} value`,
        path: ["value"],
      });
    }
    if (measurement.unit !== definition.unit) {
      context.addIssue({
        code: "custom",
        message: `metric requires unit ${definition.unit ?? "null"}`,
        path: ["unit"],
      });
    }
    if (typeof measurement.value === "number") {
      if ("minimum" in definition && measurement.value < definition.minimum) {
        context.addIssue({
          code: "custom",
          message: `metric minimum is ${definition.minimum}`,
          path: ["value"],
        });
      }
      if ("maximum" in definition && measurement.value > definition.maximum) {
        context.addIssue({
          code: "custom",
          message: `metric maximum is ${definition.maximum}`,
          path: ["value"],
        });
      }
    }
  },
);

export const goalMeasurementSchema = z.strictObject({
  id: entityIdSchema,
  goalVersionId: entityIdSchema,
  measurement: measurementSchema,
});

export type Measurement = z.infer<typeof measurementSchema>;
export type GoalMeasurement = z.infer<typeof goalMeasurementSchema>;
