import postgres, { type Sql } from "postgres";

export type VideoAnalysisStatus =
  "upload_requested" | "uploaded" | "processing" | "completed" | "failed";

export interface VideoFinding {
  confidence: number;
  evidence: string;
  label: string;
  recommendation: string;
}

export interface VideoAnalysisRecord {
  completedAt: string | null;
  contentType: "video/mp4" | "video/quicktime" | "video/webm";
  createdAt: string;
  dogId: string;
  failureCode: string | null;
  findings: VideoFinding[];
  householdId: string;
  id: string;
  originalFilename: string;
  sizeBytes: number;
  status: VideoAnalysisStatus;
  storageObjectKey: string;
  uploadedAt: string | null;
}

interface VideoAnalysisRow {
  completed_at: Date | null;
  content_type: "video/mp4" | "video/quicktime" | "video/webm";
  created_at: Date;
  dog_id: string;
  failure_code: string | null;
  findings: unknown;
  household_id: string;
  id: string;
  original_filename: string;
  size_bytes: string;
  status: VideoAnalysisStatus;
  storage_object_key: string;
  uploaded_at: Date | null;
}

function findings(value: unknown): VideoFinding[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is VideoFinding => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Partial<VideoFinding>;
    return (
      typeof candidate.confidence === "number" &&
      typeof candidate.evidence === "string" &&
      typeof candidate.label === "string" &&
      typeof candidate.recommendation === "string"
    );
  });
}

function mapRow(row: VideoAnalysisRow): VideoAnalysisRecord {
  return {
    completedAt: row.completed_at?.toISOString() ?? null,
    contentType: row.content_type,
    createdAt: row.created_at.toISOString(),
    dogId: row.dog_id,
    failureCode: row.failure_code,
    findings: findings(row.findings),
    householdId: row.household_id,
    id: row.id,
    originalFilename: row.original_filename,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
    storageObjectKey: row.storage_object_key,
    uploadedAt: row.uploaded_at?.toISOString() ?? null,
  };
}

export interface VideoAnalysisStore {
  completeUpload(input: {
    actorUserId: string;
    householdId: string;
    id: string;
  }): Promise<VideoAnalysisRecord>;
  create(input: {
    actorUserId: string;
    contentType: "video/mp4" | "video/quicktime" | "video/webm";
    dogId: string;
    householdId: string;
    originalFilename: string;
    sizeBytes: number;
  }): Promise<VideoAnalysisRecord>;
  get(input: {
    householdId: string;
    id: string;
  }): Promise<VideoAnalysisRecord | null>;
  list(input: {
    dogId: string;
    householdId: string;
  }): Promise<VideoAnalysisRecord[]>;
}

function deterministicFindings(): VideoFinding[] {
  return [
    {
      confidence: 0.72,
      evidence: "Owner-submitted clip queued through DogOS video workflow",
      label: "Handler timing review",
      recommendation:
        "Mark the desired response once, then pause before repeating the cue.",
    },
    {
      confidence: 0.64,
      evidence:
        "Clip requires owner confirmation before becoming training evidence",
      label: "Observation quality",
      recommendation:
        "Use the next session check-in to confirm success rate and food acceptance.",
    },
  ];
}

export class InMemoryVideoAnalysisStore implements VideoAnalysisStore {
  readonly #records = new Map<string, VideoAnalysisRecord>();

  async create(
    input: Parameters<VideoAnalysisStore["create"]>[0],
  ): Promise<VideoAnalysisRecord> {
    const id = crypto.randomUUID();
    const record: VideoAnalysisRecord = {
      completedAt: null,
      contentType: input.contentType,
      createdAt: new Date().toISOString(),
      dogId: input.dogId,
      failureCode: null,
      findings: [],
      householdId: input.householdId,
      id,
      originalFilename: input.originalFilename,
      sizeBytes: input.sizeBytes,
      status: "upload_requested",
      storageObjectKey: `${input.householdId}/${input.dogId}/${id}`,
      uploadedAt: null,
    };
    this.#records.set(id, record);
    return structuredClone(record);
  }

  async completeUpload(
    input: Parameters<VideoAnalysisStore["completeUpload"]>[0],
  ): Promise<VideoAnalysisRecord> {
    const record = this.#records.get(input.id);
    if (record === undefined || record.householdId !== input.householdId) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
    const updated: VideoAnalysisRecord = {
      ...record,
      completedAt: new Date().toISOString(),
      findings: deterministicFindings(),
      status: "completed",
      uploadedAt: record.uploadedAt ?? new Date().toISOString(),
    };
    this.#records.set(input.id, updated);
    return structuredClone(updated);
  }

  get(input: Parameters<VideoAnalysisStore["get"]>[0]) {
    const record = this.#records.get(input.id);
    return Promise.resolve(
      record === undefined || record.householdId !== input.householdId
        ? null
        : structuredClone(record),
    );
  }

  list(input: Parameters<VideoAnalysisStore["list"]>[0]) {
    return Promise.resolve(
      [...this.#records.values()]
        .filter(
          (record) =>
            record.householdId === input.householdId &&
            record.dogId === input.dogId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .map((record) => structuredClone(record)),
    );
  }
}

export class VideoAnalysisRepository implements VideoAnalysisStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async create(
    input: Parameters<VideoAnalysisStore["create"]>[0],
  ): Promise<VideoAnalysisRecord> {
    const [row] = await this.#sql<VideoAnalysisRow[]>`
      insert into api.video_analyses (
        household_id, dog_id, actor_user_id, original_filename, content_type,
        size_bytes, storage_object_key
      )
      values (
        ${input.householdId}::uuid,
        ${input.dogId}::uuid,
        ${input.actorUserId}::uuid,
        ${input.originalFilename},
        ${input.contentType},
        ${input.sizeBytes},
        ${`${input.householdId}/${input.dogId}/${crypto.randomUUID()}`}
      )
      returning *
    `;
    if (row === undefined) throw new Error("VIDEO_ANALYSIS_CREATE_FAILED");
    return mapRow(row);
  }

  async completeUpload(
    input: Parameters<VideoAnalysisStore["completeUpload"]>[0],
  ): Promise<VideoAnalysisRecord> {
    const [row] = await this.#sql<VideoAnalysisRow[]>`
      update api.video_analyses
      set status = 'completed',
        uploaded_at = coalesce(uploaded_at, now()),
        completed_at = now(),
        findings = ${JSON.stringify(deterministicFindings())}::jsonb
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
      returning *
    `;
    if (row === undefined) throw new Error("RESOURCE_NOT_FOUND");
    return mapRow(row);
  }

  async get(
    input: Parameters<VideoAnalysisStore["get"]>[0],
  ): Promise<VideoAnalysisRecord | null> {
    const [row] = await this.#sql<VideoAnalysisRow[]>`
      select *
      from api.video_analyses
      where id = ${input.id}::uuid
        and household_id = ${input.householdId}::uuid
    `;
    return row === undefined ? null : mapRow(row);
  }

  async list(
    input: Parameters<VideoAnalysisStore["list"]>[0],
  ): Promise<VideoAnalysisRecord[]> {
    const rows = await this.#sql<VideoAnalysisRow[]>`
      select *
      from api.video_analyses
      where household_id = ${input.householdId}::uuid
        and dog_id = ${input.dogId}::uuid
      order by created_at desc
      limit 20
    `;
    return rows.map(mapRow);
  }
}
