import twilio from "twilio";
import type {
  CanonicalDeliveryEvent,
  CanonicalInboundMessage,
  DeliveryState,
  OutboundMessage,
  WebhookVerificationContext,
  WhatsAppProvider,
} from "./provider.js";

export interface TwilioSandboxWhatsAppConfig {
  accountSid: string;
  allowlistedContacts: ReadonlySet<string>;
  authToken: string;
  from: string;
  inboundWebhookUrl: string;
  mode: "twilio_sandbox";
  statusCallbackUrl: string;
}

interface TwilioMessageResult {
  sid: string;
  status: string;
}

export interface TwilioMessageSender {
  create(input: {
    body?: string;
    from: string;
    mediaUrl?: string[];
    statusCallback: string;
    to: string;
  }): Promise<TwilioMessageResult>;
}

export class TwilioWhatsAppError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
    readonly providerCode?: string,
  ) {
    super(code);
  }
}

const channelAddress = /^whatsapp:\+[1-9][0-9]{7,14}$/;

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`WHATSAPP_CONFIG_MISSING:${name}`);
  return value;
}

function publicHttpsUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`WHATSAPP_CONFIG_INVALID:${name}`);
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`WHATSAPP_CONFIG_INVALID:${name}`);
  }
  return value;
}

export function loadTwilioSandboxWhatsAppConfig(
  environment: NodeJS.ProcessEnv,
): TwilioSandboxWhatsAppConfig | null {
  if ((environment.WHATSAPP_MODE ?? "simulator") !== "twilio_sandbox") {
    return null;
  }
  const accountSid = required(environment, "TWILIO_ACCOUNT_SID");
  const authToken = required(environment, "TWILIO_AUTH_TOKEN");
  const from = required(environment, "TWILIO_WHATSAPP_FROM");
  const inboundWebhookUrl = publicHttpsUrl(
    required(environment, "TWILIO_INBOUND_WEBHOOK_URL"),
    "TWILIO_INBOUND_WEBHOOK_URL",
  );
  const statusCallbackUrl = publicHttpsUrl(
    required(environment, "TWILIO_STATUS_CALLBACK_URL"),
    "TWILIO_STATUS_CALLBACK_URL",
  );
  const allowlistedContacts = new Set(
    required(environment, "TWILIO_ALLOWED_TEST_NUMBERS")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!/^AC[0-9a-fA-F]{32}$/.test(accountSid)) {
    throw new Error("WHATSAPP_CONFIG_INVALID:TWILIO_ACCOUNT_SID");
  }
  if (authToken.length < 32) {
    throw new Error("WHATSAPP_CONFIG_INVALID:TWILIO_AUTH_TOKEN");
  }
  if (!channelAddress.test(from)) {
    throw new Error("WHATSAPP_CONFIG_INVALID:TWILIO_WHATSAPP_FROM");
  }
  if (
    allowlistedContacts.size === 0 ||
    [...allowlistedContacts].some((value) => !channelAddress.test(value))
  ) {
    throw new Error("WHATSAPP_CONFIG_INVALID:TWILIO_ALLOWED_TEST_NUMBERS");
  }
  return {
    accountSid,
    allowlistedContacts,
    authToken,
    from,
    inboundWebhookUrl,
    mode: "twilio_sandbox",
    statusCallbackUrl,
  };
}

type FormValues = Record<string, string | string[]>;

export function parseTwilioForm(payload: string): FormValues {
  const values: FormValues = {};
  for (const [key, value] of new URLSearchParams(payload)) {
    const current = values[key];
    values[key] =
      current === undefined
        ? value
        : Array.isArray(current)
          ? [...current, value]
          : [current, value];
  }
  return values;
}

