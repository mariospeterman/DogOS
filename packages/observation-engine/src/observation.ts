import {
  allowedHypothesisCodeSchema,
  hypothesisSchema,
  observationSchema,
  type Hypothesis,
  type Observation,
} from "@dogos/contracts";
import { z } from "zod";

export function validateObservation(rawObservation: unknown): Observation {
  return observationSchema.parse(rawObservation);
}

export const hypothesisInputSchema = hypothesisSchema.extend({
  hypothesisCode: z.string().min(1),
});

export function createBoundedHypothesis(rawHypothesis: unknown): Hypothesis {
  const candidate = hypothesisInputSchema.parse(rawHypothesis);
  const hypothesisCode = allowedHypothesisCodeSchema.parse(
    candidate.hypothesisCode,
  );
  return hypothesisSchema.parse({ ...candidate, hypothesisCode });
}
