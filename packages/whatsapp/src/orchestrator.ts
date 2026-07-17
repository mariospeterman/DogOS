import type { SubscriptionTier, TierCapabilities } from "@dogos/contracts";
import {
  composeCoachReply,
  maxCoachReplyCharacters,
  type CoachReply,
  type CoachTrainingContext,
} from "@dogos/conversation";

import {
  ConversationMachine,
  onboardingAnswerStates,
  type OnboardingAnswerState,
  type ConversationSnapshot,
  type ConversationState,
} from "./machine.js";
import {
  DeterministicConversationLanguageResolver,
  type ConversationLanguageResolver,
} from "./language.js";
import type { OutboundMessage, WhatsAppProvider } from "./provider.js";
import type { ProviderContact, WhatsAppStateStore } from "./state-store.js";

const options: Record<ConversationState, Record<"de-CH" | "en", string[]>> = {
  welcome: { "de-CH": ["Los geht's"], en: ["Start"] },
  ai_disclosure: {
    "de-CH": ["Verstanden"],
    en: ["Understood"],
  },
  locale_confirmation: { "de-CH": [], en: [] },
  household_context: {
    "de-CH": ["Nur ich", "Mehrere Personen"],
    en: ["Only me", "Several people"],
  },
  dog_identity: { "de-CH": [], en: [] },
  dog_history: {
    "de-CH": ["Unter 1 Jahr", "1-7 Jahre", "Über 7 Jahre"],
    en: ["Under 1 year", "1-7 years", "Over 7 years"],
  },
  health_screen: {
    "de-CH": ["Nein", "Akute Veränderung"],
    en: ["No", "Acute change"],
  },
  safety_screen: {
    "de-CH": ["Nein", "Schnappen", "Biss / Kind"],
    en: ["No", "Snap", "Bite / child"],
  },
  behavior_concern: {
    "de-CH": ["Leinenführung", "Rückruf", "Begegnungen"],
    en: ["Loose leash", "Recall", "Encounters"],
  },
  goal_selection: {
    "de-CH": ["Lockere Leine", "Rückruf", "Ruhige Begegnung"],
    en: ["Loose leash", "Recall", "Calm encounters"],
  },
  training_setup: {
    "de-CH": ["Ja, vollständig", "Noch nicht"],
    en: ["Yes, complete", "Not yet"],
  },
  baseline_collection: {
    "de-CH": ["Selten", "Etwa zur Hälfte", "Meistens"],
    en: ["Rarely", "About half", "Usually"],
  },
  plan_ready: {
    "de-CH": ["Heute", "Plan", "Fortschritt"],
    en: ["Today", "Plan", "Progress"],
  },
  daily_session: { "de-CH": ["Start", "Später"], en: ["Start", "Later"] },
  checkin: {
    "de-CH": ["Gut", "Schwer", "Abgebrochen"],
    en: ["Good", "Hard", "Stopped"],
  },
  progress_review: { "de-CH": ["Plan öffnen"], en: ["Open plan"] },
  adjustment: { "de-CH": ["Verstanden"], en: ["Understood"] },
  professional_escalation: { "de-CH": [], en: [] },
};

const offTopicPattern =
  /ignore (all|previous)|system prompt|developer message|jailbreak|write (code|an essay)|politics|investment|homework/i;
const acutePattern = /schmerz|pain|lahm|limp|plötzlich|sudden|akut|acute/i;
const meteredStates = new Set<ConversationState>([
  "plan_ready",
  "daily_session",
  "checkin",
  "progress_review",
  "adjustment",
  "professional_escalation",
]);

export interface ConversationLinks {
  account?: string;
  plan: string;
  progress: string;
  referral: string;
  today: string;
}

export interface ConversationProductContext {
  baselineSuccessRate?: number;
  behaviorConcernDescription?: string;
  targetSuccessRate?: number;
  requiredConsecutiveSessions?: number;
  calendar?: Array<{
    durationSeconds: number;
    isRecovery: boolean;
    plannedStart: string;
    purposeCode: string;
    status: string;
  }>;
  currentStep?: {
    difficulty: number;
    durationSeconds: number;
    repetitions: number;
    stepCode: string;
  } | null;
  dogId: string;
  dogName: string;
  dogProfileSummary?: string;
  goal: string;
  goalText?: string;
  latestDecision: string;
  planId: string | null;
  planStatus: "active" | "blocked" | "setup_required";
  sessionCount: number;
  todaySessionId: string | null;
}

