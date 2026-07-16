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
});
