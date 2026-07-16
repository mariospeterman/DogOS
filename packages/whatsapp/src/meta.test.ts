import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  loadMetaWhatsAppConfig,
  MetaCloudWhatsAppProvider,
  type MetaWhatsAppConfig,
} from "./meta.js";
import { InMemoryWhatsAppStateStore } from "./state-store.js";
import { WhatsAppWebhookService } from "./webhook-service.js";

const contact = "41790000000";
const config: MetaWhatsAppConfig = {
  accessToken: "test-token",
  allowlistedContacts: new Set([contact]),
  appSecret: "app-secret",
  graphVersion: "v24.0",
  mode: "meta_test",
  phoneNumberId: "phone-number-id",
  verifyToken: "verify-token",
};

const payload = (message: object) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      { changes: [{ field: "messages", value: { messages: [message] } }] },
    ],
  });

const textPayload = payload({
  from: contact,
  id: "wamid.inbound-1",
  timestamp: "1784145600",
  type: "text",
  text: { body: "hello" },
});

const signature = (body: string) =>
  `sha256=${createHmac("sha256", config.appSecret).update(body).digest("hex")}`;

describe("Meta Cloud WhatsApp adapter", () => {
  it("fails closed for incomplete or production development configuration", () => {
    expect(() =>
      loadMetaWhatsAppConfig({ WHATSAPP_MODE: "meta_test" }),
    ).toThrow("WHATSAPP_CONFIG_MISSING");
    expect(() =>
      loadMetaWhatsAppConfig({
        WHATSAPP_MODE: "production",
        WHATSAPP_ACCESS_TOKEN: "x",
        WHATSAPP_APP_SECRET: "x",
        WHATSAPP_GRAPH_VERSION: "v24.0",
        WHATSAPP_PHONE_NUMBER_ID: "x",
        WHATSAPP_VERIFY_TOKEN: "x",
        WHATSAPP_TEST_ALLOWLIST: contact,
      }),
    ).toThrow("WHATSAPP_PRODUCTION_AUTH_REQUIRED");
    expect(() =>
      loadMetaWhatsAppConfig({
        WHATSAPP_MODE: "production",
        WHATSAPP_ACCESS_TOKEN: "x",
        WHATSAPP_APP_SECRET: "x",
        WHATSAPP_GRAPH_VERSION: "v24.0",
        WHATSAPP_PHONE_NUMBER_ID: "x",
        WHATSAPP_VERIFY_TOKEN: "x",
        WHATSAPP_TEST_ALLOWLIST: contact,
        DOGOS_AUTH_MODE: "supabase",
        WHATSAPP_PRIVACY_APPROVED: "true",
      }),
    ).toThrow("WHATSAPP_PRODUCTION_NOT_ENABLED");
  });

  it("verifies subscription and raw payload signatures", async () => {
    const provider = new MetaCloudWhatsAppProvider(config);
    await expect(
      provider.verifySubscription({
        challenge: "123",
        mode: "subscribe",
        verifyToken: "verify-token",
      }),
    ).resolves.toBe("123");
    await expect(
      provider.verifyWebhook(textPayload, signature(textPayload)),
    ).resolves.toBe(true);
    await expect(
      provider.verifyWebhook(textPayload, "sha256=invalid"),
    ).resolves.toBe(false);
  });

  it("parses text and interactive replies and deduplicates messages", async () => {
    const provider = new MetaCloudWhatsAppProvider(config);
    await expect(provider.parseInbound(textPayload)).resolves.toMatchObject([
      {
        id: "wamid.inbound-1",
        contactId: contact,
        kind: "text",
        text: "hello",
      },
    ]);
    await expect(provider.parseInbound(textPayload)).resolves.toEqual([]);
    const interactive = payload({
      from: contact,
      id: "wamid.inbound-2",
      timestamp: "1784145601",
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: "language.en", title: "English" },
      },
    });
    await expect(provider.parseInbound(interactive)).resolves.toMatchObject([
      { kind: "button", text: "language.en" },
    ]);
  });

  it("sends direct Graph API messages without exposing the token in output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.outbound-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await new MetaCloudWhatsAppProvider(
      config,
      fetcher,
    ).sendInteractive(contact, "Choose", ["Deutsch", "English"]);
    expect(result).toMatchObject({ id: "wamid.outbound-1", state: "sent" });
    const [url, request] = fetcher.mock.calls[0]!;
    expect(String(url)).toContain(
      "graph.facebook.com/v24.0/phone-number-id/messages",
    );
    expect(request?.headers).toMatchObject({
      authorization: "Bearer test-token",
    });
    expect(JSON.stringify(result)).not.toContain("test-token");
  });

  it("normalizes rate limits as retryable", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("{}", { status: 429, headers: { "retry-after": "30" } }),
      );
    const promise = new MetaCloudWhatsAppProvider(config, fetcher).sendText(
      contact,
      "hello",
    );
    await expect(promise).rejects.toMatchObject({
      code: "WHATSAPP_RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 30,
    });
  });
});

describe("WhatsApp webhook and identity linking", () => {
  it("processes a duplicate once, links explicitly, and revokes on unlink", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.link" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new MetaCloudWhatsAppProvider(config, fetcher);
    const store = new InMemoryWhatsAppStateStore();
    const service = new WhatsAppWebhookService(
      provider,
      store,
      "http://localhost:3000/app/account/link",
    );
    await expect(
      service.process(textPayload, signature(textPayload)),
    ).resolves.toEqual({ accepted: 1 });
    await expect(
      service.process(textPayload, signature(textPayload)),
    ).resolves.toEqual({ accepted: 0 });
    expect(store.processedEvents).toHaveLength(1);
    const sentBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      text: { body: string };
    };
    const token = new URL(
      sentBody.text.body.split("Link your account: ")[1]!,
    ).searchParams.get("token")!;
    const provisional = await store.getContact(contact);
    const linked = await service.confirmIdentity(
      token,
      "10000000-0000-0000-0000-000000000001",
      "20000000-0000-0000-0000-000000000001",
    );
    expect(linked.linked).toBe(true);
    await service.unlink(provisional!.id);
    await expect(store.getContact(contact)).resolves.toMatchObject({
      linked: false,
      userId: null,
    });
  });
});