export interface WhatsAppConversationDependencies {
  languageResolver?: ConversationLanguageResolver;
  links: (contact: ProviderContact) => Promise<ConversationLinks>;
  productContext?: (
    contact: ProviderContact,
  ) => Promise<ConversationProductContext | null>;
  projectOnboarding?: (
    contact: ProviderContact,
    snapshot: ConversationSnapshot,
  ) => Promise<ConversationProductContext>;
  interpretOnboarding?: (input: {
    contact: ProviderContact;
    message: string;
    snapshot: ConversationSnapshot;
  }) => Promise<{
    acknowledgement: string;
    answers: Partial<Record<OnboardingAnswerState, string>>;
    locale: "de-CH" | "en";
    notes: Record<string, string>;
  }>;
  rewriteCoachReply?: (input: {
    contact: ProviderContact;
    context: CoachTrainingContext;
    contextKind: "plan";
    draft: CoachReply;
    message: string;
  }) => Promise<string>;
  provider: WhatsAppProvider;
  store: WhatsAppStateStore;
  capabilitiesForContact?: (
    contact: ProviderContact,
  ) => Promise<Pick<TierCapabilities, "coachingMessagesPerDay">>;
  consumeCoachingMessage?: (
    contact: ProviderContact,
    limit: number,
  ) => Promise<boolean>;
  tierForContact?: (contact: ProviderContact) => Promise<SubscriptionTier>;
}

export class WhatsAppConversationOrchestrator {
  readonly #languageResolver: ConversationLanguageResolver;

  constructor(private readonly dependencies: WhatsAppConversationDependencies) {
    this.#languageResolver =
      dependencies.languageResolver ??
      new DeterministicConversationLanguageResolver();
  }

