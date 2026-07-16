import { describe, expect, it, vi } from "vitest";
import twilio from "twilio";
import {
  loadTwilioSandboxWhatsAppConfig,
  normalizeTwilioDeliveryState,
  parseTwilioForm,
  TwilioSandboxWhatsAppProvider,
  type TwilioMessageSender,
  type TwilioSandboxWhatsAppConfig,
} from "./twilio.js";

const contact = "whatsapp:+41790000000";
const inboundWebhookUrl = "https://pilot.example/webhooks/whatsapp/twilio";
const statusCallbackUrl =
  "https://pilot.example/webhooks/whatsapp/twilio/status";
const config: TwilioSandboxWhatsAppConfig = {
  accountSid: `AC${"0".repeat(32)}`,
  allowlistedContacts: new Set([contact]),
  authToken: "1".repeat(32),
  from: "whatsapp:+14155238886",
  inboundWebhookUrl,
  mode: "twilio_sandbox",
  statusCallbackUrl,
};

const form = (values: Record<string, string>) =>
  new URLSearchParams(values).toString();

const signature = (url: string, payload: string) =>
  twilio.getExpectedTwilioSignature(
    config.authToken,
    url,
    parseTwilioForm(payload),
  );

const sender = (status = "queued") => ({
  create: vi.fn<TwilioMessageSender["create"]>().mockResolvedValue({
    sid: `SM${"2".repeat(32)}`,
    status,
  }),
});

describe("Twilio WhatsApp Sandbox configuration", () => {
  it("loads a complete sandbox configuration without exposing secrets", () => {
    const loaded = loadTwilioSandboxWhatsAppConfig({
      WHATSAPP_MODE: "twilio_sandbox",
      TWILIO_ACCOUNT_SID: config.accountSid,
      TWILIO_AUTH_TOKEN: config.authToken,
      TWILIO_WHATSAPP_FROM: config.from,
      TWILIO_INBOUND_WEBHOOK_URL: inboundWebhookUrl,
      TWILIO_STATUS_CALLBACK_URL: statusCallbackUrl,
      TWILIO_ALLOWED_TEST_NUMBERS: `${contact}, whatsapp:+491701234567`,
    });
    expect(loaded).toMatchObject({
      mode: "twilio_sandbox",
      from: config.from,
      inboundWebhookUrl,
      statusCallbackUrl,
    });
    expect(loaded?.allowlistedContacts.size).toBe(2);
  });

  it("fails closed for missing, malformed, or non-HTTPS settings", () => {
    expect(() =>
      loadTwilioSandboxWhatsAppConfig({
        WHATSAPP_MODE: "twilio_sandbox",
      }),
    ).toThrow("WHATSAPP_CONFIG_MISSING:TWILIO_ACCOUNT_SID");
    expect(() =>
      loadTwilioSandboxWhatsAppConfig({
        WHATSAPP_MODE: "twilio_sandbox",
        TWILIO_ACCOUNT_SID: config.accountSid,
        TWILIO_AUTH_TOKEN: config.authToken,
        TWILIO_WHATSAPP_FROM: config.from,
        TWILIO_INBOUND_WEBHOOK_URL: "http://localhost/webhooks/whatsapp/twilio",
        TWILIO_STATUS_CALLBACK_URL: statusCallbackUrl,
        TWILIO_ALLOWED_TEST_NUMBERS: contact,
      }),
    ).toThrow("WHATSAPP_CONFIG_INVALID:TWILIO_INBOUND_WEBHOOK_URL");
  });
});

