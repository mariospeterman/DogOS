import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import type {
  CanonicalInboundMessage,
  DeliveryState,
  OutboundMessage,
} from "./provider.js";

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
}

export interface ProviderContact {
  externalId: string;
  householdId: string | null;
  id: string;
  linked: boolean;
  locale: "de-CH" | "en";
  userId: string | null;
}

export interface WhatsAppStateStore {
  claimInbound(
    message: CanonicalInboundMessage,
    traceId: string,
  ): Promise<{ contact: ProviderContact; eventId: string } | null>;
  getContact(externalId: string): Promise<ProviderContact | null>;
  saveOutbound(message: OutboundMessage, traceId: string): Promise<void>;
  updateDelivery(
    providerMessageId: string,
    state: DeliveryState,
    providerTimestamp?: string,
    errorCode?: string,
  ): Promise<void>;
  issueIdentityLink(
    contactId: string,
    traceId: string,
    ttlSeconds: number,
  ): Promise<string>;
  consumeIdentityLink(
    token: string,
    userId: string,
    householdId: string,
  ): Promise<ProviderContact>;
  unlink(contactId: string): Promise<void>;
  deleteContact(contactId: string): Promise<void>;
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class InMemoryWhatsAppStateStore implements WhatsAppStateStore {
  readonly #contacts = new Map<string, ProviderContact>();
  readonly #events = new Set<string>();
  readonly #links = new Map<
    string,
    { contactId: string; expiresAt: number; used: boolean }
  >();
  readonly outbound = new Map<string, OutboundMessage>();

  claimInbound(
    message: CanonicalInboundMessage,
  ): Promise<{ contact: ProviderContact; eventId: string } | null> {
    if (this.#events.has(message.id)) return Promise.resolve(null);
    this.#events.add(message.id);
    let contact = this.#contacts.get(message.contactId);
    if (contact === undefined) {
      contact = {
        externalId: message.contactId,
        householdId: null,
        id: randomUUID(),
        linked: false,
        locale: "de-CH",
        userId: null,
      };
      this.#contacts.set(message.contactId, contact);
    }
    return Promise.resolve({
      contact: structuredClone(contact),
      eventId: randomUUID(),
    });
  }

  getContact(externalId: string): Promise<ProviderContact | null> {
    return Promise.resolve(
      structuredClone(this.#contacts.get(externalId) ?? null),
    );
  }

  saveOutbound(message: OutboundMessage): Promise<void> {
    this.outbound.set(message.id, structuredClone(message));
    return Promise.resolve();
  }

  updateDelivery(
    providerMessageId: string,
    state: DeliveryState,
  ): Promise<void> {
    const message = this.outbound.get(providerMessageId);
    if (message !== undefined) message.state = state;
    return Promise.resolve();
  }

  issueIdentityLink(
    contactId: string,
    _traceId: string,
    ttlSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    this.#links.set(hash(token), {
      contactId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      used: false,
    });
    return Promise.resolve(token);
  }

  consumeIdentityLink(
    token: string,
    userId: string,
    householdId: string,
  ): Promise<ProviderContact> {
    const link = this.#links.get(hash(token));
    if (link === undefined || link.used || link.expiresAt <= Date.now()) {
      return Promise.reject(new Error("IDENTITY_LINK_INVALID"));
    }
    const contact = [...this.#contacts.values()].find(
      (candidate) => candidate.id === link.contactId,
    );
    if (contact === undefined)
      return Promise.reject(new Error("CONTACT_NOT_FOUND"));
    link.used = true;
    contact.linked = true;
    contact.userId = userId;
    contact.householdId = householdId;
    return Promise.resolve(structuredClone(contact));
  }

  unlink(contactId: string): Promise<void> {
    const contact = [...this.#contacts.values()].find(
      (candidate) => candidate.id === contactId,
    );
    if (contact !== undefined) {
      contact.linked = false;
      contact.userId = null;
      contact.householdId = null;
    }
    return Promise.resolve();
  }

  deleteContact(contactId: string): Promise<void> {
    for (const [externalId, contact] of this.#contacts) {
      if (contact.id === contactId) this.#contacts.delete(externalId);
    }
    return Promise.resolve();
  }
}

export class PostgresWhatsAppStateStore implements WhatsAppStateStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async claimInbound(
    message: CanonicalInboundMessage,
    traceId: string,
  ): Promise<{ contact: ProviderContact; eventId: string } | null> {
    return this.#sql.begin(async (transaction) => {
      const sql = transaction as unknown as TransactionQuery;
      const [contact] = await sql`
        insert into private.whatsapp_provider_contacts
          (external_contact_id, external_contact_hash, allowlisted)
        values (${message.contactId}, ${hash(message.contactId)}, true)
        on conflict (provider, external_contact_id) do update set updated_at = now()
        returning id, external_contact_id, user_id, household_id, locale, status
      `;
      const [event] = await sql`
        insert into private.whatsapp_inbound_events
          (provider_event_id, contact_id, message_kind, message_body, received_at, trace_id)
        values (${message.id}, ${contact?.id}, ${message.kind}, ${message.text.slice(0, 2000)},
          ${message.receivedAt}, ${traceId})
        on conflict (provider_event_id) do nothing
        returning id
      `;
      if (event === undefined || contact === undefined) return null;
      return { contact: this.contact(contact), eventId: String(event.id) };
    }) as Promise<{ contact: ProviderContact; eventId: string } | null>;
  }

  async getContact(externalId: string): Promise<ProviderContact | null> {
    const [row] = await this.#sql`
      select id, external_contact_id, user_id, household_id, locale, status
      from private.whatsapp_provider_contacts where provider = 'meta_cloud'
        and external_contact_id = ${externalId}
    `;
    return row === undefined ? null : this.contact(row);
  }

  async saveOutbound(message: OutboundMessage, traceId: string): Promise<void> {
    await this.#sql`
      insert into private.whatsapp_outbound_messages
        (provider_message_id, contact_id, message_kind, message_body, delivery_state, trace_id)
      select ${message.id}, id, ${message.kind}, ${message.text.slice(0, 2000)}, ${message.state}, ${traceId}
      from private.whatsapp_provider_contacts where provider = 'meta_cloud'
        and external_contact_id = ${message.contactId}
      on conflict (provider_message_id) do nothing
    `;
  }

  async updateDelivery(
    providerMessageId: string,
    state: DeliveryState,
    providerTimestamp?: string,
    errorCode?: string,
  ): Promise<void> {
    await this.#sql.begin(async (transaction) => {
      const sql = transaction as unknown as TransactionQuery;
      await sql`
        insert into private.whatsapp_delivery_events
          (provider_message_id, delivery_state, provider_timestamp, error_code)
        values (${providerMessageId}, ${state}, ${providerTimestamp ?? null}, ${errorCode ?? null})
        on conflict do nothing
      `;
      await sql`
        update private.whatsapp_outbound_messages set delivery_state = ${state}, updated_at = now()
        where provider_message_id = ${providerMessageId}
      `;
    });
  }

  async issueIdentityLink(
    contactId: string,
    traceId: string,
    ttlSeconds: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.#sql`
      insert into private.whatsapp_identity_links
        (contact_id, token_hash, nonce, expires_at, trace_id)
      values (${contactId}, ${hash(token)}, ${randomUUID()}, now() + ${ttlSeconds} * interval '1 second', ${traceId})
    `;
    return token;
  }

  async consumeIdentityLink(
    token: string,
    userId: string,
    householdId: string,
  ): Promise<ProviderContact> {
    return this.#sql.begin(
      "isolation level serializable",
      async (transaction) => {
        const sql = transaction as unknown as TransactionQuery;
        const [link] = await sql`
        update private.whatsapp_identity_links
        set consumed_at = now(), user_id = ${userId}, household_id = ${householdId}
        where token_hash = ${hash(token)} and consumed_at is null and revoked_at is null
          and expires_at > now()
        returning contact_id
      `;
        if (link === undefined) throw new Error("IDENTITY_LINK_INVALID");
        const [contact] = await sql`
        update private.whatsapp_provider_contacts
        set status = 'linked', user_id = ${userId}, household_id = ${householdId},
          linked_at = now(), unlinked_at = null, updated_at = now()
        where id = ${link.contact_id}
        returning id, external_contact_id, user_id, household_id, locale, status
      `;
        if (contact === undefined) throw new Error("CONTACT_NOT_FOUND");
        return this.contact(contact);
      },
    ) as Promise<ProviderContact>;
  }

  async unlink(contactId: string): Promise<void> {
    await this.#sql.begin(async (transaction) => {
      const sql = transaction as unknown as TransactionQuery;
      await sql`
        update private.whatsapp_provider_contacts
        set status = 'unlinked', user_id = null, household_id = null,
          unlinked_at = now(), updated_at = now()
        where id = ${contactId}
      `;
      await sql`
        update private.whatsapp_identity_links set revoked_at = now()
        where contact_id = ${contactId} and consumed_at is null and revoked_at is null
      `;
    });
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.#sql`
      delete from private.whatsapp_provider_contacts where id = ${contactId}
    `;
  }

  private contact(row: Record<string, unknown>): ProviderContact {
    return {
      externalId: String(row.external_contact_id),
      householdId: row.household_id === null ? null : String(row.household_id),
      id: String(row.id),
      linked: row.status === "linked",
      locale: row.locale === "en" ? "en" : "de-CH",
      userId: row.user_id === null ? null : String(row.user_id),
    };
  }
}
