import { createHash, randomBytes } from "node:crypto";
import postgres, { type Sql } from "postgres";

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CaseShareRecipientRole =
  | "observer_guest"
  | "trainer"
  | "veterinarian"
  | "professional_assistant";
export type CaseShareScope =
  | "dog_profile.read"
  | "goal.read"
  | "plan.read"
  | "session.read"
  | "progress.read"
  | "media.selected.read"
  | "feedback.submit"
  | "trainer_review.submit"
  | "veterinary_note.submit"
  | "plan_proposal.submit"
  | "booking.create";

export interface CaseShareGrantRecord {
  createdAt: string;
  dogId: string;
  expiresAt: string;
  householdId: string;
  id: string;
  maxViews: number;
  recipientRole: CaseShareRecipientRole;
  revokedAt: string | null;
  scopes: CaseShareScope[];
  subjectId: string | null;
  subjectType: string;
  token?: string;
  viewCount: number;
}

export interface FeedbackRequestRecord {
  dogId: string;
  id: string;
  mediaRequested: boolean;
  questions: string[];
  recipientRole: string;
  shareGrantId: string | null;
  status: string;
}

export interface FeedbackResponseRecord {
  certainty: number;
  id: string;
  observationSummary: string;
  responderRole: string;
  subjectiveInterpretation: string | null;
}

export interface ProfessionalReviewRecord {
  correctionType: string;
  id: string;
  professionalRole: "trainer" | "veterinarian";
  summary: string;
}

export interface HandoffPackageRecord {
  contentHash: string;
  dogId: string;
  expiresAt: string;
  id: string;
  packageType: "trainer_handoff" | "veterinary_handoff";
  revokedAt: string | null;
  snapshot: Record<string, unknown>;
  version: number;
}

export interface HandoffDeliveryRecord {
  deliveryMethod: "secure_link" | "pdf_download" | "secure_email";
  handoffPackageId: string;
  id: string;
  shareGrantId: string | null;
  status: string;
}

