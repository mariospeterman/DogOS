import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CanonicalInboundMessage,
  OutboundMessage,
  WhatsAppProvider,
} from "./provider.js";

export type WhatsAppMode = "simulator" | "meta_test" | "production";

export interface MetaWhatsAppConfig {
  accessToken: string;
  allowlistedContacts: ReadonlySet<string>;
  appSecret: string;
  graphVersion: string;
  mode: Exclude<WhatsAppMode, "simulator">;
  phoneNumberId: string;
  verifyToken: string;
}

export class MetaWhatsAppError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export function loadMetaWhatsAppConfig(
  environment: NodeJS.ProcessEnv,
): MetaWhatsAppConfig | null {
  const mode = (environment.WHATSAPP_MODE ?? "simulator") as WhatsAppMode;
  if (mode === "simulator") return null;
  if (!(["meta_test", "production"] as const).includes(mode)) {
    throw new Error("WHATSAPP_MODE_INVALID");
  }
  const required = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_GRAPH_VERSION",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_VERIFY_TOKEN",
  ] as const;
  for (const name of required) {
    if (!environment[name]) throw new Error(`WHATSAPP_CONFIG_MISSING:${name}`);
  }
  const allowlistedContacts = new Set(
    (environment.WHATSAPP_TEST_ALLOWLIST ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (allowlistedContacts.size === 0) {
    throw new Error("WHATSAPP_CONFIG_MISSING:WHATSAPP_TEST_ALLOWLIST");
  }
  if (mode === "production") {
    if (environment.DOGOS_AUTH_MODE !== "supabase") {
      throw new Error("WHATSAPP_PRODUCTION_AUTH_REQUIRED");
    }
    if (environment.WHATSAPP_PRIVACY_APPROVED !== "true") {
      throw new Error("WHATSAPP_PRODUCTION_PRIVACY_REQUIRED");
    }
    throw new Error("WHATSAPP_PRODUCTION_NOT_ENABLED");
  }
  return {
    accessToken: environment.WHATSAPP_ACCESS_TOKEN!,
    allowlistedContacts,
    appSecret: environment.WHATSAPP_APP_SECRET!,
    graphVersion: environment.WHATSAPP_GRAPH_VERSION!,
    mode,
    phoneNumberId: environment.WHATSAPP_PHONE_NUMBER_ID!,
    verifyToken: environment.WHATSAPP_VERIFY_TOKEN!,
  };
}

type MetaMessage = {
  from: string;
  id: string;
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
    type: "button_reply" | "list_reply";
  };
  text?: { body: string };
  timestamp: string;
  type: string;
};

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly #seen = new Set<string>();

  constructor(
    private readonly config: MetaWhatsAppConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  verifySubscription(input: {
    challenge: string;
    mode: string;
    verifyToken: string;
  }): Promise<string | null> {
    return Promise.resolve(
      input.mode === "subscribe" &&
        input.verifyToken === this.config.verifyToken
        ? input.challenge
        : null,
    );
  }

  verifyWebhook(payload: string, signature: string): Promise<boolean> {
    const expected = `sha256=${createHmac("sha256", this.config.appSecret)
      .update(payload)
      .digest("hex")}`;
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return Promise.resolve(
      actualBuffer.length === expectedBuffer.length &&
        timingSafeEqual(actualBuffer, expectedBuffer),
    );
  }

  async parseInbound(payload: string): Promise<CanonicalInboundMessage[]> {
    const parsed = JSON.parse(payload) as {
      entry?: Array<{
        changes?: Array<{ value?: { messages?: MetaMessage[] } }>;
      }>;
    };
    const result: CanonicalInboundMessage[] = [];
    for (const entry of parsed.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          if (this.#seen.has(message.id)) continue;
          this.#seen.add(message.id);
          if (!this.config.allowlistedContacts.has(message.from)) continue;
          if (message.type === "text" && message.text !== undefined) {
            result.push(this.canonical(message, "text", message.text.body));
          } else if (
            message.type === "interactive" &&
            message.interactive !== undefined
          ) {
            const reply =
              message.interactive.button_reply ??
              message.interactive.list_reply;
            if (reply !== undefined) {
              result.push(
                this.canonical(
                  message,
                  message.interactive.type === "button_reply"
                    ? "button"
                    : "list",
                  reply.id,
                ),
              );
            }
          }
        }
      }
    }
    return result;
  }

  sendText(contactId: string, text: string): Promise<OutboundMessage> {
    return this.send(contactId, "text", text, [], {
      type: "text",
      text: { body: text },
    });
  }

  sendInteractive(
    contactId: string,
    text: string,
    options: string[],
  ): Promise<OutboundMessage> {
    if (options.length < 1 || options.length > 3) {
      throw new Error("WHATSAPP_BUTTON_COUNT_INVALID");
    }
    return this.send(contactId, "interactive", text, options, {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: options.map((title, index) => ({
            type: "reply",
            reply: { id: `choice.${index + 1}`, title: title.slice(0, 20) },
          })),
        },
      },
    });
  }

  sendTemplate(contactId: string, template: string): Promise<OutboundMessage> {
    return this.send(contactId, "template", template, [], {
      type: "template",
      template: { name: template, language: { code: "en" } },
    });
  }

  sendMedia(
    contactId: string,
    mediaUrl: string,
    caption: string,
  ): Promise<OutboundMessage> {
    return this.send(contactId, "media", caption, [], {
      type: "image",
      image: { link: mediaUrl, caption },
    });
  }

  private canonical(
    message: MetaMessage,
    kind: CanonicalInboundMessage["kind"],
    text: string,
  ): CanonicalInboundMessage {
    return {
      id: message.id,
      contactId: message.from,
      kind,
      text,
      receivedAt: new Date(Number(message.timestamp) * 1000).toISOString(),
    };
  }

  private async send(
    contactId: string,
    kind: OutboundMessage["kind"],
    text: string,
    options: string[],
    message: Record<string, unknown>,
  ): Promise<OutboundMessage> {
    if (!this.config.allowlistedContacts.has(contactId)) {
      throw new MetaWhatsAppError("WHATSAPP_CONTACT_NOT_ALLOWED", false);
    }
    const response = await this.fetcher(
      `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: contactId,
          ...message,
        }),
      },
    );
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      throw new MetaWhatsAppError(
        response.status === 429
          ? "WHATSAPP_RATE_LIMITED"
          : "WHATSAPP_PROVIDER_ERROR",
        response.status === 429 || response.status >= 500,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    const body = (await response.json()) as {
      messages?: Array<{ id: string }>;
    };
    const id = body.messages?.[0]?.id;
    if (id === undefined)
      throw new MetaWhatsAppError("WHATSAPP_RESPONSE_INVALID", false);
    return { id, contactId, kind, text, options, state: "sent" };
  }
}
