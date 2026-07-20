import postgres, { type Sql } from "postgres";

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
}

type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export type MemoryFactCategory =
  | "stable_profile"
  | "episodic_event"
  | "working_state"
  | "derived_pattern"
  | "temporary_state";
export type MemoryFactStatus =
  | "candidate"
  | "confirmed"
  | "rejected"
  | "superseded"
  | "expired"
  | "forgotten";

export interface MemoryFactRecord {
  category: MemoryFactCategory;
  confidence: number;
  confirmedAt: string | null;
  createdAt: string;
  dogId: string | null;
  evidenceRefs: unknown[];
  expiresAt: string | null;
  householdId: string;
  id: string;
  observedAt: string | null;
  sensitivity: "normal" | "sensitive" | "high";
  sourceMessageId: string | null;
  status: MemoryFactStatus;
  subject: string;
  supersededBy: string | null;
  value: string;
}

interface MemoryFactRow {
  category: MemoryFactCategory;
  confidence: string;
  confirmed_at: Date | null;
  created_at: Date;
  dog_id: string | null;
  evidence_refs: unknown;
  expires_at: Date | null;
  household_id: string;
  id: string;
  observed_at: Date | null;
  sensitivity: "normal" | "sensitive" | "high";
  source_message_id: string | null;
  status: MemoryFactStatus;
  subject: string;
  superseded_by: string | null;
  value: string;
}

function mapRow(row: MemoryFactRow): MemoryFactRecord {
  return {
    category: row.category,
    confidence: Number(row.confidence),
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    dogId: row.dog_id,
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs : [],
    expiresAt: row.expires_at?.toISOString() ?? null,
    householdId: row.household_id,
    id: row.id,
    observedAt: row.observed_at?.toISOString() ?? null,
    sensitivity: row.sensitivity,
    sourceMessageId: row.source_message_id,
    status: row.status,
    subject: row.subject,
    supersededBy: row.superseded_by,
    value: row.value,
  };
}

export interface MemoryStore {
  confirmMemoryCandidate(input: {
    actorUserId: string;
    householdId: string;
    id: string;
  }): Promise<MemoryFactRecord>;
  correctMemory(input: {
    actorUserId: string;
    householdId: string;
    id: string;
    value: string;
  }): Promise<MemoryFactRecord>;
  createMemoryCandidate(input: {
    category: MemoryFactCategory;
    confidence?: number;
    dogId?: string | null;
    evidenceRefs?: unknown[];
    householdId: string;
    sourceMessageId?: string | null;
    subject: string;
    value: string;
  }): Promise<MemoryFactRecord>;
  forgetMemory(input: {
    actorUserId: string;
    householdId: string;
    id: string;
  }): Promise<MemoryFactRecord>;
  getRelevantMemory(input: {
    dogId?: string | null;
    householdId: string;
    query?: string;
  }): Promise<MemoryFactRecord[]>;
  listOwnerVisibleMemory(input: {
    householdId: string;
  }): Promise<MemoryFactRecord[]>;
}

export class InMemoryMemoryStore implements MemoryStore {
  readonly #records = new Map<string, MemoryFactRecord>();

  createMemoryCandidate(
    input: Parameters<MemoryStore["createMemoryCandidate"]>[0],
  ): Promise<MemoryFactRecord> {
    const record: MemoryFactRecord = {
      category: input.category,
      confidence: input.confidence ?? 0.5,
      confirmedAt: null,
      createdAt: new Date().toISOString(),
      dogId: input.dogId ?? null,
      evidenceRefs: input.evidenceRefs ?? [],
      expiresAt: null,
      householdId: input.householdId,
      id: crypto.randomUUID(),
      observedAt: null,
      sensitivity: "normal",
      sourceMessageId: input.sourceMessageId ?? null,
      status: "candidate",
      subject: input.subject,
      supersededBy: null,
      value: input.value,
    };
    this.#records.set(record.id, record);
    return Promise.resolve(structuredClone(record));
  }

