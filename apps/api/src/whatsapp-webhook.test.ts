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
    const service = new WhatsAppWebhookService(
      provider,
      store,
      "http://127.0.0.1:3000/app/account/link",
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
  });
});
