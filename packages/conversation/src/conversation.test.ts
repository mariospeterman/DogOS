import { describe, expect, it } from "vitest";

import { composeCoachReply, inferCoachLocale } from "./reply.js";
import { CoachConversationService } from "./service.js";
import { InMemoryCoachConversationStore } from "./store.js";

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

describe("omnichannel Coach conversation", () => {
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

  it("records web and WhatsApp in one ordered timeline", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
    );
    await service.recordWhatsAppExchange({
      contactId: "contact-1",
      inboundId: "wa-in-1",
      inboundText: "Heute",
      outboundId: "wa-out-1",
      outboundText: "Vier Minuten Orientierung.",
      scope,
      traceId: "trace-wa",
    });
    const result = await service.send({
      channel: "web",
      clientMessageId: "web-1",
      context,
      links,
      message: "Warum dieser Block?",
      scope,
      traceId: "trace-web",
    });
    expect(
      result.conversation.messages.map((message) => message.channel),
    ).toEqual(["whatsapp", "whatsapp", "web", "web"]);
  });

  it("deduplicates a retried web exchange", async () => {
    const service = new CoachConversationService(
      new InMemoryCoachConversationStore(),
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
    await service.send(input);
    const replay = await service.send(input);
    expect(replay.conversation.messages).toHaveLength(2);
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
    expect(result.reply.text).toBe("Kurzer, natürlicher Coach-Text.");
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
});