  async handle(
    contact: ProviderContact,
    text: string,
  ): Promise<OutboundMessage> {
    const saved = await this.dependencies.store.loadConversation(contact.id);
    const machine = new ConversationMachine(saved?.locale ?? contact.locale);
    if (saved !== null) machine.resume(saved);
    const beforeResolution = machine.view();
    const resolution = await this.#languageResolver.resolve({
      currentLocale: beforeResolution.locale,
      text,
    });
    if (resolution.locale !== beforeResolution.locale) {
      machine.switchLocale(resolution.locale);
    }

    if (beforeResolution.state === "locale_confirmation") {
      if (text === "choice.2") {
        machine.switchLocale(
          beforeResolution.locale === "de-CH" ? "en" : "de-CH",
        );
      }
      machine.skipLegacyLocaleConfirmation();
      await this.persist(contact.id, machine.view());
      return this.present(contact.externalId, machine.view());
    }

    const current = machine.view();
    const locale = current.locale;
    const localeChanged = locale !== beforeResolution.locale;
    if (meteredStates.has(current.state)) {
      const capabilities =
        await this.dependencies.capabilitiesForContact?.(contact);
      const messageLimit = capabilities?.coachingMessagesPerDay ?? 12;
      const allowed =
        (await this.dependencies.consumeCoachingMessage?.(
          contact,
          messageLimit,
        )) ??
        (await this.dependencies.store.consumeDailyMessage(
          contact.id,
          messageLimit,
        ));
      if (!allowed) {
        if (localeChanged) await this.persist(contact.id, current);
        return this.dependencies.provider.sendText(
          contact.externalId,
          locale === "de-CH"
            ? "Dein heutiges Nachrichtenkontingent ist aufgebraucht. Plan, Verlauf und heutige Einheit bleiben in DogOS verfügbar. Unter Konto kannst du einen Tarif mit mehr Coaching-Nachrichten wählen."
            : "Today's message allowance is used. Your plan, history, and today's session remain available in DogOS. You can choose a tier with more coaching messages under Account.",
        );
      }
    }

    if (resolution.source === "explicit_request") {
      await this.persist(contact.id, current);
      return this.present(contact.externalId, current);
    }

    if (offTopicPattern.test(text)) {
      if (localeChanged) await this.persist(contact.id, current);
      return this.dependencies.provider.sendText(
        contact.externalId,
        locale === "de-CH"
          ? "Ich bleibe bei deinem Hund: Training, Beobachtungen, Plan und Fortschritt. Was davon brauchst du?"
          : "I stay focused on your dog: training, observations, plan, and progress. Which do you need?",
      );
    }

    if (
      onboardingAnswerStates.includes(current.state as OnboardingAnswerState) &&
      this.dependencies.interpretOnboarding !== undefined
    ) {
      try {
        const interpretation = await this.dependencies.interpretOnboarding({
          contact,
          message: text,
          snapshot: snapshotOf(current),
        });
        if (interpretation.locale !== current.locale) {
          machine.switchLocale(interpretation.locale);
        }
        let next = machine.recordOnboarding(interpretation);
        if (
          next.state === "plan_ready" &&
          this.dependencies.projectOnboarding !== undefined
        ) {
          const context = await this.dependencies.projectOnboarding(
            contact,
            snapshotOf(next),
          );
          if (context.planStatus === "blocked") {
            machine.escalate();
            next = machine.view();
          } else if (context.planStatus === "setup_required") {
            await this.persist(contact.id, next);
            return this.presentSetupRequired(contact.externalId, next.locale);
          }
        }
        await this.persist(contact.id, next);
        if (next.state === "plan_ready") {
          return this.presentPlan(
            contact,
            next.locale === "de-CH"
              ? "Erkläre mir den neuen Trainingsplan mit Ziel, Etappen und Fortschrittslogik."
              : "Explain the new training plan, milestones, and progression logic.",
            next.locale,
            true,
          );
        }
        const advisory = onboardingAdvisory(
          interpretation.answers,
          next.locale,
        );
        return this.present(
          contact.externalId,
          next,
          [interpretation.acknowledgement, advisory].filter(Boolean).join(" "),
        );
      } catch {
        // The deterministic state-specific parser remains available on timeout,
        // refusal, or invalid structured extraction.
      }
    }

    if (current.state === "plan_ready") {
      return this.presentPlan(contact, text, current.locale);
    }

    if (current.state === "professional_escalation") {
      const context = await this.dependencies.productContext?.(contact);
      if (
        context?.planStatus === "setup_required" &&
        this.dependencies.projectOnboarding !== undefined
      ) {
        const repaired = await this.dependencies.projectOnboarding(
          contact,
          snapshotOf(current),
        );
        if (repaired.planStatus === "active") {
          const recovered = machine.recoverPlanReady();
          await this.persist(contact.id, recovered);
          return this.presentPlan(contact, text, recovered.locale);
        }
      }
      return this.presentEscalation(contact, text, current.locale);
    }

    if (
      (current.state === "health_screen" &&
        (acutePattern.test(text) || text === "choice.2")) ||
      (current.state === "safety_screen" && text === "choice.3")
    ) {
      const injury = current.state === "health_screen";
      machine.answer(normalizeAnswer(current.state, text));
      const next = machine.view();
      await this.persist(contact.id, next);
      return this.dependencies.provider.sendInteractive(
        contact.externalId,
        current.locale === "de-CH"
          ? injury
            ? `Diese akute Veränderung kann DogOS nicht beurteilen. Eine tierärztliche Abklärung ist sinnvoll; das ist keine Diagnose. Ich erfasse den restlichen Kontext weiter.\n\n${next.prompt}`
            : `Bei einem Biss mit Kind empfiehlt DogOS eine qualifizierte Fachperson. Das ist keine Diagnose; ich erfasse den Fall weiter und zeige danach die passenden nächsten Schritte.\n\n${next.prompt}`
          : injury
            ? `DogOS cannot assess this acute change. Veterinary assessment is appropriate; this is not a diagnosis. I will continue collecting the remaining context.\n\n${next.prompt}`
            : `After a bite involving a child, DogOS recommends a qualified professional. This is not a diagnosis; I will finish recording the case and then show appropriate next steps.\n\n${next.prompt}`,
        options[next.state][next.locale],
      );
    }

    if (current.state === "dog_identity" && !isUsableName(text)) {
      return this.dependencies.provider.sendText(
        contact.externalId,
        current.locale === "de-CH"
          ? "Wie heisst dein Hund? Antworte nur mit dem Rufnamen."
          : "What is your dog's name? Reply with the call name only.",
      );
    }

    const canonicalAnswer = normalizeAnswer(current.state, text);
    machine.answer(canonicalAnswer);
    let next = machine.view();
    if (
      next.state === "plan_ready" &&
      this.dependencies.projectOnboarding !== undefined
    ) {
      const context = await this.dependencies.projectOnboarding(
        contact,
        snapshotOf(next),
      );
      if (context.planStatus === "blocked") {
        machine.escalate();
        next = machine.view();
      } else if (context.planStatus === "setup_required") {
        await this.persist(contact.id, next);
        return this.presentSetupRequired(contact.externalId, next.locale);
      }
    }
    await this.persist(contact.id, next);
    return this.present(contact.externalId, next);
  }

  private async presentPlan(
    contact: ProviderContact,
    text: string,
    locale: "de-CH" | "en",
    offerUpgrade = false,
  ): Promise<OutboundMessage> {
    const links = await this.dependencies.links(contact);
    const context = await this.dependencies.productContext?.(contact);
    if (context?.planStatus === "setup_required") {
      return this.presentSetupRequired(contact.externalId, locale);
    }
    const normalized = text.trim().toLowerCase();
    if (["choice.2", "plan"].includes(normalized)) {
      return this.dependencies.provider.sendText(
        contact.externalId,
        links.plan,
      );
    }
    if (["choice.3", "fortschritt", "progress"].includes(normalized)) {
      return this.dependencies.provider.sendText(
        contact.externalId,
        links.progress,
      );
    }
    const trainingContext = {
      ...(context?.baselineSuccessRate === undefined
        ? {}
        : { baselineSuccessRate: context.baselineSuccessRate }),
      ...(context?.behaviorConcernDescription === undefined
        ? {}
        : {
            behaviorConcernDescription: context.behaviorConcernDescription,
          }),
      ...(context?.currentStep === undefined
        ? {}
        : { currentStep: context.currentStep }),
      ...(context?.requiredConsecutiveSessions === undefined
        ? {}
        : {
            requiredConsecutiveSessions: context.requiredConsecutiveSessions,
          }),
      ...(context?.targetSuccessRate === undefined
        ? {}
        : { targetSuccessRate: context.targetSuccessRate }),
      dogName:
        context?.dogName ?? (locale === "de-CH" ? "dein Hund" : "your dog"),
      ...(context?.dogProfileSummary === undefined
        ? {}
        : { dogProfileSummary: context.dogProfileSummary }),
      durationMinutes: 4,
      evidenceCount: context?.sessionCount ?? 0,
      goal: context?.goalText ?? context?.goal ?? "current training goal",
      latestDecision: context?.latestDecision ?? "repeat_step",
      stage:
        locale === "de-CH"
          ? "Orientierung unter wenig Ablenkung"
          : "orientation under low distraction",
      ...(context?.calendar === undefined
        ? {}
        : { schedule: context.calendar }),
    };
    const reply = composeCoachReply({
      context: trainingContext,
      currentLocale: locale,
      links: { ...links, session: links.today },
      message: text,
    });
    if (this.dependencies.rewriteCoachReply !== undefined) {
      try {
        const generated = await this.dependencies.rewriteCoachReply({
          contact,
          context: trainingContext,
          contextKind: "plan",
          draft: reply,
          message: text,
        });
        if (
          generated.trim().length > 0 &&
          generated.length <= maxCoachReplyCharacters
        ) {
          reply.text = generated.trim();
        }
      } catch {
        // Keep the deterministic coaching reply when the optional model fails.
      }
    }
    const tier = offerUpgrade
      ? await this.dependencies.tierForContact?.(contact)
      : undefined;
    const upgrade =
      tier === "freemium" && links.account !== undefined
        ? locale === "de-CH"
          ? `\n\nDu startest kostenlos. Wenn du später mehr Coach-Nachrichten und häufigere Plananpassungen brauchst, kannst du Plus in Ruhe vergleichen: ${links.account}`
          : `\n\nYou are starting free. If you later need more Coach messages and more frequent plan adjustments, you can compare Plus here: ${links.account}`
        : "";
    return this.dependencies.provider.sendInteractive(
      contact.externalId,
      `${reply.text} ${reply.actions[0]?.href ?? links.today}${upgrade}`,
      options.plan_ready[locale],
    );
  }

  private async presentEscalation(
    contact: ProviderContact,
    text: string,
    locale: "de-CH" | "en",
  ): Promise<OutboundMessage> {
    const links = await this.dependencies.links(contact);
    const normalized = text.trim().toLowerCase();
    if (normalized === "choice.1") {
      return this.dependencies.provider.sendText(
        contact.externalId,
        links.referral,
      );
    }
    if (normalized === "choice.2") {
      return this.dependencies.provider.sendText(
        contact.externalId,
        links.progress,
      );
    }
    return this.dependencies.provider.sendText(
      contact.externalId,
      locale === "de-CH"
        ? "Beschreibe kurz nur die neue Beobachtung. DogOS speichert sie als Bericht; eine Diagnose oder Freigabe erfolgt daraus nicht automatisch."
        : "Briefly describe only the new observation. DogOS records it as a report; it does not automatically create a diagnosis or clearance.",
    );
  }

  private presentSetupRequired(
    contactId: string,
    locale: "de-CH" | "en",
  ): Promise<OutboundMessage> {
    return this.dependencies.provider.sendText(
      contactId,
      locale === "de-CH"
        ? "Dein Fall ist gespeichert. Fuer den gewaehlten Trainingsschritt fehlt noch die bestaetigte Ausruestung. Das ist kein Sicherheitsstopp und keine Empfehlung fuer eine Fachperson."
        : "Your case is saved. The selected training step still needs confirmed equipment. This is not a safety stop or a professional-referral recommendation.",
    );
  }

  private present(
    contactId: string,
    view: ReturnType<ConversationMachine["view"]>,
    acknowledgement?: string,
  ): Promise<OutboundMessage> {
    const choices = options[view.state][view.locale];
    const message = acknowledgement?.trim()
      ? `${acknowledgement.trim()}\n\n${view.prompt}`
      : view.prompt;
    return choices.length === 0
      ? this.dependencies.provider.sendText(contactId, message)
      : this.dependencies.provider.sendInteractive(contactId, message, choices);
  }

  private persist(
    contactId: string,
    view: ReturnType<ConversationMachine["view"]>,
  ): Promise<void> {
    const snapshot: ConversationSnapshot = {
      answers: view.answers,
      audit: view.audit,
      country: view.country,
      currency: view.currency,
      locale: view.locale,
      notes: view.notes ?? {},
      state: view.state,
      timezone: view.timezone,
    };
    return this.dependencies.store.saveConversation(contactId, snapshot);
  }
}

