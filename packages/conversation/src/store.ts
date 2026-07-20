import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { dogosDataPartSchema, type DogOSDataPart } from "@dogos/contracts";

import type {
  CoachChannel,
  CoachContextKind,
  CoachConversation,
  CoachMessage,
  CoachWorkspace,
} from "./types.js";

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
}

type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface AppendCoachMessageInput {
  actorUserId: string | null;
  artifactRefs?: Array<{ id: string; kind: string; version: number | null }>;
  channel: CoachChannel;
  clientMessageId?: string;
  content: string;
  contextKind?: CoachContextKind;
  contextSubjectId?: string;
  conversationId: string;
  generationStatus?: CoachMessage["generationStatus"];
  providerMessageId?: string;
  role: "user" | "assistant";
  secondaryTags?: string[];
  traceId: string;
  uiParts?: DogOSDataPart[];
  workspace?: CoachWorkspace;
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
  clearForScope(input: { dogId: string; householdId: string }): Promise<void>;
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
      artifactRefs: input.artifactRefs ?? [],
      content: input.content,
      contextKind: input.contextKind ?? null,
      contextSubjectId: input.contextSubjectId ?? null,
      createdAt: new Date().toISOString(),
      generationStatus: input.generationStatus ?? "completed",
      secondaryTags: input.secondaryTags ?? [],
      uiParts: validatedUiParts(input.uiParts ?? []),
      workspace: input.workspace ?? workspaceFromContext(input.contextKind),
    };
    conversation.messages.push(message);
    return Promise.resolve(structuredClone(message));
  }

  clearForScope(input: { dogId: string; householdId: string }): Promise<void> {
    for (const [id, conversation] of this.#conversations) {
      if (
        conversation.dogId === input.dogId &&
        conversation.householdId === input.householdId
      ) {
        this.#conversations.delete(id);
      }
    }
    return Promise.resolve();
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
  artifact_refs: unknown;
  generation_status: CoachMessage["generationStatus"];
  secondary_tags: string[];
  ui_parts: unknown;
  workspace: CoachWorkspace;
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
        context_subject_id, trace_id, workspace, secondary_tags,
        artifact_refs, ui_parts, generation_status, immutable_metadata
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
        ${input.traceId},
        ${input.workspace ?? workspaceFromContext(input.contextKind)},
        ${input.secondaryTags ?? []},
        ${this.#sql.json((input.artifactRefs ?? []) as JsonValue)},
        ${this.#sql.json(validatedUiParts(input.uiParts ?? []) as JsonValue)},
        ${input.generationStatus ?? "completed"},
        ${this.#sql.json({ traceId: input.traceId } as JsonValue)}
      )
      on conflict do nothing
      returning id::text, role, channel, content, context_kind,
        context_subject_id::text, created_at::text, workspace, secondary_tags,
        artifact_refs, ui_parts, generation_status
    `;
    let row = rows[0];
    if (row === undefined) {
      const existing = await this.#sql<Array<MessageRow>>`
        select id::text, role, channel, content, context_kind,
          context_subject_id::text, created_at::text, workspace, secondary_tags,
          artifact_refs, ui_parts, generation_status
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
    if (input.role === "user") {
      const title = chapterTitleFromContent(input.content);
      await this.#sql`
        insert into private.coach_chapters (
          conversation_id, household_id, dog_id, workspace, title, summary,
          first_message_id, latest_message_id, message_count
        )
        select
          conversation.id,
          conversation.household_id,
          conversation.dog_id,
          ${row.workspace},
          ${title},
          left(${input.content}, 1200),
          ${row.id}::uuid,
          ${row.id}::uuid,
          1
        from private.coach_conversations conversation
        where conversation.id = ${input.conversationId}::uuid
        on conflict (conversation_id, workspace, lower(title))
        do update set
          summary = left(private.coach_chapters.summary || ' ' || excluded.summary, 1200),
          latest_message_id = excluded.latest_message_id,
          message_count = private.coach_chapters.message_count + 1,
          updated_at = now()
      `;
    }
    return mapMessage(row);
  }

  async clearForScope(input: {
    dogId: string;
    householdId: string;
  }): Promise<void> {
    await this.#sql`
      delete from private.coach_conversations
      where dog_id = ${input.dogId}::uuid
        and household_id = ${input.householdId}::uuid
    `;
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
        context_subject_id::text, created_at::text, workspace, secondary_tags,
        artifact_refs, ui_parts, generation_status
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
    artifactRefs: parseArray(row.artifact_refs),
    content: row.content,
    contextKind: row.context_kind,
    contextSubjectId: row.context_subject_id,
    createdAt: new Date(row.created_at).toISOString(),
    generationStatus: row.generation_status,
    secondaryTags: row.secondary_tags ?? [],
    uiParts: validatedUiParts(parseArray(row.ui_parts)),
    workspace: row.workspace,
  };
}

function workspaceFromContext(contextKind?: CoachContextKind): CoachWorkspace {
  if (contextKind === "plan") return "plan";
  if (contextKind === "session" || contextKind === "today") return "train";
  if (contextKind === "progress") return "progress";
  if (contextKind === "media") return "media";
  return "coach";
}

function chapterTitleFromContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return "Training topic";
  const lower = normalized.toLowerCase();
  if (/video|clip|film|aufnahme/.test(lower)) return "Video review";
  if (/live|camera|kamera|stream/.test(lower)) return "Live coaching";
  if (/plan|block|übung|uebung|training/.test(lower)) return "Training plan";
  if (/fortschritt|progress|besser|trend/.test(lower)) return "Progress review";
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function parseArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function validatedUiParts(parts: unknown[]): DogOSDataPart[] {
  return parts.map((part) => dogosDataPartSchema.parse(part));
}
