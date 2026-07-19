import postgres, { type Sql } from "postgres";

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ProfessionalHandoffTarget = "trainer" | "veterinary";

export interface ProfessionalHandoffEvidenceRef {
  id: string;
  kind: "memory" | "plan" | "progress" | "session" | "video";
  label: string;
}

export interface ProfessionalHandoffSummary {
  dog: {
    currentStep: string | null;
    goalText: string;
    name: string;
    profileSummary: string | null;
  };
  evidenceCounts: {
    confirmedMemory: number;
    reviewedVideo: number;
    videoFindings: number;
  };
  ownerRequest: string;
  professionalQuestion: string;
  risk: {
    disposition: string;
    latestDecision: string;
  };
  trainingStatus: {
    baselineSuccessRate: number | null;
    planStatus: string;
    sessionCount: number;
    targetSuccessRate: number | null;
  };
  transparency: string;
}

export interface ProfessionalHandoffRecord {
  createdAt: string;
  disagreements: string[];
  dogId: string;
  evidenceRefs: ProfessionalHandoffEvidenceRef[];
  goalId: string | null;
  handoffGeneratedAt: string;
  householdId: string;
  id: string;
  reasonCode: string;
  shareExpiresAt: string | null;
  status: "requested" | "scheduled" | "completed" | "cancelled";
  summary: ProfessionalHandoffSummary;
  targetProfessionalType: ProfessionalHandoffTarget;
}

interface ProfessionalHandoffRow {
  created_at: Date | string;
  dog_id: string;
  goal_id: string | null;
  handoff_disagreements: unknown;
  handoff_evidence_refs: unknown;
  handoff_generated_at: Date | string | null;
  handoff_summary: unknown;
  household_id: string;
  id: string;
  reason_code: string;
  share_expires_at: Date | string | null;
  status: ProfessionalHandoffRecord["status"];
  target_professional_type: ProfessionalHandoffTarget;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function evidenceRefs(value: unknown): ProfessionalHandoffEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProfessionalHandoffEvidenceRef => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Partial<ProfessionalHandoffEvidenceRef>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.label === "string" &&
      (candidate.kind === "memory" ||
        candidate.kind === "plan" ||
        candidate.kind === "progress" ||
        candidate.kind === "session" ||
        candidate.kind === "video")
    );
  });
}

function disagreements(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapRow(row: ProfessionalHandoffRow): ProfessionalHandoffRecord {
  return {
    createdAt: iso(row.created_at)!,
    disagreements: disagreements(row.handoff_disagreements),
    dogId: row.dog_id,
    evidenceRefs: evidenceRefs(row.handoff_evidence_refs),
    goalId: row.goal_id,
    handoffGeneratedAt:
      iso(row.handoff_generated_at) ?? iso(row.created_at)!,
    householdId: row.household_id,
    id: row.id,
    reasonCode: row.reason_code,
    shareExpiresAt: iso(row.share_expires_at),
    status: row.status,
    summary: row.handoff_summary as ProfessionalHandoffSummary,
    targetProfessionalType: row.target_professional_type,
  };
}

export interface ProfessionalHandoffStore {
  create(input: {
    actorUserId: string;
    dogId: string;
    evidenceRefs: ProfessionalHandoffEvidenceRef[];
    goalId?: string | null;
    householdId: string;
    reasonCode: string;
    shareExpiresAt?: string | null;
    summary: ProfessionalHandoffSummary;
    targetProfessionalType: ProfessionalHandoffTarget;
    disagreements: string[];
  }): Promise<ProfessionalHandoffRecord>;
}

export class InMemoryProfessionalHandoffStore
  implements ProfessionalHandoffStore
{
  readonly #records = new Map<string, ProfessionalHandoffRecord>();

  async create(
    input: Parameters<ProfessionalHandoffStore["create"]>[0],
  ): Promise<ProfessionalHandoffRecord> {
    const now = new Date().toISOString();
    const record: ProfessionalHandoffRecord = {
      createdAt: now,
      disagreements: structuredClone(input.disagreements),
      dogId: input.dogId,
      evidenceRefs: structuredClone(input.evidenceRefs),
      goalId: input.goalId ?? null,
      handoffGeneratedAt: now,
      householdId: input.householdId,
      id: crypto.randomUUID(),
      reasonCode: input.reasonCode,
      shareExpiresAt: input.shareExpiresAt ?? null,
      status: "requested",
      summary: structuredClone(input.summary),
      targetProfessionalType: input.targetProfessionalType,
    };
    this.#records.set(record.id, record);
    return structuredClone(record);
  }
}

export class ProfessionalHandoffRepository
  implements ProfessionalHandoffStore
{
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async create(
    input: Parameters<ProfessionalHandoffStore["create"]>[0],
  ): Promise<ProfessionalHandoffRecord> {
    const [projection] = await this.#sql<{ goal_id: string | null }[]>`
      select op.goal_id::text
      from private.onboarding_projections op
      join api.dogs dog on dog.id = op.dog_id
      where dog.household_id = ${input.householdId}::uuid
        and op.dog_id = ${input.dogId}::uuid
      order by op.updated_at desc
      limit 1
    `;
    const goalId = input.goalId ?? projection?.goal_id ?? null;
    const [row] = await this.#sql<ProfessionalHandoffRow[]>`
      insert into api.professional_referrals (
        household_id, dog_id, goal_id, reason_code, target_professional_type,
        handoff_summary, handoff_evidence_refs, handoff_disagreements,
        handoff_generated_at, share_expires_at, status
      )
      values (
        ${input.householdId}::uuid,
        ${input.dogId}::uuid,
        ${goalId}::uuid,
        ${input.reasonCode},
        ${input.targetProfessionalType},
        ${this.#sql.json(input.summary as unknown as JsonValue)},
        ${this.#sql.json(input.evidenceRefs as unknown as JsonValue)},
        ${this.#sql.json(input.disagreements as unknown as JsonValue)},
        now(),
        ${input.shareExpiresAt ?? null}::timestamptz,
        'requested'
      )
      returning
        id::text, household_id::text, dog_id::text, goal_id::text,
        reason_code, target_professional_type, status, handoff_summary,
        handoff_evidence_refs, handoff_disagreements, handoff_generated_at,
        share_expires_at, created_at
    `;
    if (row === undefined) throw new Error("PROFESSIONAL_HANDOFF_CREATE_FAILED");
    return mapRow(row);
  }
}
