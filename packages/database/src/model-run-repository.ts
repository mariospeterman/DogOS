import postgres, { type Sql } from "postgres";

export class ModelRunRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async record(input: {
    contextSnapshotId?: string | null;
    latencyMs: number;
    modelReleaseManifestId?: string | null;
    model: string;
    outcome: "failed" | "succeeded";
    policyVersion?: string | null;
    provider: string;
    task?: string | null;
    usage: Record<string, number> | null;
  }): Promise<void> {
    await this.#sql`
      insert into private.model_runs
        (provider, model_id, prompt_version, schema_version, usage, latency_ms,
         outcome, context_snapshot_id, task, model_release_manifest_id,
         policy_version)
      values (${input.provider}, ${input.model}, 'coach-rewrite-v1', '1',
        ${input.usage === null ? null : this.#sql.json(input.usage)},
        ${input.latencyMs}, ${input.outcome},
        ${input.contextSnapshotId ?? null}::uuid, ${input.task ?? null},
        ${input.modelReleaseManifestId ?? null}, ${input.policyVersion ?? null})
    `;
  }
}
