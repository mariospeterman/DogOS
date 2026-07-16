import { capabilitiesForTier, type SubscriptionTier } from "@dogos/contracts";

import {
  ConversationMachine,
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
    "de-CH": ["Ruhig starten", "Distanz halten", "Signal halten"],
    en: ["Calm start", "Hold distance", "Hold cue"],
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

export interface ConversationLinks {
  plan: string;
  progress: string;
  referral: string;
  today: string;
}

export class WhatsAppConversationOrchestrator {
  constructor(
    private readonly provider: WhatsAppProvider,
    private readonly store: WhatsAppStateStore,
    private readonly links: (
      contact: ProviderContact,
    ) => Promise<ConversationLinks>,
    private readonly tier: SubscriptionTier = "freemium",
    private readonly languageResolver: ConversationLanguageResolver = new DeterministicConversationLanguageResolver(),
  ) {}

  async handle(
    contact: ProviderContact,
    text: string,
  ): Promise<OutboundMessage> {
    const saved = await this.store.loadConversation(contact.id);
    const machine = new ConversationMachine(saved?.locale ?? contact.locale);
    if (saved !== null) machine.resume(saved);
    const beforeResolution = machine.view();
    const resolution = await this.languageResolver.resolve({
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
    const allowed = await this.store.consumeDailyMessage(
      contact.id,
      capabilitiesForTier(this.tier).coachingMessagesPerDay,
    );
    if (!allowed) {
      if (localeChanged) await this.persist(contact.id, current);
      return this.provider.sendText(
        contact.externalId,
        locale === "de-CH"
          ? "Für heute ist das Nachrichtenlimit erreicht. Dein Plan und die heutige Einheit bleiben in DogOS verfügbar."
          : "Today's message limit is reached. Your plan and today's session remain available in DogOS.",
      );
    }

    if (resolution.source === "explicit_request") {
      await this.persist(contact.id, current);
      return this.present(contact.externalId, current);
    }

    if (offTopicPattern.test(text)) {
      if (localeChanged) await this.persist(contact.id, current);
      return this.provider.sendText(
        contact.externalId,
        locale === "de-CH"
          ? "Ich bleibe bei deinem Hund: Training, Beobachtungen, Plan und Fortschritt. Was davon brauchst du?"
          : "I stay focused on your dog: training, observations, plan, and progress. Which do you need?",
      );
    }

    if (current.state === "plan_ready") {
      return this.presentPlan(contact, text, current.locale);
    }

    if (current.state === "professional_escalation") {
      return this.presentEscalation(contact, text, current.locale);
    }

    if (
      (current.state === "health_screen" &&
        (acutePattern.test(text) || text === "choice.2")) ||
      (current.state === "safety_screen" && text === "choice.3")
    ) {
      machine.escalate();
      await this.persist(contact.id, machine.view());
      const injury = current.state === "health_screen";
      return this.provider.sendInteractive(
        contact.externalId,
        current.locale === "de-CH"
          ? injury
            ? "Diese akute Veränderung kann DogOS nicht beurteilen. Setze die heutige Übung vorsichtshalber aus und lass Milo tierärztlich abklären. Das ist keine Diagnose; Plan, Verlauf und Chat bleiben verfügbar."
            : "Bei einem Biss mit Kind empfiehlt DogOS keine neue autonome Übung. Lass den Fall durch eine qualifizierte Fachperson beurteilen. Das ist keine Diagnose; Chat, Verlauf und Terminzugang bleiben verfügbar."
          : injury
            ? "DogOS cannot assess this acute change. Skip today's exercise as a precaution and seek veterinary assessment. This is not a diagnosis; your plan, history, and chat remain available."
            : "After a bite involving a child, DogOS will not suggest a new autonomous exercise. Have the case assessed by a qualified professional. This is not a diagnosis; chat, history, and booking access remain available.",
        current.locale === "de-CH"
          ? ["Fachperson finden", "Verlauf öffnen", "Update melden"]
          : ["Find professional", "Open history", "Report update"],
      );
    }

    if (current.state === "dog_identity" && !isUsableName(text)) {
      return this.provider.sendText(
        contact.externalId,
        current.locale === "de-CH"
          ? "Wie heisst dein Hund? Antworte nur mit dem Rufnamen."
          : "What is your dog's name? Reply with the call name only.",
      );
    }

    const canonicalAnswer = normalizeAnswer(current.state, text);
    machine.answer(canonicalAnswer);
    await this.persist(contact.id, machine.view());
    return this.present(contact.externalId, machine.view());
  }

  private async presentPlan(
    contact: ProviderContact,
    text: string,
    locale: "de-CH" | "en",
  ): Promise<OutboundMessage> {
    const links = await this.links(contact);
    const normalized = text.trim().toLowerCase();
    if (["choice.2", "plan"].includes(normalized)) {
      return this.provider.sendText(contact.externalId, links.plan);
    }
    if (["choice.3", "fortschritt", "progress"].includes(normalized)) {
      return this.provider.sendText(contact.externalId, links.progress);
    }
    const copy =
      locale === "de-CH"
        ? `Heute trainiert ihr vier Minuten ruhige Orientierung an lockerer Leine. Starte auf einem übersichtlichen Abschnitt. Gehe erst los, wenn die Leine locker ist; jede freiwillige Orientierung bestätigt die richtige Position. So wird nicht Tempo, sondern saubere Kontrolle aufgebaut. ${links.today}`
        : `Today you will train four minutes of calm orientation on a loose leash. Start on a clear stretch. Move only while the leash is loose; each voluntary check-in confirms the correct position. This builds clean control rather than speed. ${links.today}`;
    return this.provider.sendInteractive(
      contact.externalId,
      copy,
      options.plan_ready[locale],
    );
  }

  private async presentEscalation(
    contact: ProviderContact,
    text: string,
    locale: "de-CH" | "en",
  ): Promise<OutboundMessage> {
    const links = await this.links(contact);
    const normalized = text.trim().toLowerCase();
    if (normalized === "choice.1") {
      return this.provider.sendText(contact.externalId, links.referral);
    }
    if (normalized === "choice.2") {
      return this.provider.sendText(contact.externalId, links.progress);
    }
    return this.provider.sendText(
      contact.externalId,
      locale === "de-CH"
        ? "Beschreibe kurz nur die neue Beobachtung. DogOS speichert sie als Bericht; eine Diagnose oder Freigabe erfolgt daraus nicht automatisch."
        : "Briefly describe only the new observation. DogOS records it as a report; it does not automatically create a diagnosis or clearance.",
    );
  }

  private present(
    contactId: string,
    view: ReturnType<ConversationMachine["view"]>,
  ): Promise<OutboundMessage> {
    const choices = options[view.state][view.locale];
    return choices.length === 0
      ? this.provider.sendText(contactId, view.prompt)
      : this.provider.sendInteractive(contactId, view.prompt, choices);
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
      state: view.state,
      timezone: view.timezone,
    };
    return this.store.saveConversation(contactId, snapshot);
  }
}

function isUsableName(text: string): boolean {
  return /^[\p{L}][\p{L}' -]{0,39}$/u.test(text.trim());
}

function normalizeAnswer(state: ConversationState, text: string): string {
  const value = text.trim();
  if (/^choice\.[1-3]$/.test(value)) return `${state}.${value}`;
  return `${state}.text:${value.slice(0, 120)}`;
}
