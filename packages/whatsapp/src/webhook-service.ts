import { randomUUID } from "node:crypto";
import type {
  WebhookVerificationContext,
  WhatsAppProvider,
} from "./provider.js";
import {
  DeterministicConversationLanguageResolver,
  type ConversationLanguageResolver,
} from "./language.js";
import type { ProviderContact, WhatsAppStateStore } from "./state-store.js";

export class WhatsAppWebhookService {
  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly store: WhatsAppStateStore,
    private readonly accountLinkBaseUrl: string,
    private readonly onLinkedMessage?: (
      message: {
        contact: ProviderContact;
        id: string;
        kind: string;
        text: string;
      },
      traceId: string,
    ) => Promise<void>,
    private readonly languageResolver: ConversationLanguageResolver = new DeterministicConversationLanguageResolver(),
  ) {}

  verifySubscription(input: {
    challenge: string;
    mode: string;
    verifyToken: string;
  }): Promise<string | null> {
    return this.provider.verifySubscription(input);
  }

  async process(
    payload: string,
    signature: string,
    context?: WebhookVerificationContext,
  ): Promise<{ accepted: number }> {
    if (!(await this.provider.verifyWebhook(payload, signature, context))) {
      throw new Error("WHATSAPP_SIGNATURE_INVALID");
    }
    const traceId = randomUUID();
    await this.persistStatuses(payload);
    const messages = await this.provider.parseInbound(payload);
    let accepted = 0;
    for (const message of messages) {
      const claimed = await this.store.claimInbound(message, traceId);
      if (claimed === null) continue;
      accepted += 1;
      if (!claimed.contact.linked) {
        const language = await this.languageResolver.resolve({
          currentLocale: claimed.contact.locale,
          text: message.text,
        });
        const token = await this.store.issueIdentityLink(
          claimed.contact.id,
          traceId,
          900,
        );
        const outbound = await this.provider.sendText(
          message.contactId,
          language.locale === "de-CH"
            ? `DogOS Entwicklungspilot. Automatisierte Nachrichten unterstützen das Training, stellen aber keine Diagnose. Verknüpfe dein Konto: ${this.accountLinkBaseUrl}?token=${encodeURIComponent(token)}`
            : `DogOS development pilot. Automated messages support training but do not diagnose. Link your account: ${this.accountLinkBaseUrl}?token=${encodeURIComponent(token)}`,
        );
        await this.store.saveOutbound(outbound, traceId);
      } else if (this.onLinkedMessage !== undefined) {
        await this.onLinkedMessage(
          {
            contact: claimed.contact,
            id: message.id,
            kind: message.kind,
            text: message.text,
          },
          traceId,
        );
      }
      await this.store.markInboundProcessed(claimed.eventId);
    }
    return { accepted };
  }

  async processDeliveryStatuses(
    payload: string,
    signature: string,
    context?: WebhookVerificationContext,
  ): Promise<{ accepted: number }> {
    if (!(await this.provider.verifyWebhook(payload, signature, context))) {
      throw new Error("WHATSAPP_SIGNATURE_INVALID");
    }
    return { accepted: await this.persistStatuses(payload) };
  }

  confirmIdentity(
    token: string,
    userId: string,
    householdId: string,
  ): Promise<ProviderContact> {
    return this.store.consumeIdentityLink(token, userId, householdId);
  }

  unlink(contactId: string): Promise<void> {
    return this.store.unlink(contactId);
  }

  deleteContact(contactId: string): Promise<void> {
    return this.store.deleteContact(contactId);
  }

  private async persistStatuses(payload: string): Promise<number> {
    const statuses = await this.provider.parseDeliveryStatuses(payload);
    for (const status of statuses) {
      await this.store.updateDelivery(
        status.providerMessageId,
        status.state,
        status.providerTimestamp,
        status.errorCode,
      );
    }
    return statuses.length;
  }
}
