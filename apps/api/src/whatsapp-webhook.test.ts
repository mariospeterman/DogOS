import {
  InMemoryWhatsAppStateStore,
  LocalWhatsAppSimulator,
  WhatsAppWebhookService,
} from "@dogos/whatsapp";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe("WhatsApp webhook routes", () => {
  it("verifies subscriptions, rejects signatures, deduplicates, and links identity", async () => {
    const provider = new LocalWhatsAppSimulator("webhook-secret");
    const store = new InMemoryWhatsAppStateStore();
    let linkedMessages = 0;
    const service = new WhatsAppWebhookService(
      provider,
      store,
      "http://127.0.0.1:3000/app/account/link",
      async () => {
        linkedMessages += 1;
      },
    );
    const app = buildApp({ whatsapp: service });
    apps.push(app);

    const verification = await app.inject({
      method: "GET",
      url: "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=webhook-secret&hub.challenge=12345",
    });
    expect(verification.statusCode).toBe(200);
    expect(verification.body).toBe("12345");

    const body = JSON.stringify({
      messages: [
        {
          id: "message-1",
          contactId: "41790000000",
          kind: "text",
          text: "hello",
          receivedAt: "2026-07-15T12:00:00.000Z",
        },
      ],
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "invalid",
      },
      payload: body,
    });
    expect(invalid.statusCode).toBe(401);

    const request = {
      method: "POST" as const,
      url: "/webhooks/whatsapp",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": provider.sign(body),
      },
      payload: body,
    };
    expect((await app.inject(request)).statusCode).toBe(200);
    expect((await app.inject(request)).statusCode).toBe(200);
    expect(provider.history()).toHaveLength(2);

    const outbound = provider.history()[1];
    expect(outbound).toHaveProperty("text");
    const text = (outbound as { text: string }).text;
    const token = new URL(
      text.split("Link your account: ")[1]!,
    ).searchParams.get("token")!;
    const linked = await app.inject({
      method: "POST",
      url: "/v1/whatsapp/link/confirm",
      headers: { "content-type": "application/json", "x-dogos-user": "owner" },
      payload: { token },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json()).toMatchObject({ linked: true });
    const linkedBody = JSON.stringify({
      messages: [
        {
          id: "message-2",
          contactId: "41790000000",
          kind: "button",
          text: "choice.1",
          receivedAt: "2026-07-15T12:01:00.000Z",
        },
      ],
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": provider.sign(linkedBody),
          },
          payload: linkedBody,
        })
      ).statusCode,
    ).toBe(200);
    expect(linkedMessages).toBe(1);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/whatsapp/link/confirm",
          headers: {
            "content-type": "application/json",
            "x-dogos-user": "owner",
          },
          payload: { token },
        })
      ).statusCode,
    ).toBe(400);

    const germanBody = JSON.stringify({
      messages: [
        {
          id: "message-3",
          contactId: "41790000001",
          kind: "text",
          text: "Hoi, mein Hund braucht Training",
          receivedAt: "2026-07-15T12:02:00.000Z",
        },
      ],
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/whatsapp",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": provider.sign(germanBody),
          },
          payload: germanBody,
        })
      ).statusCode,
    ).toBe(200);
    expect(provider.history().at(-1)?.text).toMatch(/Verknüpfe dein Konto/);
  });
});
