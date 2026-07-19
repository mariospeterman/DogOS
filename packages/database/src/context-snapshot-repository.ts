import postgres, { type Sql } from "postgres";

type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ContextSnapshotRecord {
  compilerVersion: string;
  createdAt: string;
  dogId: string;
  householdId: string;
  id: string;
  knowledgeReleaseId: string | null;
  locale: string;
  snapshot: JsonValue;
  task: string;
  tokenEstimate: number;
  truncatedCategories: string[];
  version: string;
}

interface ContextSnapshotRow {
  compiler_version: string;
  created_at: Date;
  dog_id: string;
  household_id: string;
  id: string;
  knowledge_release_id: string | null;
  locale: string;
  snapshot: JsonValue;
  task: string;
  token_estimate: number;
  truncated_categories: string[];
  version: string;
}

function mapRow(row: ContextSnapshotRow): ContextSnapshotRecord {
  return {
    compilerVersion: row.compiler_version,
    createdAt: row.created_at.toISOString(),
    dogId: row.dog_id,
    householdId: row.household_id,
    id: row.id,
    knowledgeReleaseId: row.knowledge_release_id,
    locale: row.locale,
    snapshot: row.snapshot,
    task: row.task,
    tokenEstimate: row.token_estimate,
    truncatedCategories: row.truncated_categories,
    version: row.version,
  };
}

export interface ContextSnapshotStore {
  create(input: {
    compilerVersion: string;
    dogId: string;
    householdId: string;
    knowledgeReleaseId?: string | null;
    locale: string;
    selectedReasons?: JsonValue;
    excludedReasons?: JsonValue;
    snapshot: JsonValue;
    task: string;
    tokenEstimate: number;
    truncatedCategories?: string[];
    version: string;
  }): Promise<ContextSnapshotRecord>;
}

export class InMemoryContextSnapshotStore implements ContextSnapshotStore {
  readonly records: ContextSnapshotRecord[] = [];

  create(input: Parameters<ContextSnapshotStore["create"]>[0]) {
    const record: ContextSnapshotRecord = {
      compilerVersion: input.compilerVersion,
      createdAt: new Date().toISOString(),
      dogId: input.dogId,
      householdId: input.householdId,
      id: crypto.randomUUID(),
      knowledgeReleaseId: input.knowledgeReleaseId ?? null,
      locale: input.locale,
      snapshot: structuredClone(input.snapshot),
      task: input.task,
      tokenEstimate: input.tokenEstimate,
      truncatedCategories: input.truncatedCategories ?? [],
      version: input.version,
    };
    this.records.push(record);
    return Promise.resolve(structuredClone(record));
  }
}

export class ContextSnapshotRepository implements ContextSnapshotStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async create(
    input: Parameters<ContextSnapshotStore["create"]>[0],
  ): Promise<ContextSnapshotRecord> {
    const [row] = await this.#sql<ContextSnapshotRow[]>`
      insert into private.context_snapshots (
        version, task, household_id, dog_id, locale, compiler_version,
        knowledge_release_id, token_estimate, truncated_categories,
        selected_reasons, excluded_reasons, snapshot
      )
      values (
        ${input.version},
        ${input.task},
        ${input.householdId}::uuid,
        ${input.dogId}::uuid,
        ${input.locale},
        ${input.compilerVersion},
        ${input.knowledgeReleaseId ?? null},
        ${input.tokenEstimate},
        ${input.truncatedCategories ?? []},
        ${this.#sql.json(input.selectedReasons ?? {})},
        ${this.#sql.json(input.excludedReasons ?? {})},
        ${this.#sql.json(input.snapshot)}
      )
      returning *
    `;
    if (row === undefined) throw new Error("CONTEXT_SNAPSHOT_CREATE_FAILED");
    return mapRow(row);
  }
}
