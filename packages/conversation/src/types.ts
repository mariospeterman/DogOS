export type CoachChannel = "web";
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
  baselineSuccessRate?: number;
  behaviorConcernDescription?: string;
  targetSuccessRate?: number;
  requiredConsecutiveSessions?: number;
  currentStep?: {
    difficulty: number;
    durationSeconds: number;
    repetitions: number;
    stepCode: string;
  } | null;
  dogName: string;
  dogProfileSummary?: string;
  goal: string;
  stage: string;
  durationMinutes: number;
  evidenceCount: number;
  latestDecision: string;
  riskDisposition?: string;
  schedule?: Array<{
    durationSeconds: number;
    isRecovery: boolean;
    plannedStart: string;
    purposeCode: string;
    status: string;
  }>;
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
