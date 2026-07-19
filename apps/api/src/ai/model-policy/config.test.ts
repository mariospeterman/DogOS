import { describe, expect, it } from "vitest";

import { loadDogosAiConfig } from "./config.js";
import type { AiReleaseManifest } from "./release-manifest.js";
import type { DogosAiTask, ModelPolicyRegistry } from "./registry.js";

function manifestFor(
  registry: ModelPolicyRegistry,
  task: DogosAiTask,
): AiReleaseManifest {
  const policy = registry.policies[task];
  return {
    aggregateResult: 0.97,
    approvalDate: "2026-07-19T00:00:00.000Z",
    contextCompilerVersion: "dogos-context-2026-07-19.1",
    evaluationDatasetVersion: "dogos-evals-2026-07-19.1",
    expiry: "2099-01-01T00:00:00.000Z",
    hardGateFailures: [],
    id: `manifest-${task}`,
    jurisdictions: ["CH", "EU"],
    knowledgeReleaseId: "knowledge-2026-07-19.1",
    model: policy.model,
    permittedReleaseChannels: ["staging", "production"],
    professionalReviewerId: "reviewer-prod",
    promptVersion: "prompts-2026-07-19.1",
    protocolVersions: ["protocols-2026-07-19.1"],
    provider: policy.provider,
    purpose: task,
    rollbackTarget: null,
    schemaVersion: "1.0",
    toolSetVersion: "tools-2026-07-19.1",
  };
}

describe("DogOS AI policy configuration", () => {
  it("keeps local deterministic startup usable while documenting manifest requirements", () => {
    const config = loadDogosAiConfig({
      DOGOS_AI_REQUIRE_RELEASE_MANIFEST: "true",
      DOGOS_LLM_MODE: "deterministic",
    });

    expect(config.readiness.text).toBe("disabled");
    expect(config.registry.policies["coach.chat"]).toMatchObject({
      maxToolSteps: 2,
      model: "gpt-5.6-terra",
      streaming: "safe_ack_only",
    });
  });

  it("fails closed when a configured provider lacks an approved manifest", () => {
    expect(() =>
      loadDogosAiConfig({
        DOGOS_AI_REQUIRE_RELEASE_MANIFEST: "true",
        DOGOS_LLM_MODE: "openai",
        DOGOS_TEXT_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
      }),
    ).toThrow("DOGOS_AI_RELEASE_MANIFEST_REQUIRED");
  });

  it("accepts env-approved release manifests for configured production providers", () => {
    const baseConfig = loadDogosAiConfig({
      DOGOS_AI_FAIL_CLOSED: "false",
    });
    const textTasks = Object.values(baseConfig.registry.policies)
      .filter((policy) => policy.capability === "text")
      .map((policy) => policy.task);
    const manifests = textTasks.map((task) =>
      manifestFor(baseConfig.registry, task),
    );
    const manifestIds = Object.fromEntries(
      textTasks.map((task) => [
        `DOGOS_AI_RELEASE_MANIFEST_${task.toUpperCase().replaceAll(".", "_")}`,
        `manifest-${task}`,
      ]),
    );

    const config = loadDogosAiConfig({
      DOGOS_AI_RELEASE_MANIFESTS_JSON: JSON.stringify(manifests),
      DOGOS_AI_REQUIRE_RELEASE_MANIFEST: "true",
      DOGOS_LLM_MODE: "openai",
      DOGOS_TEXT_PROVIDER: "openai",
      OPENAI_API_KEY: "test-key",
      ...manifestIds,
    });

    expect(config.readiness.text).toBe("ready");
    expect(config.releaseManifests).toHaveLength(textTasks.length);
    expect(config.registry.policies["coach.chat"]).toMatchObject({
      approvedModelReleaseId: "manifest-coach.chat",
    });
  });

  it("rejects preview models unless explicitly allowed", () => {
    expect(() =>
      loadDogosAiConfig({
        DOGOS_TEXT_COACH_MODEL: "gpt-realtime-preview-2099-01-01",
      }),
    ).toThrow("DOGOS_AI_PREVIEW_MODEL_FORBIDDEN");
  });

  it("reports configured VOD as needing manifest instead of ready", () => {
    const config = loadDogosAiConfig({
      DOGOS_AI_FAIL_CLOSED: "false",
      DOGOS_AI_REQUIRE_RELEASE_MANIFEST: "true",
      DOGOS_VOD_PROVIDER: "google_vertex",
      GOOGLE_VERTEX_PROJECT: "dogos-test",
    });

    expect(config.readiness.vod).toBe("needs_release_manifest");
    expect(config.registry.policies["video.global_semantics"]).toMatchObject({
      model: "gemini-3.5-flash",
      provider: "google_vertex",
    });
  });

  it("rejects malformed release manifest JSON", () => {
    expect(() =>
      loadDogosAiConfig({
        DOGOS_AI_RELEASE_MANIFESTS_JSON: "{",
      }),
    ).toThrow("DOGOS_AI_RELEASE_MANIFESTS_INVALID_JSON");
  });
});
