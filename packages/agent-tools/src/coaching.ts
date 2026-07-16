import {
  coachingContextCapsuleSchema,
  coachingDraftSchema,
  type CoachingContextCapsule,
  type CoachingClaim,
  type CoachingDraft,
  type CoachingMemoryFact,
  type CoachingSource,
  type Measurement,
} from "@dogos/contracts";

export interface CoachingModelRequest {
  context: CoachingContextCapsule;
  userMessage: string;
}

export interface CoachingModel {
  generate(request: CoachingModelRequest): Promise<unknown>;
}

export interface CoachingMemoryReader {
  findRelevant(input: {
    dogId: string;
    goalCode: string;
    limit: number;
  }): Promise<CoachingMemoryFact[]>;
}

export interface CoachingContextInput {
  generatedAt: string;
  locale: "de-CH" | "en";
  dog: CoachingContextCapsule["dog"];
  goal: CoachingContextCapsule["goal"];
  activeStep: CoachingContextCapsule["activeStep"];
  recentMeasurements: Measurement[];
  advisories: CoachingContextCapsule["advisories"];
  claims: CoachingClaim[];
  sources: CoachingSource[];
  unknownFactCodes: string[];
}

export const DOGOS_COACH_INSTRUCTION = `You are DogOS, a concise professional dog-training coach.
Answer naturally in the capsule locale and focus on the user's dog, current goal, and next useful action.
Treat capsule facts and measurements as authoritative; ask one short question when a material fact is unknown.
Use only supplied evidence claims for research claims and return their source IDs. Mention an active advisory briefly and only when relevant.
Never invent measurements or claim that a suggested action already changed the DogOS record.`;

export async function buildCoachingContext(
  input: CoachingContextInput,
  memory: CoachingMemoryReader,
): Promise<CoachingContextCapsule> {
  const relevantMemory = await memory.findRelevant({
    dogId: input.dog.id,
    goalCode: input.goal.code,
    limit: 16,
  });
  const requiredSourceIds = new Set(
    input.claims.flatMap((claim) => claim.sourceIds),
  );
  return coachingContextCapsuleSchema.parse({
    version: "1.0",
    ...input,
    recentMeasurements: input.recentMeasurements.slice(-12),
    relevantMemory: relevantMemory.slice(0, 16),
    advisories: input.advisories.slice(0, 4),
    claims: input.claims.slice(0, 8),
    sources: input.sources
      .filter((source) => requiredSourceIds.has(source.id))
      .slice(0, 12),
    unknownFactCodes: [...new Set(input.unknownFactCodes)].slice(0, 12),
  });
}

export function validateCoachingDraft(
  context: CoachingContextCapsule,
  candidate: unknown,
): CoachingDraft {
  const capsule = coachingContextCapsuleSchema.parse(context);
  const draft = coachingDraftSchema.parse(candidate);
  const availableSources = new Set(capsule.sources.map((source) => source.id));
  for (const sourceId of draft.citedSourceIds) {
    if (!availableSources.has(sourceId)) {
      throw new Error("COACHING_SOURCE_NOT_IN_CONTEXT");
    }
  }
  return draft;
}

export async function generateCoachingDraft(
  model: CoachingModel,
  request: CoachingModelRequest,
): Promise<CoachingDraft> {
  const context = coachingContextCapsuleSchema.parse(request.context);
  const candidate = await model.generate({
    context,
    userMessage: request.userMessage.slice(0, 2_000),
  });
  return validateCoachingDraft(context, candidate);
}

export function serializeCoachingContext(
  context: CoachingContextCapsule,
): string {
  return JSON.stringify(coachingContextCapsuleSchema.parse(context));
}
