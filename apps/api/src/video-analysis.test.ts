import { describe, expect, it } from "vitest";
import { InMemoryVideoAnalysisStore, type VideoFinding } from "@dogos/database";

import {
  DeterministicVideoAnalysisProvider,
  VideoAnalysisWorker,
  loadVideoAnalysisConfig,
  validateVideoFindings,
  type VideoAnalysisProvider,
  type VideoObjectInspector,
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

  it("uses ADC by default for Vertex and supports explicit access-token smoke mode", () => {
    expect(
      loadVideoAnalysisConfig({
        DOGOS_VOD_PROVIDER: "google_vertex",
        GOOGLE_VERTEX_PROJECT: "dogos-test",
      }),
    ).toMatchObject({
      googleAuthMode: "adc",
      googleProject: "dogos-test",
      mode: "google_vertex",
      model: "gemini-3.5-flash",
    });
    expect(
      loadVideoAnalysisConfig({
        DOGOS_VOD_PROVIDER: "google_vertex",
        GOOGLE_VERTEX_ACCESS_TOKEN: "ya29.test-token",
        GOOGLE_VERTEX_AUTH_MODE: "access_token",
        GOOGLE_VERTEX_PROJECT: "dogos-test",
      }),
    ).toMatchObject({
      googleAccessToken: "ya29.test-token",
      googleAuthMode: "access_token",
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

  it("processes an uploaded video through inspection, frames, provider, and persistence", async () => {
    const store = new InMemoryVideoAnalysisStore();
    const analysis = await store.create({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      contentType: "video/mp4",
      dogId: "30000000-0000-0000-0000-000000000001",
      householdId: "20000000-0000-0000-0000-000000000001",
      originalFilename: "session.mp4",
      sizeBytes: 1024,
    });
    await store.completeUpload({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      householdId: analysis.householdId,
      id: analysis.id,
    });
    const inspector: VideoObjectInspector = {
      extractFrames: async () => [
        { contentType: "image/jpeg", data: "ZmFrZQ==", timestampMs: 1200 },
      ],
      inspect: async () => ({
        codec: "h264",
        durationSeconds: 12,
        malwareVerdict: "clean",
        privateObjectVerified: true,
      }),
    };
    const provider: VideoAnalysisProvider = {
      analyze: async (input) => {
        expect(input.ownerCaption).toBe("loose leash practice");
        expect(input.activeGoal).toBe("loose leash");
        expect(input.frames[0]?.timestampMs).toBe(1200);
        return [
          {
            confidence: 0.81,
            evidence: "handler rewards at the marked timestamp",
            label: "Reward timing",
            recommendation: "Keep the reward close to the handler's leg.",
          },
        ] satisfies VideoFinding[];
      },
    };
    const worker = new VideoAnalysisWorker({
      config: {
        maxFrames: 6,
        mode: "deterministic",
        model: "test",
        timeoutMs: 5000,
      },
      inspector,
      provider,
      store,
    });

    await expect(
      worker.processUploadedAnalysis({
        activeGoal: "loose leash",
        activeStep: "step.loose_leash_low_distraction",
        householdId: analysis.householdId,
        id: analysis.id,
        locale: "en",
        ownerCaption: "loose leash practice",
      }),
    ).resolves.toMatchObject({
      findings: [expect.objectContaining({ label: "Reward timing" })],
      status: "completed",
    });
  });

  it("fails closed when the uploaded object is not private and clean", async () => {
    const store = new InMemoryVideoAnalysisStore();
    const analysis = await store.create({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      contentType: "video/mp4",
      dogId: "30000000-0000-0000-0000-000000000001",
      householdId: "20000000-0000-0000-0000-000000000001",
      originalFilename: "session.mp4",
      sizeBytes: 1024,
    });
    await store.completeUpload({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      householdId: analysis.householdId,
      id: analysis.id,
    });
    const worker = new VideoAnalysisWorker({
      config: {
        maxFrames: 6,
        mode: "deterministic",
        model: "test",
        timeoutMs: 5000,
      },
      inspector: {
        extractFrames: async () => {
          throw new Error("should not extract frames");
        },
        inspect: async () => ({
          codec: null,
          durationSeconds: 12,
          malwareVerdict: "blocked",
          privateObjectVerified: false,
        }),
      },
      provider: new DeterministicVideoAnalysisProvider(),
      store,
    });

    await expect(
      worker.processUploadedAnalysis({
        householdId: analysis.householdId,
        id: analysis.id,
        locale: "en",
      }),
    ).resolves.toMatchObject({
      failureCode: "VIDEO_OBJECT_NOT_PRIVATE",
      status: "failed",
    });
  });
});
