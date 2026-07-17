export const conversationStates = [
  "welcome",
  "ai_disclosure",
  "locale_confirmation",
  "dog_identity",
  "dog_history",
  "behavior_concern",
  "goal_selection",
  "baseline_collection",
  "household_context",
  "health_screen",
  "safety_screen",
  "training_setup",
  "plan_ready",
  "daily_session",
  "checkin",
  "progress_review",
  "adjustment",
  "professional_escalation",
] as const;
export type ConversationState = (typeof conversationStates)[number];
export type ConversationLocale = "de-CH" | "en";

export const onboardingAnswerStates = [
  "dog_identity",
  "dog_history",
  "behavior_concern",
  "goal_selection",
  "baseline_collection",
  "household_context",
  "health_screen",
  "safety_screen",
  "training_setup",
] as const;
export type OnboardingAnswerState = (typeof onboardingAnswerStates)[number];

export interface ConversationSnapshot {
  state: ConversationState;
  locale: ConversationLocale;
  country: "CH";
  currency: "CHF";
  timezone: "Europe/Zurich";
  answers: Record<string, string>;
  notes?: Record<string, string>;
  audit: Array<{ event: string; state: ConversationState }>;
}

const prompts: Record<ConversationLocale, Record<ConversationState, string>> = {
  "de-CH": {
    welcome:
      "Hoi, ich bin der DogOS Coach. Ich lerne deinen Hund und euer Ziel kennen und baue daraus einen messbaren Trainingsplan.",
    ai_disclosure:
      "Ich bin KI-gestuetzt und antworte natuerlich auf deine Beschreibung. Trainingsplan, Fortschritt und Anpassungen werden aus den erfassten Fakten berechnet. DogOS stellt keine Diagnose und ist kein Notfalldienst.",
    locale_confirmation: "Die Sprache wird automatisch erkannt.",
    household_context:
      "Trainierst nur du mit deinem Hund oder auch andere Personen?",
    dog_identity:
      "Erzaehl mir kurz von deinem Hund: Rufname, Alter oder Rasse/Mix und woran ihr arbeiten wollt. Du kannst ganz normal schreiben.",
    dog_history:
      "Was sollte ich zu Alter, Herkunft und bisherigem Training noch wissen?",
    health_screen: "Gibt es Schmerzen oder ploetzliche Veraenderungen?",
    safety_screen: "Gab es Schnappen, Beissen oder starke Angst?",
    behavior_concern:
      "Beschreibe eine konkrete Alltagssituation, die besser werden soll.",
    goal_selection:
      "Was soll dein Hund in dieser Situation stattdessen konkret tun?",
    training_setup:
      "Hast du die genannte Ausruestung und kannst du den richtigen Moment mit einem bekannten Signal markieren?",
    baseline_collection:
      "Wie oft klappt das heute ungefaehr: selten, etwa zur Haelfte oder meistens?",
    plan_ready: "Der Entwicklungsplan fuer {{dogName}} ist bereit.",
    daily_session: "Bereit fuer eine kurze Einheit?",
    checkin: "Wie ist die Einheit gelaufen?",
    progress_review: "Hier ist euer Fortschritt nach Messdimensionen.",
    adjustment: "Die Schwierigkeit wurde anhand der Daten angepasst.",
    professional_escalation:
      "Der Fall ist gespeichert. DogOS empfiehlt eine qualifizierte Fachperson, bevor eine neue autonome Uebung beginnt.",
  },
  en: {
    welcome:
      "Hi, I am the DogOS Coach. I learn about your dog and your goal, then build a measurable training plan.",
    ai_disclosure:
      "I am AI-assisted and respond naturally to your description. Training plans, progress, and adjustments are computed from the recorded facts. DogOS does not diagnose and is not an emergency service.",
    locale_confirmation: "Language is detected automatically.",
    household_context:
      "Are you the only person training your dog, or are others involved?",
    dog_identity:
      "Tell me about your dog: call name, age or breed/mix, and what you want to work on. Write naturally.",
    dog_history:
      "What else should I know about age, background, and previous training?",
    health_screen: "Any pain or sudden changes?",
    safety_screen: "Any snapping, biting, or severe fear?",
    behavior_concern:
      "Describe one specific everyday situation you want to improve.",
    goal_selection:
      "What should your dog do instead in that situation, in observable terms?",
    training_setup:
      "Do you have the listed equipment and can you mark the correct moment with a familiar cue?",
    baseline_collection:
      "Roughly how often does that work today: rarely, about half the time, or usually?",
    plan_ready: "The development plan for {{dogName}} is ready.",
    daily_session: "Ready for a short session?",
    checkin: "How did the session go?",
    progress_review: "Here is progress by measurement dimension.",
    adjustment: "Difficulty was adjusted from the recorded evidence.",
    professional_escalation:
      "The case is saved. DogOS recommends a qualified professional before a new autonomous exercise begins.",
  },
};

