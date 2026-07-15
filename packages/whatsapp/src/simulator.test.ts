import { describe, expect, it } from "vitest";

import { ConversationMachine } from "./machine.js";
import { LocalWhatsAppSimulator } from "./simulator.js";

describe("local WhatsApp simulator", () => {
  it("verifies signatures and deduplicates webhook delivery", async () => {
    const simulator = new LocalWhatsAppSimulator("test-secret");
    const payload = JSON.stringify({
      messages: [
        {
          id: "message-1",
          contactId: "owner-1",
          kind: "voice_transcript",
          text: "simulated transcript",
          receivedAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    });
    expect(
      await simulator.verifyWebhook(payload, simulator.sign(payload)),
    ).toBe(true);
    expect(await simulator.verifyWebhook(payload, "invalid")).toBe(false);
    await expect(
      simulator.verifySubscription({
        challenge: "challenge",
        mode: "subscribe",
        verifyToken: "test-secret",
      }),
    ).resolves.toBe("challenge");
    expect(await simulator.parseInbound(payload)).toHaveLength(1);
    expect(await simulator.parseInbound(payload)).toHaveLength(0);
  });

  it("renders all outbound modes and delivery states", async () => {
    const simulator = new LocalWhatsAppSimulator("test-secret");
    const interactive = await simulator.sendInteractive("owner-1", "Choose", [
      "A",
      "B",
    ]);
    await simulator.sendText("owner-1", "Hello");
    await simulator.sendTemplate("owner-1", "welcome");
    await simulator.sendMedia(
      "owner-1",
      "local://placeholder",
      "Photo placeholder",
    );
    simulator.updateDelivery(interactive.id, "read");

    expect(simulator.history()).toHaveLength(4);
    expect(simulator.history()[0]).toMatchObject({
      state: "read",
      options: ["A", "B"],
    });
  });
});

describe("conversation machine", () => {
  it("switches presentation language without changing answers or Swiss context", () => {
    const machine = new ConversationMachine("de-CH");
    machine.answer("answer.continue");
    machine.answer("answer.acknowledged");
    const before = machine.view();
    const after = machine.switchLocale("en");

    expect(after.answers).toEqual(before.answers);
    expect(after.state).toBe(before.state);
    expect(after).toMatchObject({
      country: "CH",
      currency: "CHF",
      timezone: "Europe/Zurich",
    });
    expect(after.prompt).toMatch(/English/);
  });

  it("resumes saved state and fails closed into professional escalation", () => {
    const machine = new ConversationMachine("en");
    machine.answer("answer.continue");
    const saved = machine.view();
    const resumed = new ConversationMachine();
    resumed.resume(saved);

    expect(resumed.view().answers).toEqual(saved.answers);
    expect(resumed.escalate().state).toBe("professional_escalation");
  });
});
