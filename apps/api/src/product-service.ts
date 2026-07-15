import { createHash, randomUUID } from "node:crypto";
import {
  canonicalizeLocalizedCase,
  englishOwnerCase,
  germanOwnerCase,
  runCanonicalCase,
} from "@dogos/testing";

export type LocalIdentity =
  "owner" | "caregiver" | "viewer" | "trainer" | "unrelated";
export const localIdentities: Record<
  LocalIdentity,
  { id: string; role: string; householdId: string | null }
> = {
  owner: {
    id: "10000000-0000-0000-0000-000000000001",
    role: "owner",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  caregiver: {
    id: "10000000-0000-0000-0000-000000000002",
    role: "caregiver",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  viewer: {
    id: "10000000-0000-0000-0000-000000000003",
    role: "viewer",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  trainer: {
    id: "10000000-0000-0000-0000-000000000006",
    role: "trainer",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  unrelated: {
    id: "10000000-0000-0000-0000-000000000005",
    role: "owner",
    householdId: "20000000-0000-0000-0000-000000000002",
  },
};

export interface ProductSnapshot {
  locale: "de-CH" | "en";
  country: "CH";
  currency: "CHF";
  timezone: "Europe/Zurich";
  household: { id: string; name: string };
  dog: { id: string; name: string; breed: string };
  workflowState: string;
  safety: string;
  goal: string;
  planStatus: string;
  planVersion: number;
  difficulty: number;
  sessions: Array<{
    id: string;
    status: string;
    success: number;
    foodAccepted: boolean;
  }>;
  latestDecision: string;
  audit: Array<{ action: string; traceId: string }>;
}

export class ProductService {
  #state: ProductSnapshot;
  readonly #idempotency = new Map<string, { hash: string; result: unknown }>();
  constructor() {
    this.#state = this.initialState("de-CH");
  }
  initialState(locale: "de-CH" | "en"): ProductSnapshot {
    const output = runCanonicalCase(
      canonicalizeLocalizedCase(
        locale === "de-CH" ? germanOwnerCase : englishOwnerCase,
      ),
    );
    return {
      locale,
      country: "CH",
      currency: "CHF",
      timezone: "Europe/Zurich",
      household: {
        id: "20000000-0000-0000-0000-000000000001",
        name: locale === "de-CH" ? "Familie Keller" : "Keller household",
      },
      dog: {
        id: "30000000-0000-0000-0000-000000000001",
        name: "Milo",
        breed: "Mischling / mixed",
      },
      workflowState: "plan_ready",
      safety: output.safety.disposition,
      goal: "goal.loose_leash_walking",
      planStatus: output.plan.status,
      planVersion: 1,
      difficulty: 1,
      sessions: [],
      latestDecision: "repeat_step",
      audit: [],
    };
  }
  reset(locale: "de-CH" | "en" = "de-CH"): ProductSnapshot {
    this.#state = this.initialState(locale);
    this.#idempotency.clear();
    return this.snapshot();
  }
  snapshot(): ProductSnapshot {
    return structuredClone(this.#state);
  }
  switchLocale(locale: "de-CH" | "en", traceId: string): ProductSnapshot {
    this.#state.locale = locale;
    this.#state.audit.push({ action: "locale.switched", traceId });
    return this.snapshot();
  }
  command<T>(
    identity: LocalIdentity,
    key: string,
    body: unknown,
    action: () => T,
  ): { result: T; replayed: boolean } {
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const id = `${identity}:${key}`;
    const existing = this.#idempotency.get(id);
    if (existing !== undefined) {
      if (existing.hash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
      return { result: existing.result as T, replayed: true };
    }
    const result = action();
    this.#idempotency.set(id, { hash, result });
    return { result, replayed: false };
  }
  completeSession(
    input: { success: number; foodAccepted: boolean; avoidance?: boolean },
    traceId: string,
  ): ProductSnapshot {
    const id = randomUUID();
    this.#state.sessions.push({
      id,
      status: "completed",
      success: input.success,
      foodAccepted: input.foodAccepted,
    });
    if (!input.foodAccepted && input.avoidance) {
      this.#state.difficulty = Math.max(1, this.#state.difficulty - 1);
      this.#state.latestDecision = "reduce_difficulty";
      this.#state.safety = "stop_training";
    } else if (
      this.#state.sessions.length >= 3 &&
      this.#state.sessions.slice(-3).every((session) => session.success >= 80)
    ) {
      this.#state.difficulty = Math.min(10, this.#state.difficulty + 1);
      this.#state.latestDecision = "increase_difficulty";
    } else this.#state.latestDecision = "repeat_step";
    this.#state.audit.push({ action: "session.completed", traceId });
    return this.snapshot();
  }
  setSafety(
    kind: "low" | "pain" | "child_bite",
    traceId: string,
  ): ProductSnapshot {
    this.#state.safety =
      kind === "low"
        ? "continue_low_risk_training"
        : kind === "pain"
          ? "require_veterinary_review"
          : "urgent_safety_message";
    if (kind !== "low") {
      this.#state.planStatus = "blocked";
      this.#state.workflowState = "professional_escalation";
    }
    this.#state.audit.push({ action: "safety.assessed", traceId });
    return this.snapshot();
  }

  assertSessionStartAllowed(): void {
    if (this.#state.planStatus === "blocked")
      throw new Error("SAFETY_REVIEW_REQUIRED");
  }

  assertPlanGenerationAllowed(): void {
    if (this.#state.planStatus === "blocked")
      throw new Error("PLAN_GENERATION_BLOCKED");
  }

  activateAdjustment(traceId: string): ProductSnapshot {
    this.#state.planVersion += 1;
    this.#state.audit.push({ action: "plan.adjusted", traceId });
    return this.snapshot();
  }
}
