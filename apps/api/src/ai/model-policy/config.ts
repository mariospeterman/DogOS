import {
  assertApprovedAiReleaseManifest,
  type AiReleaseManifest,
} from "./release-manifest.js";
import {
  createDefaultModelPolicyRegistry,
  dogosAiTasks,
  type AiCapability,
  type AiReadinessStatus,
  type DogosAiTask,
  type ModelPolicyRegistry,
} from "./registry.js";

export interface AiCapabilityReadiness {
  asr: AiReadinessStatus;
  cv: AiReadinessStatus;
  embedding: AiReadinessStatus;
  live: AiReadinessStatus;
  moderation: AiReadinessStatus;
  text: AiReadinessStatus;
  vod: AiReadinessStatus;
  knowledgeRelease: string | null;
  policyVersion: string;
}

export interface DogosAiConfig {
  allowCrossBorderPersonalData: boolean;
  allowPersonalMediaShadowing: boolean;
  allowPreviewModels: boolean;
  failClosed: boolean;
  manifestsRequired: boolean;
  mode: "deterministic" | "hybrid";
  orchestrator: "deterministic" | "tool_loop";
  readiness: AiCapabilityReadiness;
  registry: ModelPolicyRegistry;
  requiredRegion: "eu" | "global";
  releaseManifests: AiReleaseManifest[];
}

const previewPattern = /\b(preview|experimental|latest)\b/i;
const openAiModels = new Set([
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "gpt-realtime-whisper",
  "text-embedding-3-small",
  "text-embedding-3-large",
  "omni-moderation-latest",
]);
const googleModels = new Set([
  "gemini-3.5-flash",
  "gemini-live-2.5-flash-native-audio",
]);

function setting(input: NodeJS.ProcessEnv, current: string, legacy?: string) {
  return input[current] ?? (legacy === undefined ? undefined : input[legacy]);
}

function booleanSetting(
  value: string | undefined,
  fallback: boolean,
  errorCode: string,
) {
  if (value === undefined || value === "") return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(errorCode);
}

function region(input: NodeJS.ProcessEnv): "eu" | "global" {
  const configured =
    input.DOGOS_AI_REQUIRED_PROCESSING_REGION ??
    input.OPENAI_DATA_REGION ??
    "global";
  if (configured !== "eu" && configured !== "global") {
    throw new Error("DOGOS_AI_REQUIRED_PROCESSING_REGION_UNSUPPORTED");
  }
  return configured;
}

function manifestIds(input: NodeJS.ProcessEnv) {
  const output: Partial<Record<DogosAiTask, string>> = {};
  const legacy = input.DOGOS_MODEL_SNAPSHOT_APPROVAL;
  for (const task of dogosAiTasks) {
    const key = `DOGOS_AI_RELEASE_MANIFEST_${task
      .toUpperCase()
      .replaceAll(".", "_")}`;
    const value = input[key] ?? legacy;
    if (value !== undefined && value.trim().length > 0) output[task] = value;
  }
  return output;
}

function requireStringField(
  value: unknown,
  field: keyof AiReleaseManifest,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`DOGOS_AI_RELEASE_MANIFESTS_INVALID_${field}`);
  }
  return value;
}

function nullableStringField(
  value: unknown,
  field: keyof AiReleaseManifest,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`DOGOS_AI_RELEASE_MANIFESTS_INVALID_${field}`);
  }
  return value;
}

function stringArrayField(
  value: unknown,
  field: keyof AiReleaseManifest,
): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`DOGOS_AI_RELEASE_MANIFESTS_INVALID_${field}`);
  }
  return [...value];
}

function releaseManifests(input: NodeJS.ProcessEnv): AiReleaseManifest[] {
  const raw = input.DOGOS_AI_RELEASE_MANIFESTS_JSON;
  if (raw === undefined || raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("DOGOS_AI_RELEASE_MANIFESTS_INVALID_JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("DOGOS_AI_RELEASE_MANIFESTS_INVALID_JSON");
  }
  return parsed.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("DOGOS_AI_RELEASE_MANIFESTS_INVALID_ITEM");
    }
    const record = item as Record<string, unknown>;
    const aggregateResult = record.aggregateResult;
    if (typeof aggregateResult !== "number" || aggregateResult < 0) {
      throw new Error("DOGOS_AI_RELEASE_MANIFESTS_INVALID_aggregateResult");
    }
    const purpose = requireStringField(record.purpose, "purpose");
    if (!dogosAiTasks.includes(purpose as DogosAiTask)) {
      throw new Error("DOGOS_AI_RELEASE_MANIFESTS_INVALID_purpose");
    }
    const manifest: AiReleaseManifest = {
      aggregateResult,
      approvalDate: requireStringField(record.approvalDate, "approvalDate"),
      contextCompilerVersion: requireStringField(
        record.contextCompilerVersion,
        "contextCompilerVersion",
      ),
      evaluationDatasetVersion: requireStringField(
        record.evaluationDatasetVersion,
        "evaluationDatasetVersion",
      ),
      expiry: requireStringField(record.expiry, "expiry"),
      hardGateFailures: stringArrayField(
        record.hardGateFailures,
        "hardGateFailures",
      ),
      id: requireStringField(record.id, "id"),
      jurisdictions: stringArrayField(record.jurisdictions, "jurisdictions"),
      knowledgeReleaseId: nullableStringField(
        record.knowledgeReleaseId,
        "knowledgeReleaseId",
      ),
      model: requireStringField(record.model, "model"),
      permittedReleaseChannels: stringArrayField(
        record.permittedReleaseChannels,
        "permittedReleaseChannels",
      ),
      professionalReviewerId: requireStringField(
        record.professionalReviewerId,
        "professionalReviewerId",
      ),
      promptVersion: requireStringField(record.promptVersion, "promptVersion"),
      protocolVersions: stringArrayField(
        record.protocolVersions,
        "protocolVersions",
      ),
      provider: requireStringField(record.provider, "provider"),
      purpose: purpose as DogosAiTask,
      rollbackTarget: nullableStringField(
        record.rollbackTarget,
        "rollbackTarget",
      ),
      schemaVersion: requireStringField(record.schemaVersion, "schemaVersion"),
      toolSetVersion: requireStringField(
        record.toolSetVersion,
        "toolSetVersion",
      ),
    };
    modelAllowed(manifest.model, manifest.provider);
    return manifest;
  });
}

