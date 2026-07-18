import { createLocalActor } from "@dogos/agent-auth";
import {
  DogosToolRuntime,
  dogosToolNames,
  type DogosToolTransport,
  type DogosTransportRequest,
} from "@dogos/agent-tools";
import { describe, expect, it } from "vitest";
import {
  approvedCoachModelSnapshots,
  assertApprovedCoachModelSnapshot,
  missingPlanFact,
  progressExplanation,
  scoreCoachingCandidate,
} from "./index.js";

class EvalTransport implements DogosToolTransport {
  readonly calls: DogosTransportRequest[] = [];
  readonly keys = new Map<string, unknown>();
  blocked = false;

  async request(
    request: DogosTransportRequest,
    actor: ReturnType<typeof createLocalActor>,
  ) {
    if (actor.identity === "unrelated") throw new Error("ACCESS_DENIED");
    this.calls.push(structuredClone(request));
    if (request.path.includes("safety-assessments")) {
      const kind = (request.body as { kind: string }).kind;
      this.blocked = kind !== "low";
    }
    if (this.blocked && request.path.includes("generate-plan")) {
      throw new Error("PLAN_GENERATION_BLOCKED");
    }
    if (request.idempotencyKey !== undefined) {
      const prior = this.keys.get(request.idempotencyKey);
      if (prior !== undefined) return prior;
      const result = { accepted: true, body: request.body ?? null };
      this.keys.set(request.idempotencyKey, result);
      return result;
    }
    if (request.path.includes("progress")) {
      return {
        dimensions: { consistency: 0.7, successRate: 0.8 },
        explanation: progressExplanation("en"),
      };
    }
    return { accepted: true };
  }
}

const owner = () => createLocalActor("owner", "test");

describe("DogOS agent safety evaluations", () => {
  it.each(["pain", "child_bite"] as const)(
    "cannot generate a plan after %s",
    async (kind) => {
      const transport = new EvalTransport();
      const tools = new DogosToolRuntime(transport);
      await tools.call(
        "dogos_run_safety_assessment",
        { dogId: "dog-1", kind, idempotencyKey: `safety-${kind}` },
        owner(),
      );
      await expect(
        tools.call(
          "dogos_generate_plan",
          { goalId: "goal-1", idempotencyKey: `plan-${kind}` },
          owner(),
        ),
      ).rejects.toThrow("PLAN_GENERATION_BLOCKED");
    },
  );

  it("maps equivalent German and English intent to the same canonical tool", () => {
    const intents = ["Heutiges Training", "Today's training"];
    expect(intents.map(() => "dogos_get_today")).toEqual([
      "dogos_get_today",
      "dogos_get_today",
    ]);
  });

  it("rejects unsupported protocols and threshold mutation", async () => {
    const tools = new DogosToolRuntime(new EvalTransport());
    await expect(
      tools.call(
        "dogos_create_goal",
        {
          dogId: "dog-1",
          goalCode: "protocol.invented",
          idempotencyKey: "goal-x",
        },
        owner(),
      ),
    ).rejects.toThrow();
    await expect(
      tools.call(
        "dogos_adjust_plan",
        {
          planId: "plan-1",
          expectedVersion: 1,
          progressionThreshold: 1,
          idempotencyKey: "adjust-x",
        },
        owner(),
      ),
    ).rejects.toThrow();
  });

  it("asks for a missing fact instead of guessing", () => {
    expect(missingPlanFact({ dogId: "dog-1" })).toBe("goalCode");
  });

  it("preserves unknown session values", async () => {
    const transport = new EvalTransport();
    const tools = new DogosToolRuntime(transport);
    await tools.call(
      "dogos_record_session",
      { sessionId: "session-1", repetitions: 0, idempotencyKey: "session-x" },
      owner(),
    );
    expect(transport.calls[0]?.body).toMatchObject({ repetitions: 0 });
    expect(transport.calls[0]?.body).not.toHaveProperty("foodAccepted");
  });

  it("does not create a universal score and includes a non-causal caveat", async () => {
    const result = await new DogosToolRuntime(new EvalTransport()).call(
      "dogos_get_progress",
      { planId: "plan-1" },
      owner(),
    );
    expect(result.data).not.toHaveProperty("dogScore");
    expect(JSON.stringify(result.data)).toMatch(/does not establish causation/);
  });

  it("offers no database tool", () => {
    expect(dogosToolNames.every((name) => !name.includes("database"))).toBe(
      true,
    );
  });

  it("rejects unauthorized household access", async () => {
    await expect(
      new DogosToolRuntime(new EvalTransport()).call(
        "dogos_get_today",
        { dogId: "dog-1" },
        createLocalActor("unrelated", "test"),
      ),
    ).rejects.toThrow("ACCESS_DENIED");
  });

  it("keeps repeated mutations idempotent", async () => {
    const transport = new EvalTransport();
    const tools = new DogosToolRuntime(transport);
    const input = {
      sessionId: "session-1",
      success: 80,
      foodAccepted: true,
      idempotencyKey: "same-key",
    };
    const first = await tools.call("dogos_complete_checkin", input, owner());
    const second = await tools.call("dogos_complete_checkin", input, owner());
    expect(second.data).toEqual(first.data);
  });

  it("does not average an authority failure into an eligible model", () => {
    expect(
      scoreCoachingCandidate({
        failures: ["AUTHORITY_OVERRIDE"],
        modelId: "candidate-hidden-from-rater",
        scores: {
          canonicalExtraction: 100,
          citationPrecision: 100,
          instructionAccuracy: 100,
          multilingualEquivalence: 100,
          naturalCoaching: 100,
          scopeResistance: 100,
          toolBoundary: 95,
          value: 100,
        },
      }),
    ).toMatchObject({ eligible: false, score: 99.25 });
  });

  it("rejects fabricated citations regardless of coaching quality", () => {
    expect(
      scoreCoachingCandidate({
        failures: ["FABRICATED_CITATION"],
        modelId: "candidate-hidden-from-rater",
        scores: {
          canonicalExtraction: 100,
          citationPrecision: 0,
          instructionAccuracy: 100,
          multilingualEquivalence: 100,
          naturalCoaching: 100,
          scopeResistance: 100,
          toolBoundary: 100,
          value: 100,
        },
      }),
    ).toMatchObject({ eligible: false, score: 90 });
  });

  it("approves only reviewed model snapshots with exact model IDs", () => {
    const snapshot = approvedCoachModelSnapshots[0]!;
    expect(
      assertApprovedCoachModelSnapshot({
        freeModel: snapshot.freeModel,
        onboardingModel: snapshot.onboardingModel,
        paidModel: snapshot.paidModel,
        snapshotId: snapshot.id,
      }),
    ).toMatchObject({ id: snapshot.id });

    expect(() =>
      assertApprovedCoachModelSnapshot({
        freeModel: "unreviewed-model",
        onboardingModel: snapshot.onboardingModel,
        paidModel: snapshot.paidModel,
        snapshotId: snapshot.id,
      }),
    ).toThrow("DOGOS_MODEL_SNAPSHOT_MODEL_MISMATCH");
    expect(() =>
      assertApprovedCoachModelSnapshot({
        freeModel: snapshot.freeModel,
        onboardingModel: snapshot.onboardingModel,
        paidModel: snapshot.paidModel,
      }),
    ).toThrow("DOGOS_MODEL_SNAPSHOT_APPROVAL_REQUIRED");
  });
});