export class ConversationMachine {
  #snapshot: ConversationSnapshot;

  constructor(locale: ConversationLocale = "de-CH") {
    this.#snapshot = {
      state: "welcome",
      locale,
      country: "CH",
      currency: "CHF",
      timezone: "Europe/Zurich",
      answers: {},
      notes: {},
      audit: [],
    };
  }

  view(): ConversationSnapshot & { prompt: string } {
    const dogName = this.#snapshot.answers.dog_identity?.replace(
      "dog_identity.text:",
      "",
    );
    return {
      ...structuredClone(this.#snapshot),
      prompt: prompts[this.#snapshot.locale][this.#snapshot.state].replace(
        "{{dogName}}",
        dogName ??
          (this.#snapshot.locale === "de-CH" ? "deinen Hund" : "your dog"),
      ),
    };
  }

  answer(canonicalAnswer: string): ReturnType<ConversationMachine["view"]> {
    this.#snapshot.answers[this.#snapshot.state] = canonicalAnswer;
    const index = conversationStates.indexOf(this.#snapshot.state);
    let nextIndex = index + 1;
    if (conversationStates[nextIndex] === "locale_confirmation") nextIndex += 1;
    if (nextIndex < conversationStates.length - 1)
      this.#snapshot.state = conversationStates[nextIndex]!;
    this.#snapshot.audit.push({
      event: "answer.recorded",
      state: this.#snapshot.state,
    });
    return this.view();
  }

  recordOnboarding(input: {
    answers: Partial<Record<OnboardingAnswerState, string>>;
    notes?: Record<string, string>;
  }): ReturnType<ConversationMachine["view"]> {
    for (const state of onboardingAnswerStates) {
      const answer = input.answers[state];
      if (
        answer !== undefined &&
        answer.startsWith(`${state}.`) &&
        this.#snapshot.answers[state] === undefined
      ) {
        this.#snapshot.answers[state] = answer;
      }
    }
    this.#snapshot.notes ??= {};
    Object.assign(this.#snapshot.notes, input.notes ?? {});
    this.#snapshot.state =
      onboardingAnswerStates.find(
        (state) => this.#snapshot.answers[state] === undefined,
      ) ?? "plan_ready";
    this.#snapshot.audit.push({
      event: "onboarding.facts_recorded",
      state: this.#snapshot.state,
    });
    return this.view();
  }

  switchLocale(
    locale: ConversationLocale,
  ): ReturnType<ConversationMachine["view"]> {
    this.#snapshot.locale = locale;
    this.#snapshot.audit.push({
      event: "locale.switched",
      state: this.#snapshot.state,
    });
    return this.view();
  }

  skipLegacyLocaleConfirmation(): ReturnType<ConversationMachine["view"]> {
    if (this.#snapshot.state === "locale_confirmation") {
      this.#snapshot.state = "dog_identity";
      this.#snapshot.audit.push({
        event: "locale.prompt_skipped",
        state: this.#snapshot.state,
      });
    }
    return this.view();
  }

  escalate(): ReturnType<ConversationMachine["view"]> {
    this.#snapshot.state = "professional_escalation";
    this.#snapshot.audit.push({
      event: "safety.escalated",
      state: this.#snapshot.state,
    });
    return this.view();
  }

  recoverPlanReady(): ReturnType<ConversationMachine["view"]> {
    if (this.#snapshot.state === "professional_escalation") {
      this.#snapshot.state = "plan_ready";
      this.#snapshot.audit.push({
        event: "plan.reconciled",
        state: this.#snapshot.state,
      });
    }
    return this.view();
  }

  resume(snapshot: ConversationSnapshot): void {
    this.#snapshot = {
      ...structuredClone(snapshot),
      notes: snapshot.notes ?? {},
    };
  }
}
