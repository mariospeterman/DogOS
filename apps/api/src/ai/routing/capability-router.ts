import type { DogosAiConfig } from "../model-policy/config.js";
import {
  assertKnownAiTask,
  type AiReadinessStatus,
  type DogosAiTask,
  type DogosAiTaskPolicy,
} from "../model-policy/registry.js";

export interface CapabilityRoute {
  policy: DogosAiTaskPolicy;
  readiness: AiReadinessStatus;
}

export class CapabilityRouter {
  constructor(private readonly config: DogosAiConfig) {}

  route(task: string): CapabilityRoute {
    const resolvedTask = assertKnownAiTask(task);
    const policy = this.config.registry.policies[resolvedTask];
    const readiness = this.readinessFor(resolvedTask);
    if (readiness !== "ready" && policy.fallback !== "deterministic") {
      throw new Error(`DOGOS_AI_CAPABILITY_${readiness.toUpperCase()}`);
    }
    return { policy, readiness };
  }

  readinessFor(task: DogosAiTask): AiReadinessStatus {
    const policy = this.config.registry.policies[task];
    return this.config.readiness[policy.capability];
  }
}
