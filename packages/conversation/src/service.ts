import type {
  CoachChannel,
  CoachContextKind,
  CoachConversation,
  CoachLinks,
  CoachReply,
  CoachTrainingContext,
} from "./types.js";
import { citationBlock, composeCoachReply } from "./reply.js";
import type { CoachConversationStore } from "./store.js";

export type CoachServiceTier = "freemium" | "plus" | "pro" | "ultra";
export const maxCoachReplyCharacters = 3_600;
const forbiddenOwnerVisibleClaim =
  /\b(diagnos(?:e|is)|anxiety disorder|trauma|pain|aggression|biometric|face recognition|medical emergency|medizinische diagnose|schmerzdiagnose|aggressionsdiagnose)\b/i;

function withCitations(input: {
  context: CoachTrainingContext;
  locale: "de-CH" | "en";
  message: string;
  text: string;
}): string {
  if (/\n\n(Quellen|Sources): \[1\]/.test(input.text)) return input.text;
  return `${input.text}${citationBlock(input)}`;
}

function validateOwnerVisibleReply(input: {
  context: CoachTrainingContext;
  deterministicReply: string;
  text: string;
}): string {
  const text = input.text.trim();
  if (text.length === 0 || text.length > maxCoachReplyCharacters) {
    throw new Error("COACH_REPLY_INVALID");
  }
  if (forbiddenOwnerVisibleClaim.test(text)) {
    throw new Error("COACH_REPLY_FORBIDDEN_CLAIM");
  }
  const unsupportedProtocolChange =
    /\b(increase|raise|erhöhe|steigere).{0,40}\b(duration|minutes|minuten|repetitions|wiederholungen|threshold|schwelle)\b/i;
  const draftMentionsChange =
    /\b(increase|raise|erhöhe|steigere).{0,40}\b(duration|minutes|minuten|repetitions|wiederholungen|threshold|schwelle)\b/i.test(
      input.deterministicReply,
    );
  if (unsupportedProtocolChange.test(text) && !draftMentionsChange) {
    throw new Error("COACH_REPLY_UNSUPPORTED_PROTOCOL_CHANGE");
  }
  const currentStep = input.context.currentStep;
  if (currentStep !== null && currentStep !== undefined) {
    const duration = String(input.context.durationMinutes);
    const repetitions = String(currentStep.repetitions);
    const planLike =
      /\b(plan|training|trainingsplan|session|übung|exercise)\b/i;
    if (
      planLike.test(text) &&
      (!text.includes(duration) || !text.includes(repetitions))
    ) {
      throw new Error("COACH_REPLY_CANONICAL_FACT_MISSING");
    }
  }
  return text;
}

export interface CoachReplyGenerator {
  generate(input: {
    context: CoachTrainingContext;
    contextKind?: CoachContextKind;
    draft: CoachReply;
    message: string;
    tier: CoachServiceTier;
    traceId: string;
  }): Promise<string>;
  stream?(input: {
    context: CoachTrainingContext;
    contextKind?: CoachContextKind;
    draft: CoachReply;
    message: string;
    tier: CoachServiceTier;
    traceId: string;
  }): AsyncIterable<string>;
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

  async importHistory(input: {
    messages: Array<{
      content: string;
      id: string;
      role: "assistant" | "user";
    }>;
    scope: CoachScope;
    traceId: string;
  }): Promise<CoachConversation> {
    const conversation = await this.store.ensure({
      ...input.scope,
      channel: "web",
    });
    await this.store.setLocale(conversation.id, input.scope.locale);
    for (const historyMessage of input.messages) {
      await this.store.append({
        actorUserId:
          historyMessage.role === "user" ? input.scope.actorUserId : null,
        channel: "web",
        clientMessageId: `history:${historyMessage.id}`,
        content: historyMessage.content,
        conversationId: conversation.id,
        role: historyMessage.role,
        traceId: input.traceId,
      });
    }
    return this.store.get(conversation.id);
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
          const validated = validateOwnerVisibleReply({
            context: input.context,
            deterministicReply: deterministicReply.text,
            text: generated,
          });
          reply = {
            ...deterministicReply,
            text: withCitations({
              context: input.context,
              locale: deterministicReply.locale,
              message: input.message,
              text: validated,
            }),
          };
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

  async *sendStream(input: {
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
  }): AsyncIterable<string> {
    const conversation = await this.store.ensure({
      ...input.scope,
      channel: input.channel,
    });
    const deterministicReply = composeCoachReply({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      currentLocale: conversation.locale,
      links: input.links,
      message: input.message,
    });
    const existing = conversation.messages.find(
      (message) =>
        message.id === `${input.channel}:client:${input.clientMessageId}`,
    );
    if (existing !== undefined) {
      const existingReply = conversation.messages.find(
        (message) =>
          message.id ===
          `${input.channel}:client:reply:${input.clientMessageId}`,
      );
      if (existingReply !== undefined) {
        yield existingReply.content;
        return;
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

    let text = "";
    if (this.generator?.stream !== undefined) {
      try {
        for await (const delta of this.generator.stream({
          context: input.context,
          ...(input.contextKind === undefined
            ? {}
            : { contextKind: input.contextKind }),
          draft: deterministicReply,
          message: input.message,
          tier: input.tier ?? "freemium",
          traceId: input.traceId,
        })) {
          const next = text + delta;
          if (
            next.length > maxCoachReplyCharacters ||
            forbiddenOwnerVisibleClaim.test(next)
          ) {
            throw new Error("COACH_REPLY_TOO_LONG");
          }
          text = next;
          yield delta;
        }
      } catch {
        text = "";
      }
    }
    if (text.trim().length === 0) {
      text = deterministicReply.text;
      yield text;
    }

    try {
      text = validateOwnerVisibleReply({
        context: input.context,
        deterministicReply: deterministicReply.text,
        text,
      });
    } catch {
      text = deterministicReply.text;
      yield text;
    }

    const citedText = withCitations({
      context: input.context,
      locale: deterministicReply.locale,
      message: input.message,
      text,
    });
    if (citedText.length > text.length) {
      yield citedText.slice(text.length);
    }
    const reply = { ...deterministicReply, text: citedText };
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
  }
}