export interface CollaborationStore {
  createShareGrant(input: {
    createdBy: string;
    dogId: string;
    expiresAt: string;
    householdId: string;
    maxViews?: number;
    recipientRole: CaseShareRecipientRole;
    scopes: CaseShareScope[];
    subjectId?: string | null;
    subjectType: string;
  }): Promise<CaseShareGrantRecord>;
  resolveShareGrant(input: {
    requiredScope?: CaseShareScope;
    token: string;
  }): Promise<CaseShareGrantRecord | null>;
  revokeShareGrant(input: {
    dogId: string;
    householdId: string;
    id: string;
  }): Promise<CaseShareGrantRecord>;
  createFeedbackRequest(input: {
    dogId: string;
    householdId: string;
    mediaRequested: boolean;
    questions: string[];
    recipientRole: FeedbackRequestRecord["recipientRole"];
    requestedBy: string;
    shareGrantId?: string | null;
  }): Promise<FeedbackRequestRecord>;
  submitFeedbackResponse(input: {
    certainty: number;
    feedbackRequestId: string;
    observationSummary: string;
    responderRole: FeedbackResponseRecord["responderRole"];
    subjectiveInterpretation?: string | null;
  }): Promise<FeedbackResponseRecord>;
  submitProfessionalReview(input: {
    correctionType: string;
    dogId: string;
    householdId: string;
    professionalRole: "trainer" | "veterinarian";
    summary: string;
    targetId?: string | null;
    targetType: string;
  }): Promise<ProfessionalReviewRecord>;
  createHandoffPackage(input: {
    consentReference: string;
    createdBy: string;
    dogId: string;
    evidenceRefs: unknown[];
    expiresAt: string;
    householdId: string;
    includedArtifactRefs: unknown[];
    locale: "de-CH" | "en";
    packageType: "trainer_handoff" | "veterinary_handoff";
    snapshot: Record<string, unknown>;
  }): Promise<HandoffPackageRecord>;
  createHandoffDelivery(input: {
    createdBy: string;
    deliveryMethod: HandoffDeliveryRecord["deliveryMethod"];
    dogId: string;
    handoffPackageId: string;
    householdId: string;
    shareGrantId?: string | null;
  }): Promise<HandoffDeliveryRecord>;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export class InMemoryCollaborationStore implements CollaborationStore {
  readonly #grants = new Map<
    string,
    CaseShareGrantRecord & { tokenHash: string }
  >();
  readonly #feedbackRequests = new Map<string, FeedbackRequestRecord>();
  readonly #handoffPackages = new Map<
    string,
    HandoffPackageRecord & { householdId: string }
  >();

  async createShareGrant(
    input: Parameters<CollaborationStore["createShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord> {
    const token = newToken();
    const record: CaseShareGrantRecord & { tokenHash: string } = {
      createdAt: new Date().toISOString(),
      dogId: input.dogId,
      expiresAt: input.expiresAt,
      householdId: input.householdId,
      id: crypto.randomUUID(),
      maxViews: input.maxViews ?? 5,
      recipientRole: input.recipientRole,
      revokedAt: null,
      scopes: [...input.scopes],
      subjectId: input.subjectId ?? null,
      subjectType: input.subjectType,
      token,
      tokenHash: tokenHash(token),
      viewCount: 0,
    };
    this.#grants.set(record.id, record);
    return structuredClone(record);
  }

  async resolveShareGrant(
    input: Parameters<CollaborationStore["resolveShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord | null> {
    const hashed = tokenHash(input.token);
    const grant = [...this.#grants.values()].find(
      (candidate) => candidate.tokenHash === hashed,
    );
    if (
      grant === undefined ||
      grant.revokedAt !== null ||
      Date.parse(grant.expiresAt) <= Date.now() ||
      grant.viewCount >= grant.maxViews ||
      (input.requiredScope !== undefined &&
        !grant.scopes.includes(input.requiredScope))
    ) {
      return null;
    }
    grant.viewCount += 1;
    return structuredClone(withoutPrivateGrantFields(grant));
  }

  async revokeShareGrant(
    input: Parameters<CollaborationStore["revokeShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord> {
    const grant = this.#grants.get(input.id);
    if (
      grant === undefined ||
      grant.householdId !== input.householdId ||
      grant.dogId !== input.dogId
    ) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    grant.revokedAt = new Date().toISOString();
    return structuredClone(withoutPrivateGrantFields(grant));
  }

  async createFeedbackRequest(
    input: Parameters<CollaborationStore["createFeedbackRequest"]>[0],
  ): Promise<FeedbackRequestRecord> {
    const record: FeedbackRequestRecord = {
      dogId: input.dogId,
      id: crypto.randomUUID(),
      mediaRequested: input.mediaRequested,
      questions: [...input.questions],
      recipientRole: input.recipientRole,
      shareGrantId: input.shareGrantId ?? null,
      status: "open",
    };
    this.#feedbackRequests.set(record.id, record);
    return structuredClone(record);
  }

  async submitFeedbackResponse(
    input: Parameters<CollaborationStore["submitFeedbackResponse"]>[0],
  ): Promise<FeedbackResponseRecord> {
    if (!this.#feedbackRequests.has(input.feedbackRequestId)) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    return {
      certainty: input.certainty,
      id: crypto.randomUUID(),
      observationSummary: input.observationSummary,
      responderRole: input.responderRole,
      subjectiveInterpretation: input.subjectiveInterpretation ?? null,
    };
  }

  async submitProfessionalReview(
    input: Parameters<CollaborationStore["submitProfessionalReview"]>[0],
  ): Promise<ProfessionalReviewRecord> {
    return {
      correctionType: input.correctionType,
      id: crypto.randomUUID(),
      professionalRole: input.professionalRole,
      summary: input.summary,
    };
  }

  async createHandoffPackage(
    input: Parameters<CollaborationStore["createHandoffPackage"]>[0],
  ): Promise<HandoffPackageRecord> {
    const snapshot = structuredClone(input.snapshot);
    const record: HandoffPackageRecord & { householdId: string } = {
      contentHash: tokenHash(JSON.stringify(snapshot)),
      dogId: input.dogId,
      expiresAt: input.expiresAt,
      householdId: input.householdId,
      id: crypto.randomUUID(),
      packageType: input.packageType,
      revokedAt: null,
      snapshot,
      version: 1,
    };
    this.#handoffPackages.set(record.id, record);
    return {
      contentHash: record.contentHash,
      dogId: record.dogId,
      expiresAt: record.expiresAt,
      id: record.id,
      packageType: record.packageType,
      revokedAt: record.revokedAt,
      snapshot: structuredClone(record.snapshot),
      version: record.version,
    };
  }

  async createHandoffDelivery(
    input: Parameters<CollaborationStore["createHandoffDelivery"]>[0],
  ): Promise<HandoffDeliveryRecord> {
    const handoffPackage = this.#handoffPackages.get(input.handoffPackageId);
    if (
      handoffPackage === undefined ||
      handoffPackage.householdId !== input.householdId ||
      handoffPackage.dogId !== input.dogId ||
      handoffPackage.revokedAt !== null ||
      Date.parse(handoffPackage.expiresAt) <= Date.now()
    ) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    return {
      deliveryMethod: input.deliveryMethod,
      handoffPackageId: input.handoffPackageId,
      id: crypto.randomUUID(),
      shareGrantId: input.shareGrantId ?? null,
      status: "created",
    };
  }
}

export class CollaborationRepository implements CollaborationStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async createShareGrant(
    input: Parameters<CollaborationStore["createShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord> {
    const token = newToken();
    const [row] = await this.#sql`
      insert into private.case_share_grants (
        token_hash, household_id, dog_id, subject_type, subject_id,
        recipient_role, scopes, expires_at, max_views, created_by
      ) values (
        ${tokenHash(token)}, ${input.householdId}::uuid, ${input.dogId}::uuid,
        ${input.subjectType}, ${input.subjectId ?? null}::uuid,
        ${input.recipientRole}, ${input.scopes}, ${input.expiresAt}::timestamptz,
        ${input.maxViews ?? 5}, ${input.createdBy}::uuid
      )
      returning id::text, household_id::text, dog_id::text, subject_type,
        subject_id::text, recipient_role, scopes, expires_at::text,
        revoked_at::text, max_views, view_count, created_at::text
    `;
    return { ...mapGrant(row!), token };
  }

  async resolveShareGrant(
    input: Parameters<CollaborationStore["resolveShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord | null> {
    const [row] = await this.#sql`
      update private.case_share_grants
      set view_count = view_count + 1,
        claimed_at = coalesce(claimed_at, now())
      where token_hash = ${tokenHash(input.token)}
        and revoked_at is null
        and expires_at > now()
        and view_count < max_views
        and (${input.requiredScope ?? null}::text is null or ${input.requiredScope ?? null} = any(scopes))
      returning id::text, household_id::text, dog_id::text, subject_type,
        subject_id::text, recipient_role, scopes, expires_at::text,
        revoked_at::text, max_views, view_count, created_at::text
    `;
    return row === undefined ? null : mapGrant(row);
  }

  async revokeShareGrant(
    input: Parameters<CollaborationStore["revokeShareGrant"]>[0],
  ): Promise<CaseShareGrantRecord> {
    const [row] = await this.#sql`
      update private.case_share_grants
      set revoked_at = coalesce(revoked_at, now())
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
        and dog_id = ${input.dogId}::uuid
      returning id::text, household_id::text, dog_id::text, subject_type,
        subject_id::text, recipient_role, scopes, expires_at::text,
        revoked_at::text, max_views, view_count, created_at::text
    `;
    if (row === undefined) throw new Error("RESOURCE_NOT_FOUND");
    return mapGrant(row);
  }

  async createFeedbackRequest(
    input: Parameters<CollaborationStore["createFeedbackRequest"]>[0],
  ): Promise<FeedbackRequestRecord> {
    const [row] = await this.#sql`
      insert into api.feedback_requests (
        household_id, dog_id, requested_by, recipient_role, questions,
        media_requested, share_grant_id
      ) values (
        ${input.householdId}::uuid, ${input.dogId}::uuid,
        ${input.requestedBy}::uuid, ${input.recipientRole},
        ${this.#sql.json(input.questions as JsonValue)},
        ${input.mediaRequested}, ${input.shareGrantId ?? null}::uuid
      )
      returning id::text, dog_id::text, questions, media_requested,
        recipient_role, share_grant_id::text, status
    `;
    return mapFeedbackRequest(row!);
  }

  async submitFeedbackResponse(
    input: Parameters<CollaborationStore["submitFeedbackResponse"]>[0],
  ): Promise<FeedbackResponseRecord> {
    const [request] = await this.#sql`
      select household_id::text, dog_id::text
      from api.feedback_requests
      where id = ${input.feedbackRequestId}::uuid
    `;
    if (request === undefined) throw new Error("RESOURCE_NOT_FOUND");
    const [row] = await this.#sql`
      insert into api.feedback_responses (
        feedback_request_id, household_id, dog_id, responder_role,
        structured_observations, subjective_interpretation, certainty
      ) values (
        ${input.feedbackRequestId}::uuid, ${String(request.household_id)}::uuid,
        ${String(request.dog_id)}::uuid, ${input.responderRole},
        ${this.#sql.json({ summary: input.observationSummary } as JsonValue)},
        ${input.subjectiveInterpretation ?? null}, ${input.certainty}
      )
      returning id::text, responder_role, structured_observations,
        subjective_interpretation, certainty
    `;
    return mapFeedbackResponse(row!);
  }

  async submitProfessionalReview(
    input: Parameters<CollaborationStore["submitProfessionalReview"]>[0],
  ): Promise<ProfessionalReviewRecord> {
    const [row] = await this.#sql`
      insert into api.professional_reviews (
        household_id, dog_id, professional_role, target_type, target_id,
        correction_type, observable_corrections
      ) values (
        ${input.householdId}::uuid, ${input.dogId}::uuid,
        ${input.professionalRole}, ${input.targetType},
        ${input.targetId ?? null}::uuid, ${input.correctionType},
        ${this.#sql.json([{ summary: input.summary }] as JsonValue)}
      )
      returning id::text, professional_role, correction_type,
        observable_corrections
    `;
    return mapProfessionalReview(row!);
  }

  async createHandoffPackage(
    input: Parameters<CollaborationStore["createHandoffPackage"]>[0],
  ): Promise<HandoffPackageRecord> {
    const contentHash = tokenHash(JSON.stringify(input.snapshot));
    const [row] = await this.#sql`
      insert into api.handoff_packages (
        package_type, household_id, dog_id, created_by, locale,
        included_artifact_refs, evidence_refs, consent_reference,
        snapshot, content_hash, expires_at
      ) values (
        ${input.packageType}, ${input.householdId}::uuid, ${input.dogId}::uuid,
        ${input.createdBy}::uuid, ${input.locale}::api.locale_tag,
        ${this.#sql.json(input.includedArtifactRefs as JsonValue)},
        ${this.#sql.json(input.evidenceRefs as JsonValue)},
        ${input.consentReference},
        ${this.#sql.json(input.snapshot as JsonValue)},
        ${contentHash}, ${input.expiresAt}::timestamptz
      )
      returning id::text, dog_id::text, package_type, version, snapshot,
        content_hash, expires_at::text, revoked_at::text
    `;
    return mapHandoffPackage(row!);
  }

  async createHandoffDelivery(
    input: Parameters<CollaborationStore["createHandoffDelivery"]>[0],
  ): Promise<HandoffDeliveryRecord> {
    const [handoffPackage] = await this.#sql`
      select id
      from api.handoff_packages
      where id = ${input.handoffPackageId}::uuid
        and household_id = ${input.householdId}::uuid
        and dog_id = ${input.dogId}::uuid
        and revoked_at is null
        and expires_at > now()
    `;
    if (handoffPackage === undefined) throw new Error("RESOURCE_NOT_FOUND");
    const [row] = await this.#sql`
      insert into api.handoff_deliveries (
        handoff_package_id, household_id, dog_id, delivery_method,
        share_grant_id, created_by
      ) values (
        ${input.handoffPackageId}::uuid, ${input.householdId}::uuid,
        ${input.dogId}::uuid, ${input.deliveryMethod},
        ${input.shareGrantId ?? null}::uuid, ${input.createdBy}::uuid
      )
      returning id::text, handoff_package_id::text, delivery_method,
        share_grant_id::text, status
    `;
    return {
      deliveryMethod: String(row!.delivery_method) as HandoffDeliveryRecord["deliveryMethod"],
      handoffPackageId: String(row!.handoff_package_id),
      id: String(row!.id),
      shareGrantId:
        row!.share_grant_id === null ? null : String(row!.share_grant_id),
      status: String(row!.status),
    };
  }
}

function mapGrant(row: Record<string, unknown>): CaseShareGrantRecord {
  return {
    createdAt: String(row.created_at),
    dogId: String(row.dog_id),
    expiresAt: String(row.expires_at),
    householdId: String(row.household_id),
    id: String(row.id),
    maxViews: Number(row.max_views),
    recipientRole: String(row.recipient_role) as CaseShareRecipientRole,
    revokedAt: row.revoked_at === null ? null : String(row.revoked_at),
    scopes: Array.isArray(row.scopes) ? (row.scopes as CaseShareScope[]) : [],
    subjectId: row.subject_id === null ? null : String(row.subject_id),
    subjectType: String(row.subject_type),
    viewCount: Number(row.view_count),
  };
}

function withoutPrivateGrantFields(
  grant: CaseShareGrantRecord & { tokenHash: string },
): CaseShareGrantRecord {
  return {
    createdAt: grant.createdAt,
    dogId: grant.dogId,
    expiresAt: grant.expiresAt,
    householdId: grant.householdId,
    id: grant.id,
    maxViews: grant.maxViews,
    recipientRole: grant.recipientRole,
    revokedAt: grant.revokedAt,
    scopes: [...grant.scopes],
    subjectId: grant.subjectId,
    subjectType: grant.subjectType,
    viewCount: grant.viewCount,
  };
}

function mapFeedbackRequest(row: Record<string, unknown>): FeedbackRequestRecord {
  return {
    dogId: String(row.dog_id),
    id: String(row.id),
    mediaRequested: Boolean(row.media_requested),
    questions: Array.isArray(row.questions) ? (row.questions as string[]) : [],
    recipientRole: String(row.recipient_role),
    shareGrantId:
      row.share_grant_id === null ? null : String(row.share_grant_id),
    status: String(row.status),
  };
}

function mapFeedbackResponse(row: Record<string, unknown>): FeedbackResponseRecord {
  const observations = row.structured_observations as
    | { summary?: unknown }
    | undefined;
  return {
    certainty: Number(row.certainty),
    id: String(row.id),
    observationSummary:
      typeof observations?.summary === "string" ? observations.summary : "",
    responderRole: String(row.responder_role),
    subjectiveInterpretation:
      row.subjective_interpretation === null
        ? null
        : String(row.subjective_interpretation),
  };
}

function mapProfessionalReview(row: Record<string, unknown>): ProfessionalReviewRecord {
  const corrections = Array.isArray(row.observable_corrections)
    ? (row.observable_corrections as Array<{ summary?: unknown }>)
    : [];
  return {
    correctionType: String(row.correction_type),
    id: String(row.id),
    professionalRole: String(row.professional_role) as "trainer" | "veterinarian",
    summary:
      typeof corrections[0]?.summary === "string" ? corrections[0].summary : "",
  };
}

function mapHandoffPackage(row: Record<string, unknown>): HandoffPackageRecord {
  return {
    contentHash: String(row.content_hash),
    dogId: String(row.dog_id),
    expiresAt: String(row.expires_at),
    id: String(row.id),
    packageType: String(row.package_type) as HandoffPackageRecord["packageType"],
    revokedAt: row.revoked_at === null ? null : String(row.revoked_at),
    snapshot:
      typeof row.snapshot === "object" && row.snapshot !== null
        ? (row.snapshot as Record<string, unknown>)
        : {},
    version: Number(row.version),
  };
}
