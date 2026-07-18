import { describe, expect, it } from "vitest";

import {
  DeterministicVideoAnalysisProvider,
  loadVideoAnalysisConfig,
  validateVideoFindings,
} from "./video-analysis.js";

describe("video analysis provider configuration", () => {
  it("defaults to disabled and validates explicit OpenAI activation", () => {
    expect(loadVideoAnalysisConfig({})).toBeNull();
    expect(() =>
      loadVideoAnalysisConfig({ DOGOS_VIDEO_ANALYSIS_PROVIDER: "openai" }),
    ).toThrow("OPENAI_API_KEY_REQUIRED");
    expect(
      loadVideoAnalysisConfig({
        DOGOS_VIDEO_ANALYSIS_MAX_FRAMES: "8",
        DOGOS_VIDEO_ANALYSIS_PROVIDER: "openai",
        DOGOS_VIDEO_ANALYSIS_TIMEOUT_MS: "60000",
        OPENAI_API_KEY: "test-key",
      }),
    ).toMatchObject({
      maxFrames: 8,
      mode: "openai",
      model: "gpt-5.6-terra",
      timeoutMs: 60_000,
    });
  });

  it("rejects unsupported provider output and unsafe unbounded values", () => {
    expect(() => validateVideoFindings({ label: "fake" })).toThrow(
      "VIDEO_FINDINGS_INVALID",
    );
    expect(() =>
      validateVideoFindings([
        {
          confidence: 1.2,
          evidence: "visible handler motion",
          label: "handler timing",
          recommendation: "pause before cueing again",
        },
      ]),
    ).toThrow("VIDEO_FINDINGS_INVALID");
  });

  it("keeps deterministic findings clearly test-only", async () => {
    const provider = new DeterministicVideoAnalysisProvider();
    await expect(
      provider.analyze({
        dogId: "dog-1",
        frames: [],
        householdId: "household-1",
        locale: "en",
      }),
    ).rejects.toThrow("VIDEO_ANALYSIS_FRAMES_REQUIRED");
    await expect(
      provider.analyze({
        dogId: "dog-1",
        frames: [
          {
            contentType: "image/jpeg",
            data: "ZmFrZQ==",
            timestampMs: 0,
          },
        ],
        householdId: "household-1",
        locale: "en",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        evidence: expect.stringContaining("Deterministic test analysis"),
        label: "Test observation",
      }),
    ]);
  });
});
