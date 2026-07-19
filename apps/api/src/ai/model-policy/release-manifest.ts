import type { DogosAiTask, ModelPolicyRegistry } from "./registry.js";

export interface AiReleaseManifest {
  aggregateResult: number;
  approvalDate: string;
  contextCompilerVersion: string;
  evaluationDatasetVersion: string;
  expiry: string;
  hardGateFailures: string[];
  id: string;
  jurisdictions: string[];
  knowledgeReleaseId: string | null;
  model: string;
  permittedReleaseChannels: string[];
  professionalReviewerId: string;
  promptVersion: string;
  protocolVersions: string[];
  provider: string;
  purpose: DogosAiTask;
  rollbackTarget: string | null;
  schemaVersion: string;
  toolSetVersion: string;
}

export const approvedAiReleaseManifests = Object.freeze(
  [] as AiReleaseManifest[],
);

function releaseManifestCatalog(
  manifests: readonly AiReleaseManifest[] | undefined,
) {
  if (manifests === undefined || manifests.length === 0) {
    return approvedAiReleaseManifests;
  }
  return [...approvedAiReleaseManifests, ...manifests];
}

export function assertApprovedAiReleaseManifest(input: {
  manifests?: readonly AiReleaseManifest[];
  model: string;
  provider: string;
  purpose: DogosAiTask;
  releaseManifestId?: string;
}): AiReleaseManifest {
  if (
    input.releaseManifestId === undefined ||
    input.releaseManifestId.trim().length === 0
  ) {
    throw new Error("DOGOS_AI_RELEASE_MANIFEST_REQUIRED");
  }
  const manifest = releaseManifestCatalog(input.manifests).find(
    (candidate) => candidate.id === input.releaseManifestId,
  );
  if (manifest === undefined) {
    throw new Error("DOGOS_AI_RELEASE_MANIFEST_UNKNOWN");
  }
  if (
    manifest.model !== input.model ||
    manifest.provider !== input.provider ||
    manifest.purpose !== input.purpose
  ) {
    throw new Error("DOGOS_AI_RELEASE_MANIFEST_MISMATCH");
  }
  if (
    manifest.hardGateFailures.length > 0 ||
    Number.isNaN(Date.parse(manifest.expiry)) ||
    Date.parse(manifest.expiry) <= Date.now()
  ) {
    throw new Error("DOGOS_AI_RELEASE_MANIFEST_EXPIRED_OR_FAILED");
  }
  return manifest;
}

export function assertRegistryReleaseManifests(input: {
  manifests?: readonly AiReleaseManifest[];
  manifestIds: Partial<Record<DogosAiTask, string>>;
  registry: ModelPolicyRegistry;
  required: boolean;
}): void {
  if (!input.required) return;
  for (const policy of Object.values(input.registry.policies)) {
    if (policy.provider === "deterministic" || policy.provider === "local") {
      continue;
    }
    assertApprovedAiReleaseManifest({
      model: policy.model,
      provider: policy.provider,
      purpose: policy.task,
      ...(input.manifests === undefined ? {} : { manifests: input.manifests }),
      ...(input.manifestIds[policy.task] === undefined
        ? {}
        : { releaseManifestId: input.manifestIds[policy.task] }),
    });
  }
}
