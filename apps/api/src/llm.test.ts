import { describe, expect, it } from "vitest";
import { loadCoachModelConfig } from "./llm.js";

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
      maxOutputTokens: 320,
      paidModel: "gpt-5.6-terra",
    });
  });

  it("rejects incomplete and unbounded configurations", () => {
    expect(() => loadCoachModelConfig({ DOGOS_LLM_MODE: "openai" })).toThrow(
      "OPENAI_API_KEY_REQUIRED",
    );
    expect(() =>
      loadCoachModelConfig({
        DOGOS_COACH_MAX_OUTPUT_TOKENS: "5000",
        DOGOS_LLM_MODE: "openai",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow("DOGOS_COACH_MAX_OUTPUT_TOKENS_INVALID");
  });
});
