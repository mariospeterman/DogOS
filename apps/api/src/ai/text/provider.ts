import type { DogosAiTask } from "../model-policy/registry.js";

export interface CanonicalTextRequest {
  contextSnapshotId?: string;
  input: string;
  locale: "de-CH" | "en";
  task: Extract<
    DogosAiTask,
    | "coach.chat"
    | "eval.judge"
    | "knowledge.offline_scout"
    | "knowledge.runtime_search"
    | "language.detect"
    | "onboarding.extract"
    | "plan.compose"
    | "plan.explain"
    | "professional.handoff"
    | "progress.explain"
    | "video.report"
  >;
  traceId: string;
}

export interface ValidatedTextResult {
  citations: string[];
  model: string;
  provider: string;
  text: string;
}

export interface TextModelProvider {
  generate(input: CanonicalTextRequest): Promise<ValidatedTextResult>;
}
