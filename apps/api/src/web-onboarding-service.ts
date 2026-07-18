import { randomUUID } from "node:crypto";
import type { OnboardingSessionRepository } from "@dogos/database";
import {
  ConversationMachine,
  type ConversationLocale,
  type ConversationSnapshot,
  type OnboardingAnswerState,
} from "@dogos/conversation";
import type { OnboardingService } from "./onboarding-service.js";

interface OnboardingInterpretation {
  acknowledgement: string;
  answers: Partial<Record<OnboardingAnswerState, string>>;
  locale: ConversationLocale;
  notes: Record<string, string>;
}

export interface OnboardingMessage {
  content: string;
  createdAt: string;
  id: string;
  role: "assistant" | "user";
}

interface OnboardingChatState {
  messages: OnboardingMessage[];
  snapshot: ConversationSnapshot;
}

export interface WebOnboardingView extends OnboardingChatState {
  dogId: string | null;
  productReady: boolean;
  prompt: string;
  version: number;
}

export interface WebOnboardingDependencies {
  activateConversation?: (input: {
    actorUserId: string;
    dogId: string;
    householdId: string;
    locale: ConversationLocale;
    messages: OnboardingMessage[];
  }) => Promise<void>;
  interpret?: (input: {
    message: string;
    snapshot: ConversationSnapshot;
  }) => Promise<OnboardingInterpretation>;
  projector: Pick<OnboardingService, "projectOwner">;
  sessions: Pick<OnboardingSessionRepository, "load" | "save">;
}

function initialState(locale: ConversationLocale): OnboardingChatState {
  const machine = new ConversationMachine(locale);
  machine.answer("welcome.choice.1");
  const view = machine.answer("ai_disclosure.choice.1");
  const greeting =
    locale === "de-CH"
      ? "Hoi, ich bin dein DogOS Coach. Erzaehl mir von deinem Hund und was ihr konkret verbessern wollt. Ich fasse nach, bis daraus ein messbarer Trainingsplan entsteht."
      : "Hi, I am your DogOS coach. Tell me about your dog and what you want to improve. I will ask only what is needed to build a measurable training plan.";
  return {
    messages: [message("assistant", greeting)],
    snapshot: snapshotOf(view),
  };
}

function message(role: OnboardingMessage["role"], content: string) {
  return {
    content,
    createdAt: new Date().toISOString(),
    id: randomUUID(),
    role,
  };
}

function snapshotOf(
  view: ConversationSnapshot & { prompt: string },
): ConversationSnapshot {
  return {
    answers: view.answers,
    audit: view.audit,
    country: view.country,
    currency: view.currency,
    locale: view.locale,
    ...(view.notes === undefined ? {} : { notes: view.notes }),
    state: view.state,
    timezone: view.timezone,
  };
}

function parseStoredState(value: unknown): OnboardingChatState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<OnboardingChatState>;
  if (!Array.isArray(candidate.messages) || candidate.snapshot === undefined) {
    return null;
  }
  const snapshot = candidate.snapshot;
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !Array.isArray((snapshot as ConversationSnapshot).audit) ||
    typeof (snapshot as ConversationSnapshot).state !== "string"
  ) {
    return null;
  }
  return candidate as OnboardingChatState;
}

