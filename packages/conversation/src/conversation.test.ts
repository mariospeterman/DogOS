import { describe, expect, it } from "vitest";

import { composeCoachReply, inferCoachLocale } from "./reply.js";
import { CoachConversationService } from "./service.js";
import { InMemoryCoachConversationStore } from "./store.js";
import { planCoachTurn } from "./turn-planner.js";

const scope = {
  actorUserId: "10000000-0000-0000-0000-000000000001",
  dogId: "30000000-0000-0000-0000-000000000001",
  householdId: "20000000-0000-0000-0000-000000000001",
  locale: "de-CH" as const,
};
const context = {
  dogName: "Milo",
  goal: "lockere Leine",
  stage: "Orientierung unter wenig Ablenkung",
  durationMinutes: 4,
  evidenceCount: 2,
  latestDecision: "repeat_step",
};
const links = {
  today: "/app/today",
  plan: "/app/plan",
  progress: "/app/progress",
  session: "/app/session/session-1",
};

describe("DogOS Coach conversation", () => {
  it("uses natural language rather than a language selector", () => {
    expect(inferCoachLocale("What should we train today?", "de-CH")).toBe("en");
    expect(inferCoachLocale("Was trainieren wir heute?", "en")).toBe("de-CH");
  });

  it("keeps an acute advisory conversational without closing the Coach", () => {
    const reply = composeCoachReply({
      context,
      currentLocale: "de-CH",
      links,
      message: "Milo lahmt akut",
    });
    expect(reply.text).toMatch(/nicht medizinisch beurteilen/);
    expect(reply.text).toMatch(/Coach bleiben verfügbar/);
    expect(reply.text).toMatch(/Quellen: \[1\] DogOS Daten: aktueller Plan/);
    expect(reply.text).toMatch(/\[3\] DogOS Sicherheitsgrenze/);
    expect(reply.actions).toHaveLength(1);
  });

  it("renders recall instructions from the canonical plan step", () => {
    const reply = composeCoachReply({
      context: {
        ...context,
        currentStep: {
          difficulty: 1,
          durationSeconds: 240,
          repetitions: 6,
          stepCode: "step.recall_short_distance",
        },
        goal: "Zuverlässiger Rückruf bei wenig Ablenkung",
      },
      currentLocale: "de-CH",
      links,
      message: "Was jetzt?",
    });
    expect(reply.text).toMatch(/Rückrufsignal/);
    expect(reply.text).toMatch(/Schleppleine/);
    expect(reply.text).not.toMatch(/lockerer Leine/);
  });

  it("explains deterministic plan milestones without inventing a score", () => {
    const reply = composeCoachReply({
      context: {
        ...context,
        baselineSuccessRate: 50,
        requiredConsecutiveSessions: 3,
        targetSuccessRate: 80,
      },
      contextKind: "plan",
      currentLocale: "de-CH",
      links,
      message: "Erkläre den Plan",
    });
    expect(reply.text).toMatch(/50 Prozent/);
    expect(reply.text).toMatch(/80 Prozent/);
    expect(reply.text).toMatch(/3 vergleichbaren Einheiten/);
  });

  it("deduplicates a retried web exchange", async () => {
    let generations = 0;
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async () => {
          generations += 1;
          return `Generated reply ${generations}`;
        },
      },
    );
    const input = {
      channel: "web" as const,
      clientMessageId: "web-retry",
      context,
      links,
      message: "Plan erklären",
      scope,
      traceId: "trace-web",
    };
    const first = await service.send(input);
    const replay = await service.send(input);
    expect(replay.conversation.messages).toHaveLength(2);
    expect(replay.reply.text).toBe(first.reply.text);
    expect(generations).toBe(1);
  });

  it("persists validated canonical UI artifacts with assistant replies", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
    );
    const result = await service.send({
      channel: "web",
      clientMessageId: "artifact-message",
      context: {
        ...context,
        baselineSuccessRate: 50,
        currentStep: {
          difficulty: 1,
          durationSeconds: 240,
          repetitions: 6,
          stepCode: "step.low_distraction_baseline",
        },
        targetSuccessRate: 80,
      },
      contextKind: "plan",
      links,
      message: "Explain the plan",
      scope: { ...scope, locale: "en" },
      traceId: "trace-artifact-message",
    });
    const assistant = result.conversation.messages.find(
      (message) => message.role === "assistant",
    );
    expect(assistant?.uiParts.map((part) => part.type)).toEqual([
      "data-plan",
      "data-session",
      "data-progress",
    ]);
    expect(assistant?.secondaryTags).toContain("intent:explain_plan");
  });

  it("rejects invalid UI parts before they enter the durable timeline", async () => {
    const store = new InMemoryCoachConversationStore();
    const conversation = await store.ensure({ ...scope, channel: "web" });
    expect(() =>
      store.append({
        actorUserId: null,
        channel: "web",
        content: "Invalid",
        conversationId: conversation.id,
        role: "assistant",
        traceId: "trace-invalid-part",
        uiParts: [
          {
            accessibilityLabel: "Broken",
            id: "broken",
            type: "data-plan",
          },
        ] as never,
      }),
    ).toThrow();
  });

  it("plans bounded coach turns before natural response generation", () => {
    expect(
      planCoachTurn({
        context,
        message: "Can you prepare a trainer handoff with the video?",
      }),
    ).toMatchObject({
      primaryIntent: "prepare_handoff",
      proposedTools: ["dogos_get_relevant_context", "dogos_preview_handoff"],
      responseRisk: "decision_bearing",
      stepLimit: 3,
    });
    expect(
      planCoachTurn({
        context,
        message: "Milo is limping after the walk.",
      }),
    ).toMatchObject({
      primaryIntent: "ask_clarifying",
      responseRisk: "safety_sensitive",
    });
  });

  it("imports onboarding history once into the durable coach thread", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
    );
    const messages = [
      {
        content: "Tell me about Echo.",
        id: "intro",
        role: "assistant" as const,
      },
      { content: "Echo is my Malinois.", id: "answer", role: "user" as const },
    ];
    const first = await service.importHistory({
      messages,
      scope: { ...scope, locale: "en" },
      traceId: "onboarding:owner",
    });
    const replay = await service.importHistory({
      messages,
      scope: { ...scope, locale: "en" },
      traceId: "onboarding:owner",
    });
    expect(first.messages.map((entry) => entry.content)).toEqual(
      messages.map((entry) => entry.content),
    );
    expect(replay.messages).toHaveLength(2);
    expect(replay.locale).toBe("en");
  });

  it("allows bounded presentation rewriting and falls back deterministically", async () => {
    const generated = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      { generate: async () => "Kurzer, natürlicher Coach-Text." },
    );
    const result = await generated.send({
      channel: "web",
      clientMessageId: "generated",
      context,
      links,
      message: "Warum dieser Block?",
      scope,
      tier: "plus",
      traceId: "trace-generated",
    });
    expect(result.reply.text).toMatch(/^Kurzer, natürlicher Coach-Text\./);
    expect(result.reply.text).toMatch(/Quellen: \[1\]/);
    expect(result.reply.actions[0]?.href).toBe("/app/plan");

    const fallback = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async () => {
          throw new Error("provider unavailable");
        },
      },
    );
    const fallbackResult = await fallback.send({
      channel: "web",
      clientMessageId: "fallback",
      context,
      links,
      message: "Warum dieser Block?",
      scope,
      traceId: "trace-fallback",
    });
    expect(fallbackResult.reply.text).toMatch(/arbeitet gerade/);
  });

  it("streams only a harmless acknowledgement before validated coach text", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async () => "unused",
        stream: async function* () {
          yield "Streaming ";
          yield "answer.";
        },
      },
    );
    const chunks = [];
    for await (const chunk of service.sendStream({
      channel: "web",
      clientMessageId: "streamed",
      context,
      links,
      message: "Why this block?",
      scope,
      traceId: "trace-streamed",
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0]).toMatch(/checking Milo's current plan/);
    expect(chunks[0]).not.toMatch(/Streaming answer/);
    expect(chunks.join("")).toMatch(/Streaming answer\./);
    expect(chunks.join("")).toMatch(/Sources: \[1\] DogOS data: current plan/);
  });

  it("does not persist unsafe streamed claims as canonical coach output", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async () => "unused",
        stream: async function* () {
          yield "This is a pain diagnosis.";
        },
      },
    );
    const chunks = [];
    for await (const chunk of service.sendStream({
      channel: "web",
      clientMessageId: "unsafe-stream",
      context,
      links,
      message: "What do you see?",
      scope,
      traceId: "trace-unsafe-stream",
    })) {
      chunks.push(chunk);
    }
    const conversation = await service.ensure(scope);
    const assistant = conversation.messages.find(
      (message) => message.role === "assistant",
    );
    expect(assistant?.content).not.toMatch(/pain diagnosis/i);
    expect(chunks.join("")).not.toMatch(/pain diagnosis/i);
  });
});
