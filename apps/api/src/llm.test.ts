import { describe, expect, it } from "vitest";
import { coachGenerationPurpose, loadCoachModelConfig } from "./llm.js";

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
      paidModel: "gpt-5.6-terra",
      profiles: {
        chat: { maxOutputTokens: 900, timeoutMs: 12_000 },
        evidence: { maxOutputTokens: 2_500, timeoutMs: 30_000 },
        plan: { maxOutputTokens: 3_000, timeoutMs: 30_000 },
        professional_summary: {
          maxOutputTokens: 4_000,
          timeoutMs: 45_000,
        },
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