function scalar(values: FormValues, key: string): string | undefined {
  const value = values[key];
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeTwilioDeliveryState(value: string): DeliveryState {
  switch (value) {
    case "accepted":
    case "scheduled":
    case "queued":
      return "queued";
    case "sending":
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "canceled":
    case "failed":
    case "undelivered":
      return "failed";
    default:
      throw new TwilioWhatsAppError(
        "WHATSAPP_DELIVERY_STATE_UNSUPPORTED",
        false,
      );
  }
}

export class TwilioSandboxWhatsAppProvider implements WhatsAppProvider {
  readonly #sender: TwilioMessageSender;

  constructor(
    private readonly config: TwilioSandboxWhatsAppConfig,
    sender?: TwilioMessageSender,
  ) {
    this.#sender =
      sender ?? twilio(config.accountSid, config.authToken).messages;
  }

  verifySubscription(): Promise<null> {
    return Promise.resolve(null);
  }

  verifyWebhook(
    payload: string,
    signature: string,
    context?: WebhookVerificationContext,
  ): Promise<boolean> {
    const url = context?.url;
    if (
      url === undefined ||
      ![this.config.inboundWebhookUrl, this.config.statusCallbackUrl].includes(
        url,
      )
    ) {
      return Promise.resolve(false);
    }
    return Promise.resolve(
      twilio.validateRequest(
        this.config.authToken,
        signature,
        url,
        parseTwilioForm(payload),
      ),
    );
  }

  parseInbound(payload: string): Promise<CanonicalInboundMessage[]> {
    const values = parseTwilioForm(payload);
    const id = scalar(values, "MessageSid") ?? scalar(values, "SmsMessageSid");
    const contactId = scalar(values, "From");
    if (
      id === undefined ||
      contactId === undefined ||
      !this.config.allowlistedContacts.has(contactId)
    ) {
      return Promise.resolve([]);
    }
    const buttonPayload = scalar(values, "ButtonPayload");
    const body = scalar(values, "Body") ?? "";
    const mediaCount = Number(scalar(values, "NumMedia") ?? "0");
    const kind: CanonicalInboundMessage["kind"] =
      buttonPayload !== undefined
        ? "button"
        : mediaCount > 0
          ? "media_placeholder"
          : "text";
    const text =
      buttonPayload ??
      (mediaCount > 0
        ? body || scalar(values, "MediaContentType0") || "media"
        : body);
    return Promise.resolve([
      {
        contactId,
        id,
        kind,
        receivedAt: new Date().toISOString(),
        text,
      },
    ]);
  }

  parseDeliveryStatuses(payload: string): Promise<CanonicalDeliveryEvent[]> {
    const values = parseTwilioForm(payload);
    const providerMessageId = scalar(values, "MessageSid");
    const status = scalar(values, "MessageStatus");
    if (providerMessageId === undefined || status === undefined) {
      return Promise.resolve([]);
    }
    const errorCode = scalar(values, "ErrorCode");
    return Promise.resolve([
      {
        providerMessageId,
        state: normalizeTwilioDeliveryState(status),
        ...(errorCode === undefined || errorCode === "" ? {} : { errorCode }),
      },
    ]);
  }

  sendText(contactId: string, text: string): Promise<OutboundMessage> {
    return this.send(contactId, "text", text, [], { body: text });
  }

  sendInteractive(
    contactId: string,
    text: string,
    options: string[],
  ): Promise<OutboundMessage> {
    if (options.length === 0) {
      throw new TwilioWhatsAppError("WHATSAPP_OPTIONS_REQUIRED", false);
    }
    const body = `${text}\n\n${options
      .map((option, index) => `${String(index + 1)}. ${option}`)
      .join("\n")}`;
    return this.send(contactId, "interactive", body, options, { body });
  }

  sendTemplate(): Promise<OutboundMessage> {
    return Promise.reject(
      new TwilioWhatsAppError("WHATSAPP_TEMPLATE_UNSUPPORTED", false),
    );
  }

  sendMedia(
    contactId: string,
    mediaUrl: string,
    caption: string,
  ): Promise<OutboundMessage> {
    return this.send(contactId, "media", caption, [], {
      ...(caption === "" ? {} : { body: caption }),
      mediaUrl: [mediaUrl],
    });
  }

  private async send(
    contactId: string,
    kind: OutboundMessage["kind"],
    text: string,
    options: string[],
    content: { body?: string; mediaUrl?: string[] },
  ): Promise<OutboundMessage> {
    if (!this.config.allowlistedContacts.has(contactId)) {
      throw new TwilioWhatsAppError("WHATSAPP_CONTACT_NOT_ALLOWED", false);
    }
    try {
      const result = await this.#sender.create({
        ...content,
        from: this.config.from,
        statusCallback: this.config.statusCallbackUrl,
        to: contactId,
      });
      return {
        contactId,
        id: result.sid,
        kind,
        options,
        state: normalizeTwilioDeliveryState(result.status),
        text,
      };
    } catch (error) {
      if (error instanceof TwilioWhatsAppError) throw error;
      const source = error as {
        code?: number | string;
        retryAfter?: number;
        status?: number;
      };
      const providerCode =
        source.code === undefined ? undefined : String(source.code);
      const rateLimited = source.status === 429 || providerCode === "20429";
      const networkFailure =
        source.status === undefined &&
        ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN"].includes(
          providerCode ?? "",
        );
      const retryable =
        rateLimited || networkFailure || (source.status ?? 0) >= 500;
      throw new TwilioWhatsAppError(
        rateLimited ? "WHATSAPP_RATE_LIMITED" : "WHATSAPP_PROVIDER_ERROR",
        retryable,
        source.retryAfter,
        providerCode,
      );
    }
  }
}
