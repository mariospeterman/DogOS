import { randomUUID } from "node:crypto";
import type { DeliveryState, WhatsAppProvider } from "./provider.js";
import type { ProviderContact, WhatsAppStateStore } from "./state-store.js";

export class WhatsAppWebhookService {
  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly store: WhatsAppStateStore,
    private readonly accountLinkBaseUrl: string,
    private readonly onLinkedMessage?: (
      message: { contact: ProviderContact; kind: string; text: string },
      traceId: string,
    ) => Promise<void>,
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
  ): Promise<{ accepted: number }> {
    if (!(await this.provider.verifyWebhook(payload, signature))) {
      throw new Error("WHATSAPP_SIGNATURE_INVALID");
    }
    const traceId = randomUUID();
    await this.processStatuses(payload);
    const messages = await this.provider.parseInbound(payload);
    let accepted = 0;
    for (const message of messages) {
      const claimed = await this.store.claimInbound(message, traceId);
      if (claimed === null) continue;
      accepted += 1;
      if (!claimed.contact.linked) {
        const token = await this.store.issueIdentityLink(
          claimed.contact.id,
          traceId,
          900,
        );
        const outbound = await this.provider.sendText(
          message.contactId,
          `DogOS development pilot. Automated messages support training but do not diagnose. Link your account: ${this.accountLinkBaseUrl}?token=${encodeURIComponent(token)}`,
        );
        await this.store.saveOutbound(outbound, traceId);
      } else if (this.onLinkedMessage !== undefined) {
        await this.onLinkedMessage(
          { contact: claimed.contact, kind: message.kind, text: message.text },
          traceId,
        );
      }
    }
    return { accepted };
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

  private async processStatuses(payload: string): Promise<void> {
    const parsed = JSON.parse(payload) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              errors?: Array<{ code?: number }>;
              id: string;
              status: DeliveryState;
              timestamp?: string;
            }>;
          };
        }>;
      }>;
    };
    for (const entry of parsed.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          await this.store.updateDelivery(
            status.id,
            status.status,
            status.timestamp === undefined
              ? undefined
              : new Date(Number(status.timestamp) * 1000).toISOString(),
            status.errors?.[0]?.code === undefined
              ? undefined
              : String(status.errors[0].code),
          );
        }
      }
    }
  }
}
