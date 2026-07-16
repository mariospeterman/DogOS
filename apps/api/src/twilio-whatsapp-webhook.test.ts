import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryWhatsAppStateStore,
  TwilioSandboxWhatsAppProvider,
  WhatsAppWebhookService,
  parseTwilioForm,
  type TwilioMessageSender,
  type TwilioSandboxWhatsAppConfig,
} from "@dogos/whatsapp";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const contact = "whatsapp:+41790000000";
const inboundWebhookUrl = "https://pilot.example/webhooks/whatsapp/twilio";
const statusCallbackUrl =
  "https://pilot.example/webhooks/whatsapp/twilio/status";
const authToken = "1".repeat(32);
const config: TwilioSandboxWhatsAppConfig = {
  accountSid: `AC${"0".repeat(32)}`,
  allowlistedContacts: new Set([contact]),
  authToken,
  from: "whatsapp:+14155238886",
  inboundWebhookUrl,
  mode: "twilio_sandbox",
  statusCallbackUrl,
};

const sign = (url: string, payload: string) => {
  const params = parseTwilioForm(payload);
  const data = Object.keys(params)
    .sort()
    .reduce((value, key) => `${value}${key}${String(params[key])}`, url);
  return createHmac("sha1", authToken).update(data).digest("base64");
};

describe("Twilio WhatsApp webhooks", () => {
  it("accepts a signed inbound request once and rejects tampering", async () => {
    const messages = {
      create: vi.fn<TwilioMessageSender["create"]>().mockResolvedValue({
        sid: `SM${"8".repeat(32)}`,
        status: "queued",
      }),
    };
    const provider = new TwilioSandboxWhatsAppProvider(config, messages);
    const store = new InMemoryWhatsAppStateStore();
    const service = new WhatsAppWebhookService(
      provider,
      store,
      "http://127.0.0.1:3000/app/account/link",
    );
    const app = buildApp({
      twilio: { inboundWebhookUrl, service, statusCallbackUrl },
      whatsapp: service,
    });
    apps.push(app);
    const payload = new URLSearchParams({
      Body: "hello",
      From: contact,
      MessageSid: `SM${"1".repeat(32)}`,
      NumMedia: "0",
      To: config.from,
    }).toString();
    const request = () =>
      app.inject({
        method: "POST",
        url: "/webhooks/whatsapp/twilio",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": sign(inboundWebhookUrl, payload),
        },
        payload,
      });
    const first = await request();
    expect(first.statusCode).toBe(200);
    expect(first.headers["content-type"]).toContain("text/xml");
    expect(messages.create).toHaveBeenCalledTimes(1);
    expect((await request()).statusCode).toBe(200);
    expect(messages.create).toHaveBeenCalledTimes(1);
    const invalid = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp/twilio",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "tampered",
      },
      payload,
    });
    expect(invalid.statusCode).toBe(403);
  }, 10_000);

  it("validates and persists outbound delivery status", async () => {
    const messages = {
      create: vi.fn<TwilioMessageSender["create"]>().mockResolvedValue({
        sid: `SM${"9".repeat(32)}`,
        status: "queued",
      }),
    };
    const provider = new TwilioSandboxWhatsAppProvider(config, messages);
    const store = new InMemoryWhatsAppStateStore();
    const service = new WhatsAppWebhookService(
      provider,
      store,
      "http://127.0.0.1:3000/app/account/link",
    );
    const outbound = await provider.sendText(contact, "hello");
    await store.saveOutbound(outbound);
    const app = buildApp({
      twilio: { inboundWebhookUrl, service, statusCallbackUrl },
      whatsapp: service,
    });
    apps.push(app);
    const payload = new URLSearchParams({
      MessageSid: outbound.id,
      MessageStatus: "delivered",
    }).toString();
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/whatsapp/twilio/status",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": sign(statusCallbackUrl, payload),
      },
      payload,
    });
    expect(response.statusCode).toBe(204);
    expect(store.outbound.get(outbound.id)?.state).toBe("delivered");
  });
});
