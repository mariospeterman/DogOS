import { describe, expect, it } from "vitest";
import {
  canonicalOnboardingInterpretation,
  coachGenerationPurpose,
  loadCoachModelConfig,
  parseOnboardingExtraction,
} from "./llm.js";

describe("coach model configuration", () => {
  it("defaults to deterministic and validates an EU OpenAI setup", () => {
    expect(loadCoachModelConfig({})).toBeNull();
    expect(
      loadCoachModelConfig({
        DOGOS_LLM_MODE: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_DATA_REGION: "eu",
      }),
    ).toMatchObject({
      baseUrl: "https://eu.api.openai.com/v1",
      freeModel: "gpt-5.6-luna",
      onboardingModel: "gpt-5.6-terra",
      paidModel: "gpt-5.6-terra",
      profiles: {
        chat: { maxOutputTokens: 900, timeoutMs: 12_000 },
        evidence: { maxOutputTokens: 2_500, timeoutMs: 30_000 },
        onboarding: { maxOutputTokens: 700, timeoutMs: 15_000 },
        plan: { maxOutputTokens: 3_000, timeoutMs: 30_000 },
        professional_summary: {
          maxOutputTokens: 4_000,
          timeoutMs: 45_000,
        },
      },
    });
  });

  it("maps structured natural-language facts into canonical onboarding answers", () => {
    const parsed = parseOnboardingExtraction(
      JSON.stringify({
        acknowledgement:
          "Echo already has a strong foundation; we can make recall measurable.",
        ageBand: "adult",
        baseline: "half",
        concern: "recall",
        concernDescription: "Recall drops around wildlife.",
        dogName: "Echo",
        dogProfileSummary:
          "2.5-year-old female Belgian Malinois with prior training",
        goal: "recall",
        goalDescription: "Return on one cue around moderate distraction.",
        health: "none",
        household: "single",
        locale: "en",
        safety: "none",
        setup: null,
      }),
    );
    expect(canonicalOnboardingInterpretation(parsed)).toMatchObject({
      answers: {
        baseline_collection: "baseline_collection.choice.2",
        behavior_concern: "behavior_concern.choice.2",
        dog_history: "dog_history.choice.2",
        dog_identity: "dog_identity.text:Echo",
        goal_selection: "goal_selection.choice.2",
        health_screen: "health_screen.choice.1",
        household_context: "household_context.choice.1",
        safety_screen: "safety_screen.choice.1",
      },
      notes: {
        concern_description: "Recall drops around wildlife.",
        dog_profile_summary:
          "2.5-year-old female Belgian Malinois with prior training",
        goal_description: "Return on one cue around moderate distraction.",
      },
    });
  });

  it("rejects incomplete and unbounded configurations", () => {
    expect(() => loadCoachModelConfig({ DOGOS_LLM_MODE: "openai" })).toThrow(
      "OPENAI_API_KEY_REQUIRED",
    );
    expect(() =>
      loadCoachModelConfig({
        DOGOS_LLM_CHAT_MAX_OUTPUT_TOKENS: "5000",
        DOGOS_LLM_MODE: "openai",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow("DOGOS_LLM_CHAT_MAX_OUTPUT_TOKENS_INVALID");
  });

  it("routes chat, plans, evidence, and professional summaries independently", () => {
    expect(
      coachGenerationPurpose({ message: "Was trainieren wir heute?" }),
    ).toBe("chat");
    expect(
      coachGenerationPurpose({
        message: "Erkläre den vollständigen Trainingsplan",
      }),
    ).toBe("plan");
    expect(
      coachGenerationPurpose({
        contextKind: "progress",
        message: "Explain the evidence",
      }),
    ).toBe("evidence");
    expect(
      coachGenerationPurpose({
        message: "Prepare this for my trainer",
      }),
    ).toBe("professional_summary");
  });
});