function fallbackInterpretation(
  text: string,
  snapshot: ConversationSnapshot,
): OnboardingInterpretation {
  const locale: ConversationLocale = /\b(the|and|with|dog|years?|old)\b/i.test(
    text,
  )
    ? "en"
    : snapshot.locale;
  const answers: Partial<Record<OnboardingAnswerState, string>> = {};
  if (snapshot.state === "dog_identity") {
    const match = text.match(
      /(?:name is|called|heisst|heißt|rufname ist)\s+([\p{L}][\p{L}' -]{0,39})/iu,
    );
    if (match?.[1])
      answers.dog_identity = `dog_identity.text:${match[1].trim()}`;
  }
  if (/\b(puppy|welpe)\b/i.test(text))
    answers.dog_history = "dog_history.choice.1";
  if (/\b(adult|erwachsen|years? old|jahre? alt)\b/i.test(text))
    answers.dog_history = "dog_history.choice.2";
  if (/\b(senior|old dog|alter hund)\b/i.test(text))
    answers.dog_history = "dog_history.choice.3";
  if (/\b(recall|rueckruf|rückruf|come when called)\b/i.test(text)) {
    answers.behavior_concern = "behavior_concern.choice.2";
    answers.goal_selection = "goal_selection.choice.2";
  } else if (/\b(leash|leine|pull|zieht)\b/i.test(text)) {
    answers.behavior_concern = "behavior_concern.choice.1";
    answers.goal_selection = "goal_selection.choice.1";
  } else if (/\b(encounter|begegnung|react|ruhig)\b/i.test(text)) {
    answers.behavior_concern = "behavior_concern.choice.3";
    answers.goal_selection = "goal_selection.choice.3";
  }
  if (/\b(rarely|selten|almost never|kaum)\b/i.test(text))
    answers.baseline_collection = "baseline_collection.choice.1";
  if (/\b(half|haelfte|hälfte|50)\b/i.test(text))
    answers.baseline_collection = "baseline_collection.choice.2";
  if (/\b(usually|meistens|80)\b/i.test(text))
    answers.baseline_collection = "baseline_collection.choice.3";
  if (/\b(only me|nur ich|alone|alleine)\b/i.test(text))
    answers.household_context = "household_context.choice.1";
  if (/\b(others|family|partner|andere|familie)\b/i.test(text))
    answers.household_context = "household_context.choice.2";
  if (
    /\b(no pain|keine schmerzen|no sudden|keine veraenderung|keine veränderung)\b/i.test(
      text,
    )
  )
    answers.health_screen = "health_screen.choice.1";
  if (
    /\b(pain|limp|schmerz|humpel|sudden change|ploetzlich|plötzlich)\b/i.test(
      text,
    )
  )
    answers.health_screen = "health_screen.choice.2";
  if (/\b(no bite|never bit|kein biss|nie gebissen|no snapping)\b/i.test(text))
    answers.safety_screen = "safety_screen.choice.1";
  if (/\b(snap|schnapp)\b/i.test(text))
    answers.safety_screen = "safety_screen.choice.2";
  if (/\b(bit a child|bite.*child|kind.*gebissen|biss.*kind)\b/i.test(text))
    answers.safety_screen = "safety_screen.choice.3";
  if (
    /\b(i have|we have|vorhanden|ja.*ausruest|ja.*ausrüst|complete setup)\b/i.test(
      text,
    )
  )
    answers.training_setup = "training_setup.choice.1";
  return {
    acknowledgement:
      locale === "de-CH"
        ? "Danke, ich habe die klar erkennbaren Angaben gespeichert."
        : "Thanks, I saved the facts that were clear.",
    answers,
    locale,
    notes: {},
  };
}

export class WebOnboardingService {
  constructor(private readonly dependencies: WebOnboardingDependencies) {}

  async get(input: {
    actorUserId: string;
    householdId: string;
    locale: ConversationLocale;
  }): Promise<WebOnboardingView> {
    let stored = await this.dependencies.sessions.load(input.actorUserId);
    let state = parseStoredState(stored?.state) ?? initialState(input.locale);
    let version = stored?.version ?? 1;
    if (stored === null) {
      try {
        version = await this.dependencies.sessions.save({
          expectedVersion: null,
          householdId: input.householdId,
          ownerUserId: input.actorUserId,
          state,
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "ONBOARDING_SESSION_STALE"
        ) {
          throw error;
        }
        stored = await this.dependencies.sessions.load(input.actorUserId);
        const concurrentState = parseStoredState(stored?.state);
        if (stored === null || concurrentState === null) throw error;
        state = concurrentState;
        version = stored.version;
      }
    }
    return this.view(state, version, null);
  }

  async send(input: {
    actorUserId: string;
    clientMessageId: string;
    householdId: string;
    locale: ConversationLocale;
    text: string;
  }): Promise<WebOnboardingView> {
    let stored = await this.dependencies.sessions.load(input.actorUserId);
    if (stored === null) {
      await this.get(input);
      stored = await this.dependencies.sessions.load(input.actorUserId);
    }
    if (stored === null) throw new Error("ONBOARDING_SESSION_MISSING");
    const state = parseStoredState(stored.state);
    if (state === null) throw new Error("ONBOARDING_SESSION_INVALID");
    if (state.messages.some((entry) => entry.id === input.clientMessageId)) {
      return this.view(state, stored.version, null);
    }

    const machine = new ConversationMachine(state.snapshot.locale);
    machine.resume(state.snapshot);
    let interpretation: OnboardingInterpretation;
    try {
      interpretation =
        (await this.dependencies.interpret?.({
          message: input.text,
          snapshot: state.snapshot,
        })) ?? fallbackInterpretation(input.text, state.snapshot);
    } catch {
      interpretation = fallbackInterpretation(input.text, state.snapshot);
    }
    if (interpretation.locale !== state.snapshot.locale) {
      machine.switchLocale(interpretation.locale);
    }
    const next = machine.recordOnboarding(interpretation);
    const userMessage = {
      ...message("user", input.text),
      id: input.clientMessageId,
    };
    let assistantText = `${interpretation.acknowledgement}\n\n${next.prompt}`;
    let dogId: string | null = null;
    if (next.state === "plan_ready") {
      const product = await this.dependencies.projector.projectOwner(
        { actorUserId: input.actorUserId, householdId: input.householdId },
        snapshotOf(next),
      );
      dogId = product.dogId;
      assistantText =
        next.locale === "de-CH"
          ? `Ich habe ${product.dogName}s Ausgangslage und Ziel gespeichert. Der erste messbare Trainingsplan ist bereit. Wir starten mit kurzen Einheiten und passen die Schwierigkeit nur anhand deiner erfassten Ergebnisse an.`
          : `I saved ${product.dogName}'s starting point and goal. The first measurable training plan is ready. We will begin with short sessions and adjust difficulty only from the results you record.`;
    }
    const updated: OnboardingChatState = {
      messages: [
        ...state.messages,
        userMessage,
        message("assistant", assistantText),
      ],
      snapshot: snapshotOf(next),
    };
    if (dogId !== null) {
      await this.dependencies.activateConversation?.({
        actorUserId: input.actorUserId,
        dogId,
        householdId: input.householdId,
        locale: next.locale,
        messages: updated.messages,
      });
    }
    const version = await this.dependencies.sessions.save({
      expectedVersion: stored.version,
      householdId: input.householdId,
      ownerUserId: input.actorUserId,
      state: updated,
    });
    return this.view(updated, version, dogId);
  }

  private view(
    state: OnboardingChatState,
    version: number,
    dogId: string | null,
  ): WebOnboardingView {
    const machine = new ConversationMachine(state.snapshot.locale);
    machine.resume(state.snapshot);
    const current = machine.view();
    return {
      ...state,
      dogId,
      productReady: state.snapshot.state === "plan_ready",
      prompt: current.prompt,
      version,
    };
  }
}
