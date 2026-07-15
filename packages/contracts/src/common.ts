import { z } from "zod";

export const entityIdSchema = z.uuid();
export const canonicalCodeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/);
export const semanticVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/);
export const isoTimestampSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();
export const confidenceSchema = z.enum([
  "unavailable",
  "low",
  "moderate",
  "high",
]);
export const evidenceQualitySchema = z.enum([
  "unavailable",
  "low",
  "moderate",
  "high",
]);

export type Confidence = z.infer<typeof confidenceSchema>;
export type EvidenceQuality = z.infer<typeof evidenceQualitySchema>;

export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
