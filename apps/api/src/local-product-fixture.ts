import { createHash, randomUUID } from "node:crypto";
import {
  canonicalizeLocalizedCase,
  englishOwnerCase,
  germanOwnerCase,
  runCanonicalCase,
} from "@dogos/testing";
import type { ProductDashboard } from "@dogos/database";
import type { SafetyDisposition } from "@dogos/contracts";

export interface LocalProductSnapshot {
  locale: "de-CH" | "en";
  country: "CH";
  currency: "CHF";
  timezone: "Europe/Zurich";
  household: { id: string; name: string };
  dog: { id: string; name: string; breed: string };
  workflowState: string;
  safety: SafetyDisposition;
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

export class LocalProductFixture {
  #state: LocalProductSnapshot;
  readonly #idempotency = new Map<string, { hash: string; result: unknown }>();
  constructor() {
    this.#state = this.initialState("de-CH");
  }
  initialState(locale: "de-CH" | "en"): LocalProductSnapshot {
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
        name:
          locale === "de-CH" ? "Lokaler Testhaushalt" : "Local test household",
      },
      dog: {
        id: "30000000-0000-0000-0000-000000000001",
        name: "Rex",
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
  reset(locale: "de-CH" | "en" = "de-CH"): LocalProductSnapshot {
    this.#state = this.initialState(locale);
    this.#idempotency.clear();
    return this.snapshot();
  }
  snapshot(): LocalProductSnapshot {
    return structuredClone(this.#state);
  }
  dashboard(): ProductDashboard {
    const snapshot = this.snapshot();
    const start = new Date();
    start.setHours(18, 0, 0, 0);
    const calendar = Array.from({ length: 3 }, (_, index) => {
      const plannedStart = new Date(start);
      plannedStart.setDate(start.getDate() + index);
      return {
        durationSeconds: 240,
        id: `session-${index + 1}`,
        isRecovery: index === 2,
        plannedStart: plannedStart.toISOString(),
        purposeCode:
          index === 2 ? "session.observation" : "session.micro_training",
        status: "planned",
      };
    });
    return {
      baselineSuccessRate: 50,
      calendar,
      currentStep: {
        difficulty: snapshot.difficulty,
        durationSeconds: 240,
        repetitions: 6,
        stepCode: "step.low_distraction_baseline",
        stopConditionCodes: [],
      },
      dogId: snapshot.dog.id,
      dogName: snapshot.dog.name,
      goal: snapshot.goal,
      goalText:
        snapshot.locale === "en"
          ? "Walk on a loose lead around other dogs"
          : "Locker an anderen Hunden vorbeigehen",
      latestDecision: snapshot.latestDecision,
      planId: "plan-1",
      planStatus: snapshot.planStatus === "blocked" ? "blocked" : "active",
      riskDisposition: snapshot.safety,
      sessionCount: snapshot.sessions.length,
      todaySessionId: "session-1",
    };
  }
  switchLocale(locale: "de-CH" | "en", traceId: string): LocalProductSnapshot {
    this.#state.locale = locale;
    this.#state.audit.push({ action: "locale.switched", traceId });
    return this.snapshot();
  }
  command<T>(
    identity: string,
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
  ): LocalProductSnapshot {
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
  ): LocalProductSnapshot {
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

  activateAdjustment(traceId: string): LocalProductSnapshot {
    this.#state.planVersion += 1;
    this.#state.audit.push({ action: "plan.adjusted", traceId });
    return this.snapshot();
  }
}
