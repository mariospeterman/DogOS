export const conversationStates = [
  "welcome",
  "ai_disclosure",
  "locale_confirmation",
  "household_context",
  "dog_identity",
  "dog_history",
  "health_screen",
  "safety_screen",
  "behavior_concern",
  "goal_selection",
  "baseline_collection",
  "plan_ready",
  "daily_session",
  "checkin",
  "progress_review",
  "adjustment",
  "professional_escalation",
] as const;
export type ConversationState = (typeof conversationStates)[number];
export type ConversationLocale = "de-CH" | "en";

export interface ConversationSnapshot {
  state: ConversationState;
  locale: ConversationLocale;
  country: "CH";
  currency: "CHF";
  timezone: "Europe/Zurich";
  answers: Record<string, string>;
  audit: Array<{ event: string; state: ConversationState }>;
}

const prompts: Record<ConversationLocale, Record<ConversationState, string>> = {
  "de-CH": {
    welcome:
      "Hoi, ich begleite dich und deinen Hund durch kurze Trainingsschritte.",
    ai_disclosure:
      "DogOS nutzt spaeter KI-Unterstuetzung. Entscheidungen sind hier regelbasiert.",
    locale_confirmation: "Moechtest du auf Deutsch weitermachen?",
    household_context: "Wer lebt mit deinem Hund im Haushalt?",
    dog_identity: "Wie heisst dein Hund?",
    dog_history: "Was weisst du ueber Alter und Herkunft?",
    health_screen: "Gibt es Schmerzen oder ploetzliche Veraenderungen?",
    safety_screen: "Gab es Schnappen, Beissen oder starke Angst?",
    behavior_concern: "Was ist im Alltag gerade schwierig?",
    goal_selection: "Welches messbare Ziel moechtest du zuerst angehen?",
    baseline_collection: "Wie oft klappt lockeres Gehen heute?",
    plan_ready: "Milos Entwicklungsplan ist bereit.",
    daily_session: "Bereit fuer eine kurze Einheit?",
    checkin: "Wie ist die Einheit gelaufen?",
    progress_review: "Hier ist euer Fortschritt nach Messdimensionen.",
    adjustment: "Die Schwierigkeit wurde anhand der Daten angepasst.",
    professional_escalation:
      "Bitte pausiere das Training und hole professionelle Hilfe.",
  },
  en: {
    welcome: "Hi, I will guide you and your dog through short training steps.",
    ai_disclosure:
      "DogOS may use AI assistance later. Decisions here are rule-based.",
    locale_confirmation: "Would you like to continue in English?",
    household_context: "Who lives with your dog?",
    dog_identity: "What is your dog's name?",
    dog_history: "What do you know about age and background?",
    health_screen: "Any pain or sudden changes?",
    safety_screen: "Any snapping, biting, or severe fear?",
    behavior_concern: "What is difficult in daily life?",
    goal_selection: "Which measurable goal should we address first?",
    baseline_collection: "How often is the leash loose today?",
    plan_ready: "Milo's development plan is ready.",
    daily_session: "Ready for a short session?",
    checkin: "How did the session go?",
    progress_review: "Here is progress by measurement dimension.",
    adjustment: "Difficulty was adjusted from the recorded evidence.",
    professional_escalation: "Pause training and seek professional help.",
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
      audit: [],
    };
  }

  view(): ConversationSnapshot & { prompt: string } {
    return {
      ...structuredClone(this.#snapshot),
      prompt: prompts[this.#snapshot.locale][this.#snapshot.state],
    };
  }

  answer(canonicalAnswer: string): ReturnType<ConversationMachine["view"]> {
    this.#snapshot.answers[this.#snapshot.state] = canonicalAnswer;
    const index = conversationStates.indexOf(this.#snapshot.state);
    if (index < conversationStates.length - 2)
      this.#snapshot.state = conversationStates[index + 1]!;
    this.#snapshot.audit.push({
      event: "answer.recorded",
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

  escalate(): ReturnType<ConversationMachine["view"]> {
    this.#snapshot.state = "professional_escalation";
    this.#snapshot.audit.push({
      event: "safety.escalated",
      state: this.#snapshot.state,
    });
    return this.view();
  }

  resume(snapshot: ConversationSnapshot): void {
    this.#snapshot = structuredClone(snapshot);
  }
}
