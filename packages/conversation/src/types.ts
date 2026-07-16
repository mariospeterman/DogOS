export type CoachChannel = "web" | "whatsapp";
export type CoachMessageRole = "user" | "assistant" | "system";
export type CoachContextKind =
  "today" | "plan" | "session" | "progress" | "general";

export interface CoachAction {
  href: string;
  label: string;
  kind: "primary" | "secondary";
}

export interface CoachMessage {
  id: string;
  role: CoachMessageRole;
  channel: CoachChannel | "system";
  content: string;
  contextKind: CoachContextKind | null;
  contextSubjectId: string | null;
  createdAt: string;
}

export interface CoachConversation {
  id: string;
  dogId: string;
  householdId: string;
  locale: "de-CH" | "en";
  messages: CoachMessage[];
}

export interface CoachTrainingContext {
  dogName: string;
  goal: string;
  stage: string;
  durationMinutes: number;
  evidenceCount: number;
  latestDecision: string;
}

export interface CoachLinks {
  today: string;
  plan: string;
  progress: string;
  session: string;
}

export interface CoachReply {
  text: string;
  locale: "de-CH" | "en";
  actions: CoachAction[];
}
