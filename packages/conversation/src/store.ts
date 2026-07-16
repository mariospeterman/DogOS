import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";

import type {
  CoachChannel,
  CoachContextKind,
  CoachConversation,
  CoachMessage,
} from "./types.js";

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
}

export interface AppendCoachMessageInput {
  actorUserId: string | null;
  channel: CoachChannel;
  clientMessageId?: string;
  content: string;
  contextKind?: CoachContextKind;
  contextSubjectId?: string;
  conversationId: string;
  providerMessageId?: string;
  role: "user" | "assistant";
  traceId: string;
}

export interface CoachConversationStore {
  ensure(input: {
    channel: CoachChannel;
    dogId: string;
    externalBindingId?: string;
    householdId: string;
    locale: "de-CH" | "en";
  }): Promise<CoachConversation>;
  append(input: AppendCoachMessageInput): Promise<CoachMessage>;
  get(conversationId: string): Promise<CoachConversation>;
  setLocale(conversationId: string, locale: "de-CH" | "en"): Promise<void>;
}

export class InMemoryCoachConversationStore implements CoachConversationStore {
  readonly #conversations = new Map<string, CoachConversation>();

  ensure(input: {
    channel: CoachChannel;
    dogId: string;
    externalBindingId?: string;
    householdId: string;
    locale: "de-CH" | "en";
  }): Promise<CoachConversation> {
    const existing = [...this.#conversations.values()].find(
      (item) =>
        item.dogId === input.dogId && item.householdId === input.householdId,
    );
    if (existing !== undefined)
      return Promise.resolve(structuredClone(existing));
    const conversation: CoachConversation = {
      id: randomUUID(),
      dogId: input.dogId,
      householdId: input.householdId,
      locale: input.locale,
      messages: [],
    };
    this.#conversations.set(conversation.id, conversation);
    return Promise.resolve(structuredClone(conversation));
  }

  append(input: AppendCoachMessageInput): Promise<CoachMessage> {
    const conversation = this.#conversations.get(input.conversationId);
    if (conversation === undefined)
      throw new Error("COACH_CONVERSATION_NOT_FOUND");
    const duplicate = conversation.messages.find(
      (message) =>
        (input.clientMessageId !== undefined &&
          message.id === `${input.channel}:client:${input.clientMessageId}`) ||
        (input.providerMessageId !== undefined &&
          message.id ===
            `${input.channel}:provider:${input.providerMessageId}`),
    );
    if (duplicate !== undefined)
      return Promise.resolve(structuredClone(duplicate));
    const message: CoachMessage = {
      id:
        input.clientMessageId !== undefined
          ? `${input.channel}:client:${input.clientMessageId}`
          : input.providerMessageId !== undefined
            ? `${input.channel}:provider:${input.providerMessageId}`
            : randomUUID(),
      role: input.role,
      channel: input.channel,
      content: input.content,
      contextKind: input.contextKind ?? null,
      contextSubjectId: input.contextSubjectId ?? null,
      createdAt: new Date().toISOString(),
    };
    conversation.messages.push(message);
    return Promise.resolve(structuredClone(message));
  }

  get(conversationId: string): Promise<CoachConversation> {
    const conversation = this.#conversations.get(conversationId);
    if (conversation === undefined)
      throw new Error("COACH_CONVERSATION_NOT_FOUND");
    return Promise.resolve(structuredClone(conversation));
  }

  setLocale(conversationId: string, locale: "de-CH" | "en"): Promise<void> {
    const conversation = this.#conversations.get(conversationId);
    if (conversation === undefined)
      throw new Error("COACH_CONVERSATION_NOT_FOUND");
    conversation.locale = locale;
    return Promise.resolve();
  }
}

interface ConversationRow {
  id: string;
  dog_id: string;
  household_id: string;
  active_locale: "de-CH" | "en";
}

interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  channel: CoachChannel | "system";
  content: string;
  context_kind: CoachContextKind | null;
  context_subject_id: string | null;
  created_at: string;
}