describe("Twilio WhatsApp Sandbox provider", () => {
  it("validates signatures against the exact configured URL", async () => {
    const provider = new TwilioSandboxWhatsAppProvider(config, sender());
    const payload = form({
      Body: "hello",
      From: contact,
      MessageSid: `SM${"1".repeat(32)}`,
    });
    await expect(
      provider.verifyWebhook(payload, signature(inboundWebhookUrl, payload), {
        url: inboundWebhookUrl,
      }),
    ).resolves.toBe(true);
    await expect(
      provider.verifyWebhook(payload, "tampered", { url: inboundWebhookUrl }),
    ).resolves.toBe(false);
    await expect(
      provider.verifyWebhook(payload, signature(inboundWebhookUrl, payload), {
        url: "https://attacker.example/webhooks/whatsapp/twilio",
      }),
    ).resolves.toBe(false);
  });

  it("normalizes text, buttons, and media without owning durable deduplication", async () => {
    const provider = new TwilioSandboxWhatsAppProvider(config, sender());
    const textPayload = form({
      Body: "hello",
      From: contact,
      MessageSid: `SM${"1".repeat(32)}`,
      NumMedia: "0",
    });
    await expect(provider.parseInbound(textPayload)).resolves.toMatchObject([
      { contactId: contact, kind: "text", text: "hello" },
    ]);
    await expect(provider.parseInbound(textPayload)).resolves.toHaveLength(1);
    await expect(
      provider.parseInbound(
        form({
          Body: "English",
          ButtonPayload: "language.en",
          From: contact,
          MessageSid: `SM${"2".repeat(32)}`,
        }),
      ),
    ).resolves.toMatchObject([{ kind: "button", text: "language.en" }]);
    await expect(
      provider.parseInbound(
        form({
          From: contact,
          MediaContentType0: "image/jpeg",
          MessageSid: `SM${"3".repeat(32)}`,
          NumMedia: "1",
        }),
      ),
    ).resolves.toMatchObject([
      { kind: "media_placeholder", text: "image/jpeg" },
    ]);
  });

  it("drops non-allowlisted contacts and sends allowlisted text via the SDK", async () => {
    const messages = sender();
    const provider = new TwilioSandboxWhatsAppProvider(config, messages);
    await expect(
      provider.parseInbound(
        form({
          Body: "hello",
          From: "whatsapp:+491111111111",
          MessageSid: `SM${"4".repeat(32)}`,
        }),
      ),
    ).resolves.toEqual([]);
    await expect(provider.sendText(contact, "hello")).resolves.toMatchObject({
      contactId: contact,
      kind: "text",
      state: "queued",
    });
    expect(messages.create).toHaveBeenCalledWith({
      body: "hello",
      from: config.from,
      statusCallback: statusCallbackUrl,
      to: contact,
    });
    await expect(
      provider.sendText("whatsapp:+491111111111", "hello"),
    ).rejects.toMatchObject({
      code: "WHATSAPP_CONTACT_NOT_ALLOWED",
      retryable: false,
    });
  });

  it("normalizes delivery states and retryable provider errors", async () => {
    expect(normalizeTwilioDeliveryState("accepted")).toBe("queued");
    expect(normalizeTwilioDeliveryState("undelivered")).toBe("failed");
    const messages = {
      create: vi
        .fn<TwilioMessageSender["create"]>()
        .mockRejectedValue({ code: 20429, status: 429, retryAfter: 12 }),
    };
    await expect(
      new TwilioSandboxWhatsAppProvider(config, messages).sendText(
        contact,
        "hello",
      ),
    ).rejects.toMatchObject({
      code: "WHATSAPP_RATE_LIMITED",
      providerCode: "20429",
      retryable: true,
      retryAfterSeconds: 12,
    });
    const networkFailure = {
      create: vi
        .fn<TwilioMessageSender["create"]>()
        .mockRejectedValue({ code: "ETIMEDOUT" }),
    };
    await expect(
      new TwilioSandboxWhatsAppProvider(config, networkFailure).sendText(
        contact,
        "hello",
      ),
    ).rejects.toMatchObject({
      code: "WHATSAPP_PROVIDER_ERROR",
      retryable: true,
    });
  });

  it("normalizes delivery callbacks without inventing timestamps", async () => {
    const provider = new TwilioSandboxWhatsAppProvider(config, sender());
    await expect(
      provider.parseDeliveryStatuses(
        form({
          ErrorCode: "63015",
          MessageSid: `SM${"5".repeat(32)}`,
          MessageStatus: "undelivered",
        }),
      ),
    ).resolves.toEqual([
      {
        errorCode: "63015",
        providerMessageId: `SM${"5".repeat(32)}`,
        state: "failed",
      },
    ]);
  });
});
