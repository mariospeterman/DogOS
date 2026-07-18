import postgres, { type Sql } from "postgres";

export type LiveCoachingStatus = "created" | "active" | "completed" | "failed";

export interface LiveCoachingSessionRecord {
  completedAt: string | null;
  consumedMinutes: number;
  createdAt: string;
  dogId: string;
  householdId: string;
  id: string;
  plannedMinutes: number;
  roomName: string;
  startedAt: string | null;
  status: LiveCoachingStatus;
  summary: string | null;
}

interface LiveCoachingSessionRow {
  completed_at: Date | null;
  consumed_minutes: number;
  created_at: Date;
  dog_id: string;
  household_id: string;
  id: string;
  planned_minutes: number;
  room_name: string;
  started_at: Date | null;
  status: LiveCoachingStatus;
  summary: string | null;
}

function mapRow(row: LiveCoachingSessionRow): LiveCoachingSessionRecord {
  return {
    completedAt: row.completed_at?.toISOString() ?? null,
    consumedMinutes: row.consumed_minutes,
    createdAt: row.created_at.toISOString(),
    dogId: row.dog_id,
    householdId: row.household_id,
    id: row.id,
    plannedMinutes: row.planned_minutes,
    roomName: row.room_name,
    startedAt: row.started_at?.toISOString() ?? null,
    status: row.status,
    summary: row.summary,
  };
}

export interface LiveCoachingStore {
  complete(input: {
    consumedMinutes: number;
    householdId: string;
    id: string;
    summary: string;
  }): Promise<LiveCoachingSessionRecord>;
  create(input: {
    actorUserId: string;
    dogId: string;
    householdId: string;
    plannedMinutes: number;
  }): Promise<LiveCoachingSessionRecord>;
  get(input: {
    householdId: string;
    id: string;
  }): Promise<LiveCoachingSessionRecord | null>;
}

export class InMemoryLiveCoachingStore implements LiveCoachingStore {
  readonly #records = new Map<string, LiveCoachingSessionRecord>();

  async create(
    input: Parameters<LiveCoachingStore["create"]>[0],
  ): Promise<LiveCoachingSessionRecord> {
    const id = crypto.randomUUID();
    const record: LiveCoachingSessionRecord = {
      completedAt: null,
      consumedMinutes: 0,
      createdAt: new Date().toISOString(),
      dogId: input.dogId,
      householdId: input.householdId,
      id,
      plannedMinutes: input.plannedMinutes,
      roomName: `dogos-${id}`,
      startedAt: new Date().toISOString(),
      status: "active",
      summary: null,
    };
    this.#records.set(id, record);
    return structuredClone(record);
  }

  async complete(
    input: Parameters<LiveCoachingStore["complete"]>[0],
  ): Promise<LiveCoachingSessionRecord> {
    const record = this.#records.get(input.id);
    if (record === undefined || record.householdId !== input.householdId) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    const updated: LiveCoachingSessionRecord = {
      ...record,
      completedAt: new Date().toISOString(),
      consumedMinutes: input.consumedMinutes,
      status: "completed",
      summary: input.summary,
    };
    this.#records.set(input.id, updated);
    return structuredClone(updated);
  }

  get(input: Parameters<LiveCoachingStore["get"]>[0]) {
    const record = this.#records.get(input.id);
    return Promise.resolve(
      record === undefined || record.householdId !== input.householdId
        ? null
        : structuredClone(record),
    );
  }
}

export class LiveCoachingRepository implements LiveCoachingStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async create(
    input: Parameters<LiveCoachingStore["create"]>[0],
  ): Promise<LiveCoachingSessionRecord> {
    const id = crypto.randomUUID();
    const [row] = await this.#sql<LiveCoachingSessionRow[]>`
      insert into api.live_coaching_sessions (
        id, household_id, dog_id, actor_user_id, status, room_name,
        planned_minutes, started_at
      )
      values (
        ${id}::uuid,
        ${input.householdId}::uuid,
        ${input.dogId}::uuid,
        ${input.actorUserId}::uuid,
        'active',
        ${`dogos-${id}`},
        ${input.plannedMinutes},
        now()
      )
      returning *
    `;
    if (row === undefined) throw new Error("LIVE_SESSION_CREATE_FAILED");
    return mapRow(row);
  }

  async complete(
    input: Parameters<LiveCoachingStore["complete"]>[0],
  ): Promise<LiveCoachingSessionRecord> {
    const [row] = await this.#sql<LiveCoachingSessionRow[]>`
      update api.live_coaching_sessions
      set status = 'completed',
        completed_at = now(),
        consumed_minutes = ${input.consumedMinutes},
        summary = ${input.summary}
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
      returning *
    `;
    if (row === undefined) throw new Error("RESOURCE_NOT_FOUND");
    return mapRow(row);
  }

  async get(
    input: Parameters<LiveCoachingStore["get"]>[0],
  ): Promise<LiveCoachingSessionRecord | null> {
    const [row] = await this.#sql<LiveCoachingSessionRow[]>`
      select *
      from api.live_coaching_sessions
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
    `;
    return row === undefined ? null : mapRow(row);
  }
}
