import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  CanonicalInboundMessage,
  DeliveryState,
  OutboundMessage,
  WhatsAppProvider,
} from "./provider.js";

export class LocalWhatsAppSimulator implements WhatsAppProvider {
  readonly #seen = new Set<string>();
  readonly #history: Array<CanonicalInboundMessage | OutboundMessage> = [];

  constructor(private readonly webhookSecret: string) {}

  verifySubscription(input: {
    challenge: string;
    mode: string;
    verifyToken: string;
  }): Promise<string | null> {
    return Promise.resolve(
      input.mode === "subscribe" && input.verifyToken === this.webhookSecret
        ? input.challenge
        : null,
    );
  }

  sign(payload: string): string {
    return createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  async parseInbound(payload: string): Promise<CanonicalInboundMessage[]> {
    const parsed = JSON.parse(payload) as {
      messages?: CanonicalInboundMessage[];
    };
    const messages = parsed.messages ?? [];
    const fresh = messages.filter((message) => {
      if (this.#seen.has(message.id)) return false;
      this.#seen.add(message.id);
      return true;
    });
    this.#history.push(...structuredClone(fresh));
    return fresh;
  }

  parseDeliveryStatuses(): Promise<[]> {
    return Promise.resolve([]);
  }

  sendText(contactId: string, text: string): Promise<OutboundMessage> {
    return this.outbound(contactId, "text", text, []);
  }

  sendInteractive(
    contactId: string,
    text: string,
    options: string[],
  ): Promise<OutboundMessage> {
    return this.outbound(contactId, "interactive", text, options);
  }

  sendTemplate(contactId: string, template: string): Promise<OutboundMessage> {
    return this.outbound(contactId, "template", template, []);
  }

  sendMedia(
    contactId: string,
    mediaUrl: string,
    caption: string,
  ): Promise<OutboundMessage> {
    return this.outbound(contactId, "media", `${caption} (${mediaUrl})`, []);
  }

  updateDelivery(id: string, state: DeliveryState): void {
    const message = this.#history.find(
      (entry): entry is OutboundMessage => "state" in entry && entry.id === id,
    );
    if (message !== undefined) message.state = state;
  }

  history(): ReadonlyArray<CanonicalInboundMessage | OutboundMessage> {
    return structuredClone(this.#history);
  }

  reset(): void {
    this.#seen.clear();
    this.#history.splice(0);
  }

  private outbound(
    contactId: string,
    kind: OutboundMessage["kind"],
    text: string,
    options: string[],
  ): Promise<OutboundMessage> {
    const message: OutboundMessage = {
      id: randomUUID(),
      contactId,
      kind,
      text,
      options,
      state: "sent",
    };
    this.#history.push(message);
    return Promise.resolve(structuredClone(message));
  }
}
