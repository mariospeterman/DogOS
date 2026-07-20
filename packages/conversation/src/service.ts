import type { DogOSDataPart } from "@dogos/contracts";
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
import { planCoachTurn } from "./turn-planner.js";

export type CoachServiceTier = "freemium" | "plus" | "pro" | "ultra";
export const maxCoachReplyCharacters = 3_600;
const forbiddenOwnerVisibleClaim =
  /\b(diagnos(?:e|is)|anxiety disorder|trauma|pain|aggression|biometric|face recognition|medical emergency|medizinische diagnose|schmerzdiagnose|aggressionsdiagnose)\b/i;

function validationPendingAcknowledgement(input: {
  dogName?: string;
  locale: "de-CH" | "en";
}): string {
  const name = input.dogName?.trim() || "deines Hundes";
  if (input.locale === "de-CH") {
    return `Ich prüfe ${name}s aktuellen Plan und die letzten DogOS Daten...\n\n`;
  }
  return `I'm checking ${name}'s current plan and recent DogOS data...\n\n`;
}

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

function coachUiParts(input: {
  context: CoachTrainingContext;
  contextKind?: CoachContextKind;
  reply: CoachReply;
}): DogOSDataPart[] {
  const parts: DogOSDataPart[] = [];
  const base = (): Pick<
    DogOSDataPart,
    "actions" | "artifact" | "canonicalCode" | "evidenceRefs" | "schemaVersion"
  > => ({
    actions: [],
    artifact: null,
    canonicalCode: null,
    evidenceRefs: [],
    schemaVersion: "1.0.0",
  });
  const step = input.context.currentStep;
  const now = new Date().toISOString();
  if (input.contextKind === "plan" || input.contextKind === undefined) {
    parts.push({
      ...base(),
      accessibilityLabel: "Current DogOS training plan",
      durationMinutes: input.context.durationMinutes,
      id: "artifact-plan-current",
      state: "active",
      summary: `${input.context.goal}: ${input.context.stage}`,
      type: "data-plan",
    });
  }
  if (step !== null && step !== undefined) {
    parts.push({
      ...base(),
      accessibilityLabel: "Current micro-session",
      durationSeconds: step.durationSeconds,
      id: "artifact-session-current",
      repetitions: step.repetitions,
      state: "active",
      stepCode: step.stepCode,
      type: "data-session",
    });
  }
  if (
    input.contextKind === "progress" ||
    input.context.baselineSuccessRate !== undefined ||
    input.context.targetSuccessRate !== undefined
  ) {
    parts.push({
      ...base(),
      accessibilityLabel: "Current progress target",
      baselineSuccessRate: input.context.baselineSuccessRate ?? 0,
      id: "artifact-progress-current",
      state: "active",
      targetSuccessRate: input.context.targetSuccessRate ?? null,
      type: "data-progress",
    });
  }
  if (input.contextKind === "media") {
    parts.push({
      ...base(),
      accessibilityLabel: "Video review request",
      filename: "training-clip",
      findingsCount: 0,
      id: `artifact-video-request-${now}`,
      state: "proposed",
      status: "upload_requested",
      type: "data-video-analysis",
    });
  }
  if (
    /\b(handoff|trainer|veterinarian|vet|fachperson|tierarzt)\b/i.test(
      input.reply.text,
    )
  ) {
    parts.push({
      ...base(),
      accessibilityLabel: "Professional handoff candidate",
      disagreementCount: 0,
      evidenceCount: input.context.evidenceCount,
      handoffId: null,
      id: `artifact-handoff-preview-${now}`,
      state: "proposed",
      summary: input.reply.text.slice(0, 1_000),
      targetProfessionalType: /\b(vet|veterinarian|tierarzt)\b/i.test(
        input.reply.text,
      )
        ? "veterinary"
        : "trainer",
      type: "data-professional-handoff",
    });
  }
  return parts;
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

  clearForScope(input: { dogId: string; householdId: string }) {
    return this.store.clearForScope(input);
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
    modelEnabled?: boolean;
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
    const turnPlan = planCoachTurn({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
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
    if (this.generator !== undefined && input.modelEnabled !== false) {
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
    const uiParts = coachUiParts({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      reply,
    });
    await this.store.append({
      actorUserId: null,
      artifactRefs: uiParts.map((part) => ({
        id: part.id,
        kind: part.type,
        version: null,
      })),
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
      secondaryTags: [
        `intent:${turnPlan.primaryIntent}`,
        `risk:${turnPlan.responseRisk}`,
      ],
      role: "assistant",
      traceId: input.traceId,
      uiParts,
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
    modelEnabled?: boolean;
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
    const turnPlan = planCoachTurn({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
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

    yield validationPendingAcknowledgement({
      dogName: input.context.dogName,
      locale: deterministicReply.locale,
    });
    let text = "";
    if (this.generator?.stream !== undefined && input.modelEnabled !== false) {
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
        }
      } catch {
        text = "";
      }
    }
    if (
      text.trim().length === 0 &&
      this.generator !== undefined &&
      input.modelEnabled !== false
    ) {
      try {
        text = await this.generator.generate({
          context: input.context,
          ...(input.contextKind === undefined
            ? {}
            : { contextKind: input.contextKind }),
          draft: deterministicReply,
          message: input.message,
          tier: input.tier ?? "freemium",
          traceId: input.traceId,
        });
      } catch {
        text = "";
      }
    }

    try {
      text = validateOwnerVisibleReply({
        context: input.context,
        deterministicReply: deterministicReply.text,
        text,
      });
    } catch {
      text = deterministicReply.text;
    }

    const citedText = withCitations({
      context: input.context,
      locale: deterministicReply.locale,
      message: input.message,
      text,
    });
    yield citedText;
    const reply = { ...deterministicReply, text: citedText };
    await this.store.setLocale(conversation.id, reply.locale);
    const uiParts = coachUiParts({
      context: input.context,
      ...(input.contextKind === undefined
        ? {}
        : { contextKind: input.contextKind }),
      reply,
    });
    await this.store.append({
      actorUserId: null,
      artifactRefs: uiParts.map((part) => ({
        id: part.id,
        kind: part.type,
        version: null,
      })),
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
      secondaryTags: [
        `intent:${turnPlan.primaryIntent}`,
        `risk:${turnPlan.responseRisk}`,
      ],
      role: "assistant",
      traceId: input.traceId,
      uiParts,
    });
  }
}