function modelAllowed(model: string, provider: string) {
  if (provider === "openai" && !openAiModels.has(model)) {
    throw new Error("DOGOS_AI_MODEL_UNSUPPORTED");
  }
  if (provider === "google_vertex" && !googleModels.has(model)) {
    throw new Error("DOGOS_AI_MODEL_UNSUPPORTED");
  }
}

function assertProviderPolicy(input: {
  allowPreviewModels: boolean;
  registry: ModelPolicyRegistry;
}) {
  for (const policy of Object.values(input.registry.policies)) {
    if (
      !input.allowPreviewModels &&
      previewPattern.test(policy.model) &&
      policy.model !== "omni-moderation-latest"
    ) {
      throw new Error("DOGOS_AI_PREVIEW_MODEL_FORBIDDEN");
    }
    modelAllowed(policy.model, policy.provider);
  }
}

function capabilityStatus(input: {
  capability: AiCapability;
  configured: boolean;
  manifestsRequired: boolean;
  registry: ModelPolicyRegistry;
}) {
  if (!input.configured) return "disabled";
  const policies = Object.values(input.registry.policies).filter(
    (policy) => policy.capability === input.capability,
  );
  if (
    input.manifestsRequired &&
    policies.some(
      (policy) =>
        policy.provider !== "deterministic" &&
        policy.provider !== "local" &&
        policy.approvedModelReleaseId === null,
    )
  ) {
    return "needs_release_manifest";
  }
  return "ready";
}