function snapshotOf(
  view: ReturnType<ConversationMachine["view"]>,
): ConversationSnapshot {
  return {
    answers: view.answers,
    audit: view.audit,
    country: view.country,
    currency: view.currency,
    locale: view.locale,
    notes: view.notes ?? {},
    state: view.state,
    timezone: view.timezone,
  };
}

function onboardingAdvisory(
  answers: Partial<Record<OnboardingAnswerState, string>>,
  locale: "de-CH" | "en",
): string {
  if (answers.health_screen === "health_screen.choice.2") {
    return locale === "de-CH"
      ? "Eine akute körperliche Veränderung kann DogOS nicht beurteilen; bei anhaltenden oder deutlichen Beschwerden ist eine tierärztliche Abklärung sinnvoll. Das ist keine Diagnose, und wir erfassen den Trainingskontext weiter."
      : "DogOS cannot assess an acute physical change; veterinary assessment is appropriate if it persists or is pronounced. This is not a diagnosis, and we will continue recording the training context.";
  }
  if (answers.safety_screen === "safety_screen.choice.3") {
    return locale === "de-CH"
      ? "Bei einem Biss mit Kind ist die Unterstützung durch eine qualifizierte Fachperson sinnvoll. Ich erfasse den Fall weiter und zeige danach passende nächste Schritte."
      : "After a bite involving a child, support from a qualified professional is appropriate. I will keep recording the case and then show suitable next steps.";
  }
  return "";
}

function isUsableName(text: string): boolean {
  return /^[\p{L}][\p{L}' -]{0,39}$/u.test(text.trim());
}

function normalizeAnswer(state: ConversationState, text: string): string {
  const value = text.trim();
  if (/^choice\.[1-3]$/.test(value)) return `${state}.${value}`;
  return `${state}.text:${value.slice(0, 120)}`;
}
