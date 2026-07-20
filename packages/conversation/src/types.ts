import type { CoachingContextCapsule, DogOSDataPart } from "@dogos/contracts";

export type CoachChannel = "web";
export type CoachMessageRole = "user" | "assistant" | "system";
export type CoachContextKind =
  "today" | "plan" | "session" | "progress" | "media" | "general";
export type CoachWorkspace =
  "setup" | "coach" | "plan" | "train" | "progress" | "media" | "team";

export type CoachPrimaryIntent =
  | "respond"
  | "ask_clarifying"
  | "record_observation"
  | "explain_plan"
  | "review_progress"
  | "request_video"
  | "request_perspective"
  | "prepare_handoff"
  | "find_professional";

export interface CoachTurnPlan {
  contextNeeds: string[];
  materialQuestion: string | null;
  memoryCandidates: Array<{
    category: string;
    subject: string;
    value: string;
  }>;
  primaryIntent: CoachPrimaryIntent;
  proposedTools: string[];
  requestedArtifacts: Array<
    | "calendar"
    | "feedback_request"
    | "handoff_preview"
    | "live_session"
    | "plan"
    | "progress"
    | "session"
    | "video_analysis"
  >;
  responseRisk: "routine" | "decision_bearing" | "safety_sensitive";
  stepLimit: 2 | 3;
}

export interface CoachAction {
  href: string;
  label: string;
  kind: "primary" | "secondary";
}

export interface CoachMessage {
  id: string;
  role: CoachMessageRole;
  channel: CoachChannel | "system";
  artifactRefs: Array<{ id: string; kind: string; version: number | null }>;
  content: string;
  contextKind: CoachContextKind | null;
  contextSubjectId: string | null;
  createdAt: string;
  generationStatus:
    "pending" | "streaming" | "completed" | "failed" | "superseded";
  secondaryTags: string[];
  uiParts: DogOSDataPart[];
  workspace: CoachWorkspace;
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
  quotaExhausted?: boolean;
  riskDisposition?: string;
  schedule?: Array<{
    durationSeconds: number;
    isRecovery: boolean;
    plannedStart: string;
    purposeCode: string;
    status: string;
  }>;
  contextSnapshot?: CoachingContextCapsule;
  contextSnapshotId?: string;
}

export interface CoachLinks {
  today: string;
  plan: string;
  progress: string;
  session: string;
  billing?: string;
}

export interface CoachReply {
  text: string;
  locale: "de-CH" | "en";
  actions: CoachAction[];
}
