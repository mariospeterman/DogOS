import { describe, expect, it } from "vitest";
import {
  canonicalOnboardingInterpretation,
  coachGenerationPurpose,
  loadCoachModelConfig,
  parseCoachPresentation,
  parseOnboardingExtraction,
  validateCoachPresentation,
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
      onboardingModel: "gpt-5.6-luna",
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
    expect(() =>
      loadCoachModelConfig({
        DOGOS_ENV: "staging",
        DOGOS_LLM_MODE: "openai",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow("DOGOS_AI_RELEASE_MANIFEST_REQUIRED");
    expect(() =>
      loadCoachModelConfig({
        DOGOS_ENV: "staging",
        DOGOS_LLM_MODE: "openai",
        DOGOS_MODEL_SNAPSHOT_APPROVAL: "dogos-coach-openai-2026-07-18-reviewed",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow("DOGOS_AI_RELEASE_MANIFEST_UNKNOWN");
  });

  it("rejects global OpenAI routing when EU processing is required", () => {
    expect(() =>
      loadCoachModelConfig({
        DOGOS_AI_ALLOW_CROSS_BORDER_PERSONAL_DATA: "false",
        DOGOS_AI_REQUIRED_PROCESSING_REGION: "eu",
        DOGOS_LLM_MODE: "openai",
        DOGOS_AI_REQUIRE_RELEASE_MANIFEST: "false",
        OPENAI_API_KEY: "test-key",
        OPENAI_DATA_REGION: "global",
      }),
    ).toThrow("OPENAI_DATA_REGION_EU_REQUIRED");
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

  it("accepts only presentation output that preserves canonical plan facts", () => {
    const context = {
      currentStep: {
        difficulty: 1,
        durationSeconds: 180,
        repetitions: 6,
        stepCode: "step.recall_short_distance",
      },
      dogName: "Echo",
      durationMinutes: 3,
      evidenceCount: 0,
      goal: "Return on one cue around moderate distraction",
      latestDecision: "repeat_step",
      requiredConsecutiveSessions: 3,
      riskDisposition: "continue_low_risk_training",
      stage: "short-distance recall",
      targetSuccessRate: 80,
    };
    const valid = parseCoachPresentation(
      JSON.stringify({
        addedProtocolStepCodes: [],
        canonicalDecision: "repeat_step",
        durationMinutes: 3,
        message:
          "Echo starts with a 3-minute recall block. Progress after 3 comparable sessions at 80%.",
        protocolStepCode: "step.recall_short_distance",
        requiredConsecutiveSessions: 3,
        riskDisposition: "continue_low_risk_training",
        targetSuccessRate: 80,
      }),
    );
    expect(
      validateCoachPresentation({
        context,
        deterministicDraft: "Echo's plan starts with short recall.",
        presentation: valid,
        purpose: "plan",
      }),
    ).toMatch(/3-minute recall/);

    expect(() =>
      validateCoachPresentation({
        context,
        deterministicDraft: "Echo's plan starts with short recall.",
        presentation: { ...valid, durationMinutes: 5 },
        purpose: "plan",
      }),
    ).toThrow("COACH_PRESENTATION_CANONICAL_MISMATCH");
    expect(() =>
      validateCoachPresentation({
        context,
        deterministicDraft: "Echo's plan starts with short recall.",
        presentation: {
          ...valid,
          message: `${valid.message} Ask a professional trainer before starting.`,
        },
        purpose: "plan",
      }),
    ).toThrow("COACH_PRESENTATION_UNSUPPORTED_REFERRAL");
  });

  it("rejects removal of a required medical boundary", () => {
    const presentation = parseCoachPresentation(
      JSON.stringify({
        addedProtocolStepCodes: [],
        canonicalDecision: "repeat_step",
        durationMinutes: 3,
        message: "Continue with the normal session tomorrow.",
        protocolStepCode: null,
        requiredConsecutiveSessions: null,
        riskDisposition: null,
        targetSuccessRate: null,
      }),
    );
    expect(() =>
      validateCoachPresentation({
        context: {
          dogName: "Echo",
          durationMinutes: 3,
          evidenceCount: 0,
          goal: "current goal",
          latestDecision: "repeat_step",
          stage: "current step",
        },
        deterministicDraft: "This is not a diagnosis.",
        presentation,
        purpose: "chat",
      }),
    ).toThrow("COACH_PRESENTATION_SAFETY_BOUNDARY_MISSING");
  });
});
