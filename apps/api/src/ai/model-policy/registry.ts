export const dogosAiTasks = [
  "onboarding.extract",
  "language.detect",
  "coach.chat",
  "plan.compose",
  "plan.explain",
  "progress.explain",
  "professional.handoff",
  "knowledge.runtime_search",
  "knowledge.offline_scout",
  "video.global_semantics",
  "video.precision_review",
  "video.report",
  "live.standard",
  "live.premium",
  "audio.transcribe",
  "embedding.generate",
  "content.moderate",
  "eval.judge",
] as const;

export type DogosAiTask = (typeof dogosAiTasks)[number];

export type AiProvider = "deterministic" | "google_vertex" | "local" | "openai";

export type AiCapability =
  "asr" | "cv" | "embedding" | "live" | "moderation" | "text" | "vod";

export type AiReadinessStatus =
  "disabled" | "needs_release_manifest" | "not_configured" | "ready";

export interface DogosAiTaskPolicy {
  allowedTools: string[];
  approvedModelReleaseId: string | null;
  capability: AiCapability;
  costCeilingUsd: number | null;
  fallback: "deterministic" | "disabled" | "manual_review";
  inputTokenBudget: number;
  maxToolSteps: number;
  model: string;
  outputTokenBudget: number;
  personalData: boolean;
  personalMedia: boolean;
  provider: AiProvider;
  region: "eu" | "global" | "local";
  retries: number;
  schemaVersion: string;
  shadowExecution: boolean;
  streaming: "forbidden" | "safe_ack_only" | "validated_text";
  task: DogosAiTask;
  timeoutMs: number;
}

export interface ModelPolicyRegistry {
  policyVersion: string;
  policies: Record<DogosAiTask, DogosAiTaskPolicy>;
}

const noTools: string[] = [];

function policy(
  task: DogosAiTask,
  input: Omit<DogosAiTaskPolicy, "task">,
): DogosAiTaskPolicy {
  return { task, ...input };
}

