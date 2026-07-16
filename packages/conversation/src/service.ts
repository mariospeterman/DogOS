import type {
  CoachChannel,
  CoachContextKind,
  CoachConversation,
  CoachLinks,
  CoachReply,
  CoachTrainingContext,
} from "./types.js";
import { composeCoachReply } from "./reply.js";
import type { CoachConversationStore } from "./store.js";

export interface CoachScope {
  actorUserId: string;
  dogId: string;
  householdId: string;
  locale: "de-CH" | "en";
}

export class CoachConversationService {
  constructor(private readonly store: CoachConversationStore) {}

  ensure(scope: CoachScope, channel: CoachChannel = "web") {
    return this.store.ensure({ ...scope, channel });
  }

  async send(input: {
    channel: CoachChannel;
    clientMessageId: string;
    context: CoachTrainingContext;
    contextKind?: CoachContextKind;
    contextSubjectId?: string;
    links: CoachLinks;
    message: string;
    scope: CoachScope;
    traceId: string;
  }): Promise<{ conversation: CoachConversation; reply: CoachReply }> {
    const conversation = await this.store.ensure({
      ...input.scope,
      channel: input.channel,
    });
    const existing = conversation.messages.find(
      (message) =>
        message.id === `${input.channel}:client:${input.clientMessageId}`,
    );
    if (existing === undefined) {
      await this.store.append({
        actorUserId: input.scope.actorUserId,
        channel: input.channel,
        clientMessageId: input.clientMessageId,
        content: input.message,
        ...(input.contextKind === undefined
          ? {}
          : { contextKind: input.contextKind }),
        ...(input.contextSubjectId === undefined
          ? {}
          : { contextSubjectId: input.contextSubjectId }),
        conversationId: conversation.id,
        role: "user",
        traceId: input.traceId,
      });
    }
    const reply = composeCoachReply({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      currentLocale: conversation.locale,
      links: input.links,
      message: input.message,
    });
    await this.store.setLocale(conversation.id, reply.locale);
    await this.store.append({
      actorUserId: null,
      channel: input.channel,
      clientMessageId: `reply:${input.clientMessageId}`,
      content: reply.text,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      ...(input.contextSubjectId === undefined
        ? {}
        : { contextSubjectId: input.contextSubjectId }),
      conversationId: conversation.id,
      role: "assistant",
      traceId: input.traceId,
    });
    return { conversation: await this.store.get(conversation.id), reply };
  }

  async recordWhatsAppExchange(input: {
    contextKind?: CoachContextKind;
    contactId: string;
    inboundId: string;
    inboundText: string;
    outboundId: string;
    outboundText: string;
    scope: CoachScope;
    traceId: string;
  }): Promise<CoachConversation> {
    const conversation = await this.store.ensure({
      ...input.scope,
      channel: "whatsapp",
      externalBindingId: input.contactId,
    });
    await this.store.append({
      actorUserId: input.scope.actorUserId,
      channel: "whatsapp",
      content: input.inboundText,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      conversationId: conversation.id,
      providerMessageId: input.inboundId,
      role: "user",
      traceId: input.traceId,
    });
    await this.store.append({
      actorUserId: null,
      channel: "whatsapp",
      content: input.outboundText,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      conversationId: conversation.id,
      providerMessageId: input.outboundId,
      role: "assistant",
      traceId: input.traceId,
    });
    return this.store.get(conversation.id);
  }
}
