import postgres, { type Sql } from "postgres";

export interface PrivacyDeletionRequest {
  completedAt: string | null;
  id: string;
  reason: string | null;
  requestedAt: string;
  retentionSummary: Record<string, unknown>;
  status: "requested" | "processing" | "completed" | "rejected_legal_hold";
}

interface PrivacyDeletionRequestRow {
  completed_at: Date | null;
  id: string;
  reason: string | null;
  requested_at: Date;
  retention_summary: unknown;
  status: PrivacyDeletionRequest["status"];
}

function retentionSummary(): Record<string, unknown> {
  return {
    account: "queued_for_erasure",
    billingProjection: "retained_for_legal_and_tax_period",
    conversations: "queued_for_erasure_or_anonymization",
    mediaObjects: "queued_for_storage_deletion",
    modelRunTelemetry: "retained_without_conversation_content",
  };
}

function mapRow(row: PrivacyDeletionRequestRow): PrivacyDeletionRequest {
  return {
    completedAt: row.completed_at?.toISOString() ?? null,
    id: row.id,
    reason: row.reason,
    requestedAt: row.requested_at.toISOString(),
    retentionSummary:
      typeof row.retention_summary === "object" &&
      row.retention_summary !== null
        ? (row.retention_summary as Record<string, unknown>)
        : {},
    status: row.status,
  };
}

export interface PrivacyStore {
  createDeletionRequest(input: {
    actorUserId: string;
    householdId: string;
    reason?: string;
  }): Promise<PrivacyDeletionRequest>;
  exportData(input: {
    actorUserId: string;
    householdId: string;
  }): Promise<Record<string, unknown>>;
}

export class InMemoryPrivacyStore implements PrivacyStore {
  readonly #requests: PrivacyDeletionRequest[] = [];

  createDeletionRequest(
    input: Parameters<PrivacyStore["createDeletionRequest"]>[0],
  ): Promise<PrivacyDeletionRequest> {
    const request: PrivacyDeletionRequest = {
      completedAt: null,
      id: crypto.randomUUID(),
      reason: input.reason ?? null,
      requestedAt: new Date().toISOString(),
      retentionSummary: retentionSummary(),
      status: "requested",
    };
    this.#requests.push(request);
    return Promise.resolve(structuredClone(request));
  }

  exportData(input: Parameters<PrivacyStore["exportData"]>[0]) {
    return Promise.resolve({
      actorUserId: input.actorUserId,
      deletionRequests: structuredClone(this.#requests),
      exportedAt: new Date().toISOString(),
      householdId: input.householdId,
      retention: retentionSummary(),
      scope: [
        "account",
        "dog_profile",
        "coach_conversations",
        "plans",
        "sessions",
        "video_analyses",
        "live_sessions",
        "billing_projection",
      ],
    });
  }
}

export class PrivacyRepository implements PrivacyStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async createDeletionRequest(
    input: Parameters<PrivacyStore["createDeletionRequest"]>[0],
  ): Promise<PrivacyDeletionRequest> {
    const [row] = await this.#sql<PrivacyDeletionRequestRow[]>`
      insert into api.privacy_deletion_requests (
        household_id, actor_user_id, reason, retention_summary
      )
      values (
        ${input.householdId}::uuid,
        ${input.actorUserId}::uuid,
        ${input.reason ?? null},
        ${JSON.stringify(retentionSummary())}::jsonb
      )
      returning *
    `;
    if (row === undefined) throw new Error("PRIVACY_REQUEST_CREATE_FAILED");
    return mapRow(row);
  }

  async exportData(input: Parameters<PrivacyStore["exportData"]>[0]) {
    const deletionRequests = await this.#sql<PrivacyDeletionRequestRow[]>`
      select *
      from api.privacy_deletion_requests
      where household_id = ${input.householdId}::uuid
      order by requested_at desc
    `;
    return {
      actorUserId: input.actorUserId,
      deletionRequests: deletionRequests.map(mapRow),
      exportedAt: new Date().toISOString(),
      householdId: input.householdId,
      retention: retentionSummary(),
      scope: [
        "account",
        "dog_profile",
        "coach_conversations",
        "plans",
        "sessions",
        "video_analyses",
        "live_sessions",
        "billing_projection",
      ],
    };
  }
}