export function createDefaultModelPolicyRegistry(input: {
  policyVersion: string;
  region: "eu" | "global";
  textCoachModel: string;
  textEscalationModel: string;
  textFastModel: string;
  vodModel: string;
  vodProvider?: Extract<AiProvider, "google_vertex" | "openai">;
  liveModel: string;
  liveFallbackModel: string;
  onboardingModel: string;
  asrModel: string;
}): ModelPolicyRegistry {
  const textBase = {
    allowedTools: noTools,
    approvedModelReleaseId: null,
    costCeilingUsd: null,
    fallback: "deterministic" as const,
    maxToolSteps: 0,
    personalData: true,
    personalMedia: false,
    provider: "openai" as const,
    region: input.region,
    retries: 1,
    schemaVersion: "1.0",
    shadowExecution: false,
    streaming: "safe_ack_only" as const,
  };
  const policies: Record<DogosAiTask, DogosAiTaskPolicy> = {
    "audio.transcribe": policy("audio.transcribe", {
      allowedTools: noTools,
      approvedModelReleaseId: null,
      capability: "asr",
      costCeilingUsd: null,
      fallback: "disabled",
      inputTokenBudget: 0,
      maxToolSteps: 0,
      model: input.asrModel,
      outputTokenBudget: 0,
      personalData: true,
      personalMedia: true,
      provider: "openai",
      region: input.region,
      retries: 1,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "forbidden",
      timeoutMs: 90_000,
    }),
    "coach.chat": policy("coach.chat", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 6_000,
      maxToolSteps: 2,
      model: input.textCoachModel,
      outputTokenBudget: 900,
      timeoutMs: 12_000,
    }),
    "content.moderate": policy("content.moderate", {
      allowedTools: noTools,
      approvedModelReleaseId: null,
      capability: "moderation",
      costCeilingUsd: null,
      fallback: "manual_review",
      inputTokenBudget: 8_000,
      maxToolSteps: 0,
      model: "omni-moderation-latest",
      outputTokenBudget: 0,
      personalData: true,
      personalMedia: false,
      provider: "openai",
      region: input.region,
      retries: 1,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "forbidden",
      timeoutMs: 10_000,
    }),
    "embedding.generate": policy("embedding.generate", {
      allowedTools: noTools,
      approvedModelReleaseId: null,
      capability: "embedding",
      costCeilingUsd: null,
      fallback: "disabled",
      inputTokenBudget: 8_000,
      maxToolSteps: 0,
      model: "text-embedding-3-small",
      outputTokenBudget: 0,
      personalData: true,
      personalMedia: false,
      provider: "openai",
      region: input.region,
      retries: 1,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "forbidden",
      timeoutMs: 20_000,
    }),
    "eval.judge": policy("eval.judge", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 16_000,
      maxToolSteps: 0,
      model: input.textEscalationModel,
      outputTokenBudget: 2_000,
      timeoutMs: 60_000,
    }),
    "knowledge.offline_scout": policy("knowledge.offline_scout", {
      ...textBase,
      allowedTools: ["knowledge_search", "source_fetch"],
      capability: "text",
      inputTokenBudget: 24_000,
      maxToolSteps: 6,
      model: input.textEscalationModel,
      outputTokenBudget: 4_000,
      personalData: false,
      timeoutMs: 120_000,
    }),
    "knowledge.runtime_search": policy("knowledge.runtime_search", {
      ...textBase,
      allowedTools: ["approved_knowledge_search"],
      capability: "text",
      inputTokenBudget: 8_000,
      maxToolSteps: 3,
      model: input.textFastModel,
      outputTokenBudget: 900,
      personalData: false,
      timeoutMs: 20_000,
    }),
    "language.detect": policy("language.detect", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 1_000,
      model: input.textFastModel,
      outputTokenBudget: 120,
      personalData: false,
      timeoutMs: 4_000,
    }),
    "live.premium": policy("live.premium", {
      allowedTools: ["create_live_session", "record_live_event"],
      approvedModelReleaseId: null,
      capability: "live",
      costCeilingUsd: null,
      fallback: "manual_review",
      inputTokenBudget: 3_000,
      maxToolSteps: 2,
      model: input.liveFallbackModel,
      outputTokenBudget: 800,
      personalData: true,
      personalMedia: true,
      provider: "openai",
      region: input.region,
      retries: 0,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "validated_text",
      timeoutMs: 20_000,
    }),
    "live.standard": policy("live.standard", {
      allowedTools: ["create_live_session", "record_live_event"],
      approvedModelReleaseId: null,
      capability: "live",
      costCeilingUsd: null,
      fallback: "manual_review",
      inputTokenBudget: 3_000,
      maxToolSteps: 2,
      model: input.liveModel,
      outputTokenBudget: 800,
      personalData: true,
      personalMedia: true,
      provider: "google_vertex",
      region: input.region,
      retries: 0,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "validated_text",
      timeoutMs: 20_000,
    }),
    "onboarding.extract": policy("onboarding.extract", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 6_000,
      model: input.onboardingModel,
      outputTokenBudget: 700,
      timeoutMs: 15_000,
    }),
    "plan.compose": policy("plan.compose", {
      ...textBase,
      allowedTools: ["get_goal", "get_protocol_primitives", "validate_plan"],
      capability: "text",
      inputTokenBudget: 12_000,
      maxToolSteps: 3,
      model: input.textCoachModel,
      outputTokenBudget: 2_200,
      timeoutMs: 30_000,
    }),
    "plan.explain": policy("plan.explain", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 12_000,
      maxToolSteps: 3,
      model: input.textCoachModel,
      outputTokenBudget: 2_200,
      timeoutMs: 30_000,
    }),
    "professional.handoff": policy("professional.handoff", {
      ...textBase,
      allowedTools: ["create_handoff", "get_evidence"],
      capability: "text",
      inputTokenBudget: 16_000,
      maxToolSteps: 3,
      model: input.textCoachModel,
      outputTokenBudget: 3_000,
      timeoutMs: 45_000,
    }),
    "progress.explain": policy("progress.explain", {
      ...textBase,
      allowedTools: ["get_progress", "get_evidence"],
      capability: "text",
      inputTokenBudget: 10_000,
      maxToolSteps: 3,
      model: input.textCoachModel,
      outputTokenBudget: 1_600,
      timeoutMs: 30_000,
    }),
    "video.global_semantics": policy("video.global_semantics", {
      allowedTools: noTools,
      approvedModelReleaseId: null,
      capability: "vod",
      costCeilingUsd: null,
      fallback: "manual_review",
      inputTokenBudget: 1_048_576,
      maxToolSteps: 0,
      model: input.vodModel,
      outputTokenBudget: 4_000,
      personalData: true,
      personalMedia: true,
      provider: input.vodProvider ?? "google_vertex",
      region: input.region,
      retries: 1,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "forbidden",
      timeoutMs: 180_000,
    }),
    "video.precision_review": policy("video.precision_review", {
      allowedTools: noTools,
      approvedModelReleaseId: null,
      capability: "cv",
      costCeilingUsd: null,
      fallback: "manual_review",
      inputTokenBudget: 0,
      maxToolSteps: 0,
      model: "rtmpose-m+rtmdet-small+bytetrack",
      outputTokenBudget: 0,
      personalData: true,
      personalMedia: true,
      provider: "local",
      region: "local",
      retries: 0,
      schemaVersion: "1.0",
      shadowExecution: false,
      streaming: "forbidden",
      timeoutMs: 180_000,
    }),
    "video.report": policy("video.report", {
      ...textBase,
      capability: "text",
      inputTokenBudget: 10_000,
      maxToolSteps: 0,
      model: input.textCoachModel,
      outputTokenBudget: 1_600,
      timeoutMs: 30_000,
    }),
  };
  return { policies, policyVersion: input.policyVersion };
}

export function assertKnownAiTask(task: string): DogosAiTask {
  if (!dogosAiTasks.includes(task as DogosAiTask)) {
    throw new Error("DOGOS_AI_TASK_UNSUPPORTED");
  }
  return task as DogosAiTask;
}