  confirmMemoryCandidate(
    input: Parameters<MemoryStore["confirmMemoryCandidate"]>[0],
  ) {
    return this.#update(input.householdId, input.id, {
      confirmedAt: new Date().toISOString(),
      status: "confirmed",
    });
  }

  async correctMemory(input: Parameters<MemoryStore["correctMemory"]>[0]) {
    const existing = this.#records.get(input.id);
    if (existing === undefined || existing.householdId !== input.householdId) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    const replacement = await this.createMemoryCandidate({
      category: existing.category,
      confidence: existing.confidence,
      dogId: existing.dogId,
      evidenceRefs: existing.evidenceRefs,
      householdId: existing.householdId,
      sourceMessageId: existing.sourceMessageId,
      subject: existing.subject,
      value: input.value,
    });
    await this.#update(input.householdId, input.id, {
      status: "superseded",
      supersededBy: replacement.id,
    });
    return this.confirmMemoryCandidate({
      actorUserId: input.actorUserId,
      householdId: input.householdId,
      id: replacement.id,
    });
  }

  forgetMemory(input: Parameters<MemoryStore["forgetMemory"]>[0]) {
    return this.#update(input.householdId, input.id, {
      status: "forgotten",
    });
  }

  getRelevantMemory(input: Parameters<MemoryStore["getRelevantMemory"]>[0]) {
    const query = input.query?.toLocaleLowerCase();
    return Promise.resolve(
      [...this.#records.values()]
        .filter(
          (record) =>
            record.householdId === input.householdId &&
            record.status === "confirmed" &&
            (input.dogId === undefined ||
              input.dogId === null ||
              record.dogId === null ||
              record.dogId === input.dogId) &&
            (query === undefined ||
              record.subject.toLocaleLowerCase().includes(query) ||
              record.value.toLocaleLowerCase().includes(query)),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 12)
        .map((record) => structuredClone(record)),
    );
  }

  listOwnerVisibleMemory(
    input: Parameters<MemoryStore["listOwnerVisibleMemory"]>[0],
  ) {
    return Promise.resolve(
      [...this.#records.values()]
        .filter((record) => record.householdId === input.householdId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((record) => structuredClone(record)),
    );
  }

  #update(
    householdId: string,
    id: string,
    patch: Partial<MemoryFactRecord>,
  ): Promise<MemoryFactRecord> {
    const record = this.#records.get(id);
    if (record === undefined || record.householdId !== householdId) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    const updated = { ...record, ...patch };
    this.#records.set(id, updated);
    return Promise.resolve(structuredClone(updated));
  }
}

export class MemoryRepository implements MemoryStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async createMemoryCandidate(
    input: Parameters<MemoryStore["createMemoryCandidate"]>[0],
  ): Promise<MemoryFactRecord> {
    const [row] = await this.#sql<MemoryFactRow[]>`
      insert into private.memory_facts (
        household_id, dog_id, category, subject, value, source_message_id,
        evidence_refs, confidence
      )
      values (
        ${input.householdId}::uuid,
        ${input.dogId ?? null}::uuid,
        ${input.category},
        ${input.subject},
        ${input.value},
        ${input.sourceMessageId ?? null}::uuid,
        ${this.#sql.json((input.evidenceRefs ?? []) as JsonValue)},
        ${input.confidence ?? 0.5}
      )
      returning *
    `;
    if (row === undefined) throw new Error("MEMORY_CREATE_FAILED");
    return mapRow(row);
  }

  async confirmMemoryCandidate(
    input: Parameters<MemoryStore["confirmMemoryCandidate"]>[0],
  ): Promise<MemoryFactRecord> {
    const [row] = await this.#sql<MemoryFactRow[]>`
      update private.memory_facts
      set status = 'confirmed', confirmed_at = now()
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
        and status = 'candidate'
      returning *
    `;
    if (row === undefined) throw new Error("RESOURCE_NOT_FOUND");
    return mapRow(row);
  }

  async correctMemory(
    input: Parameters<MemoryStore["correctMemory"]>[0],
  ): Promise<MemoryFactRecord> {
    const [replacement] = await this.#sql.begin(async (transaction) => {
      const sql = transaction as unknown as TransactionQuery;
      const tx = transaction as unknown as Sql;
      const existing = (await sql`
        select *
        from private.memory_facts
        where id = ${input.id}::uuid
          and household_id = ${input.householdId}::uuid
        for update
      `) as unknown as MemoryFactRow[];
      const current = existing[0];
      if (current === undefined) throw new Error("RESOURCE_NOT_FOUND");
      const created = (await sql`
        insert into private.memory_facts (
          household_id, dog_id, category, subject, value, source_message_id,
          evidence_refs, confidence, sensitivity, status, confirmed_at
        )
        values (
          ${current.household_id}::uuid,
          ${current.dog_id}::uuid,
          ${current.category},
          ${current.subject},
          ${input.value},
          ${current.source_message_id}::uuid,
          ${tx.json(current.evidence_refs as JsonValue)},
          ${current.confidence},
          ${current.sensitivity},
          'confirmed',
          now()
        )
        returning *
      `) as unknown as MemoryFactRow[];
      await sql`
        update private.memory_facts
        set status = 'superseded', superseded_by = ${created[0]!.id}::uuid
        where id = ${current.id}::uuid
      `;
      return created;
    });
    if (replacement === undefined) throw new Error("MEMORY_CORRECT_FAILED");
    return mapRow(replacement);
  }

  async forgetMemory(input: Parameters<MemoryStore["forgetMemory"]>[0]) {
    const [row] = await this.#sql<MemoryFactRow[]>`
      update private.memory_facts
      set status = 'forgotten'
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
      returning *
    `;
    if (row === undefined) throw new Error("RESOURCE_NOT_FOUND");
    return mapRow(row);
  }

  async getRelevantMemory(
    input: Parameters<MemoryStore["getRelevantMemory"]>[0],
  ): Promise<MemoryFactRecord[]> {
    const query = input.query?.trim() || null;
    const rows = await this.#sql<MemoryFactRow[]>`
      select *
      from private.memory_facts
      where household_id = ${input.householdId}::uuid
        and status = 'confirmed'
        and (${input.dogId ?? null}::uuid is null or dog_id is null or dog_id = ${input.dogId ?? null}::uuid)
        and (expires_at is null or expires_at > now())
        and (
          ${query}::text is null
          or to_tsvector('simple', subject || ' ' || value)
            @@ plainto_tsquery('simple', ${query})
        )
      order by confidence desc, updated_at desc
      limit 12
    `;
    return rows.map(mapRow);
  }

  async listOwnerVisibleMemory(
    input: Parameters<MemoryStore["listOwnerVisibleMemory"]>[0],
  ): Promise<MemoryFactRecord[]> {
    const rows = await this.#sql<MemoryFactRow[]>`
      select *
      from private.memory_facts
      where household_id = ${input.householdId}::uuid
      order by created_at desc
      limit 200
    `;
    return rows.map(mapRow);
  }
}