export function loadDogosAiConfig(input: NodeJS.ProcessEnv): DogosAiConfig {
  const mode = (input.DOGOS_AI_MODE ?? "hybrid") as DogosAiConfig["mode"];
  if (mode !== "deterministic" && mode !== "hybrid") {
    throw new Error("DOGOS_AI_MODE_UNSUPPORTED");
  }
  const orchestrator = (input.DOGOS_AI_ORCHESTRATOR ??
    "deterministic") as DogosAiConfig["orchestrator"];
  if (orchestrator !== "deterministic" && orchestrator !== "tool_loop") {
    throw new Error("DOGOS_AI_ORCHESTRATOR_UNSUPPORTED");
  }
  const requiredRegion = region(input);
  const allowPreviewModels = booleanSetting(
    input.DOGOS_AI_ALLOW_PREVIEW_MODELS,
    false,
    "DOGOS_AI_ALLOW_PREVIEW_MODELS_INVALID",
  );
  const failClosed = booleanSetting(
    input.DOGOS_AI_FAIL_CLOSED,
    true,
    "DOGOS_AI_FAIL_CLOSED_INVALID",
  );
  const productionLike = ["preview", "production", "staging"].includes(
    input.DOGOS_ENV ?? "local",
  );
  const manifestsRequired =
    productionLike ||
    booleanSetting(
      input.DOGOS_AI_REQUIRE_RELEASE_MANIFEST,
      false,
      "DOGOS_AI_REQUIRE_RELEASE_MANIFEST_INVALID",
    );
  const policyVersion = input.DOGOS_AI_POLICY_VERSION ?? "2026-07-19.1";
  const registry = createDefaultModelPolicyRegistry({
    asrModel: setting(input, "DOGOS_ASR_MODEL") ?? "gpt-4o-mini-transcribe",
    liveFallbackModel:
      setting(input, "DOGOS_LIVE_FALLBACK_MODEL") ?? "gpt-realtime-2.1-mini",
    liveModel:
      setting(input, "DOGOS_LIVE_MODEL") ??
      "gemini-live-2.5-flash-native-audio",
    onboardingModel:
      setting(input, "DOGOS_ONBOARDING_MODEL") ??
      setting(input, "DOGOS_TEXT_FAST_MODEL", "DOGOS_COACH_MODEL_FREE") ??
      "gpt-5.6-luna",
    policyVersion,
    region: requiredRegion,
    textCoachModel:
      setting(input, "DOGOS_TEXT_COACH_MODEL", "DOGOS_COACH_MODEL_PAID") ??
      "gpt-5.6-terra",
    textEscalationModel:
      setting(input, "DOGOS_TEXT_ESCALATION_MODEL") ?? "gpt-5.6-sol",
    textFastModel:
      setting(input, "DOGOS_TEXT_FAST_MODEL", "DOGOS_COACH_MODEL_FREE") ??
      "gpt-5.6-luna",
    vodModel:
      setting(input, "DOGOS_VOD_MODEL", "DOGOS_VIDEO_ANALYSIS_MODEL") ??
      "gemini-3.5-flash",
  });
  const ids = manifestIds(input);
  const manifests = releaseManifests(input);
  for (const policy of Object.values(registry.policies)) {
    policy.approvedModelReleaseId = ids[policy.task] ?? null;
  }
  const textConfigured =
    input.DOGOS_LLM_MODE === "openai" &&
    (setting(input, "DOGOS_TEXT_PROVIDER") ?? input.DOGOS_LLM_MODE) ===
      "openai" &&
    input.OPENAI_API_KEY !== undefined;
  const vodConfigured =
    (setting(input, "DOGOS_VOD_PROVIDER", "DOGOS_VIDEO_ANALYSIS_PROVIDER") ??
      "disabled") !== "disabled";
  const liveConfigured =
    (setting(input, "DOGOS_LIVE_PROVIDER") ?? "disabled") !== "disabled";
  const asrConfigured =
    setting(input, "DOGOS_ASR_PROVIDER") === "openai" &&
    input.OPENAI_API_KEY !== undefined;
  const moderationConfigured =
    setting(input, "DOGOS_MODERATION_PROVIDER") === "openai" &&
    input.OPENAI_API_KEY !== undefined;
  const embeddingConfigured =
    setting(input, "DOGOS_EMBEDDING_PROVIDER") === "openai" &&
    input.OPENAI_API_KEY !== undefined;
  const cvConfigured = booleanSetting(
    input.DOGOS_CV_ENABLED,
    false,
    "DOGOS_CV_ENABLED_INVALID",
  );
  assertProviderPolicy({ allowPreviewModels, registry });
  if (failClosed && manifestsRequired) {
    const configuredCapabilities = new Set<AiCapability>();
    if (textConfigured) configuredCapabilities.add("text");
    if (vodConfigured) configuredCapabilities.add("vod");
    if (liveConfigured) configuredCapabilities.add("live");
    if (asrConfigured) configuredCapabilities.add("asr");
    if (moderationConfigured) configuredCapabilities.add("moderation");
    if (embeddingConfigured) configuredCapabilities.add("embedding");
    for (const policy of Object.values(registry.policies)) {
      if (
        !configuredCapabilities.has(policy.capability) ||
        policy.provider === "deterministic" ||
        policy.provider === "local"
      ) {
        continue;
      }
      assertApprovedAiReleaseManifest({
        manifests,
        model: policy.model,
        provider: policy.provider,
        purpose: policy.task,
        ...(ids[policy.task] === undefined
          ? {}
          : { releaseManifestId: ids[policy.task] }),
      });
    }
  }
  return {
    allowCrossBorderPersonalData: booleanSetting(
      input.DOGOS_AI_ALLOW_CROSS_BORDER_PERSONAL_DATA,
      false,
      "DOGOS_AI_ALLOW_CROSS_BORDER_PERSONAL_DATA_INVALID",
    ),
    allowPersonalMediaShadowing: booleanSetting(
      input.DOGOS_AI_ALLOW_PERSONAL_MEDIA_SHADOWING,
      false,
      "DOGOS_AI_ALLOW_PERSONAL_MEDIA_SHADOWING_INVALID",
    ),
    allowPreviewModels,
    failClosed,
    manifestsRequired,
    mode,
    orchestrator,
    readiness: {
      asr: capabilityStatus({
        capability: "asr",
        configured: asrConfigured,
        manifestsRequired,
        registry,
      }),
      cv: cvConfigured ? "ready" : "disabled",
      embedding: capabilityStatus({
        capability: "embedding",
        configured: embeddingConfigured,
        manifestsRequired,
        registry,
      }),
      knowledgeRelease: input.DOGOS_KNOWLEDGE_RELEASE_ID ?? null,
      live: capabilityStatus({
        capability: "live",
        configured: liveConfigured,
        manifestsRequired,
        registry,
      }),
      moderation: capabilityStatus({
        capability: "moderation",
        configured: moderationConfigured,
        manifestsRequired,
        registry,
      }),
      policyVersion,
      text: capabilityStatus({
        capability: "text",
        configured: textConfigured,
        manifestsRequired,
        registry,
      }),
      vod: capabilityStatus({
        capability: "vod",
        configured: vodConfigured,
        manifestsRequired,
        registry,
      }),
    },
    registry,
    releaseManifests: manifests,
    requiredRegion,
  };
}