export class PostgresCoachConversationStore implements CoachConversationStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 6, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async ensure(input: {
    channel: CoachChannel;
    dogId: string;
    externalBindingId?: string;
    householdId: string;
    locale: "de-CH" | "en";
  }): Promise<CoachConversation> {
    const row = await this.#sql.begin(async (transaction) => {
      const sql = transaction as unknown as TransactionQuery;
      const conversations = (await sql`
        insert into private.coach_conversations (
          household_id, dog_id, active_locale
        ) values (
          ${input.householdId}::uuid, ${input.dogId}::uuid, ${input.locale}::api.locale_tag
        )
        on conflict (household_id, dog_id) do update
          set updated_at = now()
        returning id::text, dog_id::text, household_id::text, active_locale::text
      `) as unknown as Array<ConversationRow>;
      const conversation = conversations[0]!;
      await sql`
        insert into private.coach_channel_bindings (
          conversation_id, channel, external_binding_id
        ) values (
          ${conversation.id}::uuid,
          ${input.channel},
          ${input.externalBindingId ?? null}
        )
        on conflict (conversation_id, channel, external_binding_id)
        do update set status = 'active', last_seen_at = now(), updated_at = now()
      `;
      return conversation;
    });
    return this.load(row);
  }

  async append(input: AppendCoachMessageInput): Promise<CoachMessage> {
    const rows = await this.#sql<Array<MessageRow>>`
      insert into private.coach_messages (
        conversation_id, role, channel, content, actor_user_id,
        client_message_id, provider_message_id, context_kind,
        context_subject_id, trace_id
      ) values (
        ${input.conversationId}::uuid,
        ${input.role},
        ${input.channel},
        ${input.content},
        ${input.actorUserId}::uuid,
        ${input.clientMessageId ?? null},
        ${input.providerMessageId ?? null},
        ${input.contextKind ?? null},
        ${input.contextSubjectId ?? null}::uuid,
        ${input.traceId}
      )
      on conflict do nothing
      returning id::text, role, channel, content, context_kind,
        context_subject_id::text, created_at::text
    `;
    let row = rows[0];
    if (row === undefined) {
      const existing = await this.#sql<Array<MessageRow>>`
        select id::text, role, channel, content, context_kind,
          context_subject_id::text, created_at::text
        from private.coach_messages
        where conversation_id = ${input.conversationId}::uuid
          and channel = ${input.channel}
          and (
            (${input.clientMessageId ?? null}::text is not null and client_message_id = ${input.clientMessageId ?? null})
            or (${input.providerMessageId ?? null}::text is not null and provider_message_id = ${input.providerMessageId ?? null})
          )
        limit 1
      `;
      row = existing[0];
    }
    if (row === undefined) throw new Error("COACH_MESSAGE_PERSIST_FAILED");
    await this.#sql`
      update private.coach_conversations
      set last_message_at = ${row.created_at}::timestamptz, updated_at = now()
      where id = ${input.conversationId}::uuid
    `;
    return mapMessage(row);
  }

  async get(conversationId: string): Promise<CoachConversation> {
    const rows = await this.#sql<Array<ConversationRow>>`
      select id::text, dog_id::text, household_id::text, active_locale::text
      from private.coach_conversations
      where id = ${conversationId}::uuid
    `;
    const row = rows[0];
    if (row === undefined) throw new Error("COACH_CONVERSATION_NOT_FOUND");
    return this.load(row);
  }

  async setLocale(
    conversationId: string,
    locale: "de-CH" | "en",
  ): Promise<void> {
    await this.#sql`
      update private.coach_conversations
      set active_locale = ${locale}::api.locale_tag, updated_at = now()
      where id = ${conversationId}::uuid
    `;
  }

  private async load(row: ConversationRow): Promise<CoachConversation> {
    const messages = await this.#sql<Array<MessageRow>>`
      select id::text, role, channel, content, context_kind,
        context_subject_id::text, created_at::text
      from private.coach_messages
      where conversation_id = ${row.id}::uuid
      order by created_at, id
      limit 200
    `;
    return {
      id: row.id,
      dogId: row.dog_id,
      householdId: row.household_id,
      locale: row.active_locale,
      messages: messages.map(mapMessage),
    };
  }
}

function mapMessage(row: MessageRow): CoachMessage {
  return {
    id: row.id,
    role: row.role,
    channel: row.channel,
    content: row.content,
    contextKind: row.context_kind,
    contextSubjectId: row.context_subject_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
