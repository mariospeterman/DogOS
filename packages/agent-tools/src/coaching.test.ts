import type {
  CoachingContextCapsule,
  CoachingMemoryFact,
} from "@dogos/contracts";
import { describe, expect, it } from "vitest";

import {
  buildCoachingContext,
  DOGOS_COACH_INSTRUCTION,
  generateCoachingDraft,
  serializeCoachingContext,
  type CoachingMemoryReader,
  type CoachingModel,
} from "./coaching.js";

const sourceId = "90000000-0000-4000-8000-000000000001";
const memoryFact: CoachingMemoryFact = {
  id: "91000000-0000-4000-8000-000000000001",
  factCode: "dog.preference.food_reward",
  value: "chicken",
  source: "owner_report",
  observedAt: "2026-07-16T08:00:00.000Z",
  evidenceIds: [],
};

const memory: CoachingMemoryReader = {
  async findRelevant() {
    return [memoryFact];
  },
};

async function capsule(): Promise<CoachingContextCapsule> {
  return buildCoachingContext(
    {
      generatedAt: "2026-07-16T09:00:00.000Z",
      locale: "en",
      dog: {
        id: "30000000-0000-4000-8000-000000000001",
        name: "Milo",
        developmentStage: "adult",
        breedDescription: "mixed breed",
      },
      goal: {
        code: "goal.loose_leash_walking",
        ownerDescription: "Walk with a loose leash on quiet streets",
      },
      activeStep: {
        code: "step.loose_leash_low_distraction",
        version: 1,
        durationSeconds: 240,
        repetitionCap: 8,
        difficulty: 1,
      },
      recentMeasurements: [],
      advisories: [],
      claims: [
        {
          claimCode: "claim.training.reward_timing",
          summary: {
            "de-CH": "Timing beeinflusst das Lernen.",
            en: "Timing influences learning.",
          },
          sourceIds: [sourceId],
          evidenceLevel: "professional_consensus",
        },
      ],
      sources: [
        {
          id: sourceId,
          title: "Training review",
          url: "https://example.org/review",
          publisher: "Example University",
          publicationYear: 2024,
          reviewedAt: "2026-07-16T08:30:00.000Z",
        },
        {
          id: "90000000-0000-4000-8000-000000000002",
          title: "Irrelevant source",
          url: "https://example.org/unused",
          publisher: "Example University",
          publicationYear: 2023,
          reviewedAt: "2026-07-16T08:30:00.000Z",
        },
      ],
      unknownFactCodes: ["dog.trigger_distance", "dog.trigger_distance"],
    },
    memory,
  );
}

describe("natural coaching boundary", () => {
  it("builds a small relevant capsule without duplicate unknowns", async () => {
    const context = await capsule();
    expect(context.relevantMemory).toEqual([memoryFact]);
    expect(context.sources).toHaveLength(1);
    expect(context.unknownFactCodes).toEqual(["dog.trigger_distance"]);
    expect(serializeCoachingContext(context).length).toBeLessThan(8_000);
  });

  it("accepts natural copy with citations and proposed actions", async () => {
    const model: CoachingModel = {
      async generate() {
        return {
          message:
            "Take four calm minutes with Milo. Reward the position you want at the moment it occurs.",
          citedSourceIds: [sourceId],
          suggestedActions: [
            {
              label: "Start session",
              action: "open_session",
              subjectId: "40000000-0000-4000-8000-000000000001",
            },
          ],
          memoryCandidates: [],
        };
      },
    };
    const result = await generateCoachingDraft(model, {
      context: await capsule(),
      userMessage: "What should we do today?",
    });
    expect(result.message).toMatch(/Milo/);
    expect(result.citedSourceIds).toEqual([sourceId]);
  });

  it("rejects a citation that was not retrieved", async () => {
    const model: CoachingModel = {
      async generate() {
        return {
          message: "Unsupported claim",
          citedSourceIds: ["90000000-0000-4000-8000-000000000099"],
          suggestedActions: [],
          memoryCandidates: [],
        };
      },
    };
    await expect(
      generateCoachingDraft(model, {
        context: await capsule(),
        userMessage: "Why?",
      }),
    ).rejects.toThrow("COACHING_SOURCE_NOT_IN_CONTEXT");
  });

  it("keeps the instruction compact and non-legalistic", () => {
    expect(DOGOS_COACH_INSTRUCTION.length).toBeLessThan(900);
    expect(DOGOS_COACH_INSTRUCTION).not.toMatch(/EU AI Act|NIST|GDPR/);
  });
});
