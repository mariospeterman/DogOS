import { describe, expect, it, vi } from "vitest";
import type { StoredOnboardingSession } from "@dogos/database";
import { WebOnboardingService } from "./web-onboarding-service.js";

class MemorySessions {
  session: StoredOnboardingSession | null = null;

  async load() {
    return this.session;
  }

  async save(input: {
    expectedVersion: number | null;
    householdId: string;
    ownerUserId: string;
    state: unknown;
  }) {
    if (
      input.expectedVersion !== this.session?.version &&
      this.session !== null
    )
      throw new Error("ONBOARDING_SESSION_STALE");
    const version = (this.session?.version ?? 0) + 1;
    this.session = {
      householdId: input.householdId,
      ownerUserId: input.ownerUserId,
      state: input.state,
      version,
    };
    return version;
  }
}

const actor = {
  actorUserId: "10000000-0000-4000-8000-000000000001",
  householdId: "20000000-0000-4000-8000-000000000001",
  locale: "en" as const,
};

describe("WebOnboardingService", () => {
  it("converges concurrent first loads on one durable session", async () => {
    const sessions = new MemorySessions();
    const service = new WebOnboardingService({
      projector: { projectOwner: vi.fn() },
      sessions,
    });
    const [first, second] = await Promise.all([
      service.get(actor),
      service.get(actor),
    ]);
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(first.snapshot.state).toBe("dog_identity");
    expect(second.snapshot.state).toBe("dog_identity");
  });

  it("persists a natural intake and projects the canonical product once", async () => {
    const sessions = new MemorySessions();
    const projectOwner = vi.fn(async () => ({
      baselineSuccessRate: 50,
      dogId: "30000000-0000-4000-8000-000000000001",
      dogName: "Echo",
      goal: "goal.recall",
      latestDecision: "repeat_step",
      planId: "40000000-0000-4000-8000-000000000001",
      planStatus: "active" as const,
      riskDisposition: "continue_low_risk_training" as const,
      sessionCount: 0,
      todaySessionId: null,
    }));
    const activateConversation = vi.fn(async () => undefined);
    const service = new WebOnboardingService({
      activateConversation,
      interpret: async () => ({
        acknowledgement: "Echo has a solid training foundation.",
        answers: {
          baseline_collection: "baseline_collection.choice.2",
          behavior_concern: "behavior_concern.choice.2",
          dog_history: "dog_history.choice.2",
          dog_identity: "dog_identity.text:Echo",
          goal_selection: "goal_selection.choice.2",
          health_screen: "health_screen.choice.1",
          household_context: "household_context.choice.1",
          safety_screen: "safety_screen.choice.1",
          training_setup: "training_setup.choice.1",
        },
        locale: "en",
        notes: {
          dog_profile_summary: "Adult Belgian Malinois with prior training",
          goal_description: "Return on one cue around moderate distraction",
        },
      }),
      projector: { projectOwner },
      sessions,
    });

    const initial = await service.get(actor);
    expect(initial.messages).toHaveLength(1);
    expect(initial.snapshot.state).toBe("dog_identity");

    const completed = await service.send({
      ...actor,
      clientMessageId: "message-1",
      text: "Echo is my adult Malinois. Recall works half the time.",
    });
    expect(completed.productReady).toBe(true);
    expect(completed.dogId).toBe("30000000-0000-4000-8000-000000000001");
    expect(completed.messages.at(-1)?.content).toMatch(/plan is ready/i);
    expect(projectOwner).toHaveBeenCalledOnce();
    expect(activateConversation).toHaveBeenCalledOnce();
    expect(activateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        dogId: "30000000-0000-4000-8000-000000000001",
        locale: "en",
      }),
    );

    const replay = await service.send({
      ...actor,
      clientMessageId: "message-1",
      text: "Echo is my adult Malinois. Recall works half the time.",
    });
    expect(replay.messages).toHaveLength(completed.messages.length);
    expect(projectOwner).toHaveBeenCalledOnce();
    expect(activateConversation).toHaveBeenCalledOnce();
  });

  it("keeps the conversation usable when model extraction is unavailable", async () => {
    const sessions = new MemorySessions();
    const service = new WebOnboardingService({
      interpret: async () => {
        throw new Error("MODEL_TIMEOUT");
      },
      projector: { projectOwner: vi.fn() },
      sessions,
    });
    await service.get(actor);
    const result = await service.send({
      ...actor,
      clientMessageId: "message-2",
      text: "My dog's name is Echo, an adult dog working on recall.",
    });
    expect(result.snapshot.answers).toMatchObject({
      behavior_concern: "behavior_concern.choice.2",
      dog_history: "dog_history.choice.2",
      dog_identity: "dog_identity.text:Echo",
      goal_selection: "goal_selection.choice.2",
    });
    expect(result.productReady).toBe(false);
  });
});
