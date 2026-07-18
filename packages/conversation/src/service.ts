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

export type CoachServiceTier = "freemium" | "plus" | "pro" | "ultra";
export const maxCoachReplyCharacters = 3_600;

export interface CoachReplyGenerator {
  generate(input: {
    context: CoachTrainingContext;
    contextKind?: CoachContextKind;
    draft: CoachReply;
    message: string;
    tier: CoachServiceTier;
    traceId: string;
  }): Promise<string>;
}

export interface CoachScope {
  actorUserId: string;
  dogId: string;
  householdId: string;
  locale: "de-CH" | "en";
}

export class CoachConversationService {
  constructor(
    private readonly store: CoachConversationStore,
    private readonly generator?: CoachReplyGenerator,
  ) {}

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
    tier?: CoachServiceTier;
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
    const deterministicReply = composeCoachReply({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      currentLocale: conversation.locale,
      links: input.links,
      message: input.message,
    });
    if (existing !== undefined) {
      const existingReply = conversation.messages.find(
        (message) =>
          message.id ===
          `${input.channel}:client:reply:${input.clientMessageId}`,
      );
      if (existingReply !== undefined) {
        return {
          conversation,
          reply: { ...deterministicReply, text: existingReply.content },
        };
      }
    }
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
    let reply = deterministicReply;
    if (this.generator !== undefined) {
      try {
        const generated = await this.generator.generate({
          context: input.context,
          ...(input.contextKind === undefined
            ? {}
            : { contextKind: input.contextKind }),
          draft: deterministicReply,
          message: input.message,
          tier: input.tier ?? "freemium",
          traceId: input.traceId,
        });
        if (
          generated.trim().length > 0 &&
          generated.length <= maxCoachReplyCharacters
        ) {
          reply = { ...deterministicReply, text: generated.trim() };
        }
      } catch {
        // The deterministic reply remains available when a model is unavailable.
      }
    }
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
}
