import { createHash, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export const signedActionPurposes = [
  "open_today",
  "open_plan",
  "open_calendar",
  "open_progress",
  "open_session",
  "complete_checkin",
  "open_trainers",
  "open_referral",
  "link_identity",
] as const;
export type SignedActionPurpose = (typeof signedActionPurposes)[number];

interface ActionRecord {
  id: string;
  purpose: SignedActionPurpose;
  householdId: string;
  subjectId: string;
  actorId: string | null;
  nonce: string;
  expiresAt: number;
  oneTime: boolean;
  consumedAt: number | null;
  revokedAt: number | null;
  keyId: string;
  tokenHash: string;
}

interface ActionAuditEvent {
  actionId: string;
  event: "issued" | "verified" | "consumed" | "revoked";
  at: number;
}

export interface VerifyActionInput {
  token: string;
  purpose: SignedActionPurpose;
  householdId: string;
  subjectId: string;
  actorId?: string;
  consume?: boolean;
  now?: number;
}

export class SignedActionError extends Error {
  constructor(
    readonly code:
      | "SIGNED_ACTION_INVALID"
      | "SIGNED_ACTION_EXPIRED"
      | "SIGNED_ACTION_REPLAYED",
  ) {
    super(code);
  }
}

export class SignedActionService {
  readonly #records = new Map<string, ActionRecord>();
  readonly #audit: ActionAuditEvent[] = [];
  readonly #keys: Map<string, Uint8Array>;
  #activeKeyId: string;

  constructor(keys: Record<string, string>, activeKeyId: string) {
    this.#keys = new Map(
      Object.entries(keys).map(([id, secret]) => [
        id,
        new TextEncoder().encode(secret),
      ]),
    );
    if (!this.#keys.has(activeKeyId))
      throw new Error("Active signed-action key is missing");
    this.#activeKeyId = activeKeyId;
  }

  rotate(activeKeyId: string, secret: string): void {
    this.#keys.set(activeKeyId, new TextEncoder().encode(secret));
    this.#activeKeyId = activeKeyId;
  }

  async issue(input: {
    purpose: SignedActionPurpose;
    householdId: string;
    subjectId: string;
    actorId?: string;
    ttlSeconds: number;
    oneTime?: boolean;
    now?: number;
  }): Promise<string> {
    const now = input.now ?? Math.floor(Date.now() / 1000);
    const id = randomUUID();
    const nonce = randomUUID();
    const key = this.#keys.get(this.#activeKeyId)!;
    const token = await new SignJWT({ aid: id })
      .setProtectedHeader({ alg: "HS256", kid: this.#activeKeyId, typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + input.ttlSeconds)
      .setJti(nonce)
      .sign(key);
    this.#records.set(id, {
      id,
      purpose: input.purpose,
      householdId: input.householdId,
      subjectId: input.subjectId,
      actorId: input.actorId ?? null,
      nonce,
      expiresAt: now + input.ttlSeconds,
      oneTime: input.oneTime ?? false,
      consumedAt: null,
      revokedAt: null,
      keyId: this.#activeKeyId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    this.#audit.push({ actionId: id, event: "issued", at: now });
    return token;
  }

  revoke(token: string): void {
    const hash = createHash("sha256").update(token).digest("hex");
    const record = [...this.#records.values()].find(
      (item) => item.tokenHash === hash,
    );
    if (record !== undefined) {
      record.revokedAt = Math.floor(Date.now() / 1000);
      this.#audit.push({
        actionId: record.id,
        event: "revoked",
        at: record.revokedAt,
      });
    }
  }

  audit(): readonly ActionAuditEvent[] {
    return structuredClone(this.#audit);
  }

  async verify(input: VerifyActionInput): Promise<ActionRecord> {
    let header: { kid?: string };
    try {
      header = JSON.parse(
        Buffer.from(input.token.split(".")[0] ?? "", "base64url").toString(),
      ) as { kid?: string };
    } catch {
      throw new SignedActionError("SIGNED_ACTION_INVALID");
    }
    const key =
      header.kid === undefined ? undefined : this.#keys.get(header.kid);
    if (key === undefined) throw new SignedActionError("SIGNED_ACTION_INVALID");
    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
    try {
      payload = (
        await jwtVerify(input.token, key, {
          algorithms: ["HS256"],
          currentDate: new Date(
            (input.now ?? Math.floor(Date.now() / 1000)) * 1000,
          ),
        })
      ).payload;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ERR_JWT_EXPIRED"
      )
        throw new SignedActionError("SIGNED_ACTION_EXPIRED");
      throw new SignedActionError("SIGNED_ACTION_INVALID");
    }
    const record =
      typeof payload.aid === "string"
        ? this.#records.get(payload.aid)
        : undefined;
    const hash = createHash("sha256").update(input.token).digest("hex");
    if (
      record === undefined ||
      record.tokenHash !== hash ||
      record.revokedAt !== null ||
      record.purpose !== input.purpose ||
      record.householdId !== input.householdId ||
      record.subjectId !== input.subjectId ||
      (record.actorId !== null && record.actorId !== input.actorId)
    ) {
      throw new SignedActionError("SIGNED_ACTION_INVALID");
    }
    const now = input.now ?? Math.floor(Date.now() / 1000);
    if (record.expiresAt <= now)
      throw new SignedActionError("SIGNED_ACTION_EXPIRED");
    if (record.oneTime && record.consumedAt !== null)
      throw new SignedActionError("SIGNED_ACTION_REPLAYED");
    this.#audit.push({ actionId: record.id, event: "verified", at: now });
    if (record.oneTime && input.consume) {
      record.consumedAt = now;
      this.#audit.push({ actionId: record.id, event: "consumed", at: now });
    }
    return record;
  }
}
