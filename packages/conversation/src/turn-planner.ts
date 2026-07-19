import type {
  CoachContextKind,
  CoachTrainingContext,
  CoachTurnPlan,
} from "./types.js";

const safetyPattern =
  /\b(bite|bit|child|snap|snapped|pain|limp|limping|injury|blood|vet|veterinary|beissen|gebissen|kind|schnapp|schmerz|humpelt|verletz|tierarzt)\b/i;
const handoffPattern =
  /\b(handoff|trainer|veterinarian|vet|professional|review|teilen|trainerin|tierarzt|fachperson|übergabe)\b/i;
const videoPattern = /\b(video|clip|film|recording|aufnahme|kamera)\b/i;
const progressPattern =
  /\b(progress|better|worse|trend|fortschritt|besser|schlechter)\b/i;
const planPattern =
  /\b(plan|schedule|exercise|session|training|übung|uebung|kalender)\b/i;
const observationPattern =
  /\b(today|happened|noticed|saw|reported|heute|passiert|beobachtet|gesehen)\b/i;
const perspectivePattern =
  /\b(partner|caregiver|family|friend|observer|another perspective|familie|freund|beobachter|andere perspektive)\b/i;

export function planCoachTurn(input: {
  context: CoachTrainingContext;
  contextKind?: CoachContextKind;
  message: string;
}): CoachTurnPlan {
  const message = input.message.trim();
  const lowerRisk =
    safetyPattern.test(message) ||
    (input.context.riskDisposition !== undefined &&
      input.context.riskDisposition !== "continue_low_risk_training");
  const primaryIntent = lowerRisk
    ? "ask_clarifying"
    : handoffPattern.test(message)
      ? "prepare_handoff"
      : perspectivePattern.test(message)
        ? "request_perspective"
        : videoPattern.test(message) || input.contextKind === "media"
          ? "request_video"
          : progressPattern.test(message) || input.contextKind === "progress"
            ? "review_progress"
            : planPattern.test(message) || input.contextKind === "plan"
              ? "explain_plan"
              : observationPattern.test(message)
                ? "record_observation"
                : "respond";
  const requestedArtifacts: CoachTurnPlan["requestedArtifacts"] = [];
  if (primaryIntent === "explain_plan") requestedArtifacts.push("plan");
  if (primaryIntent === "review_progress") requestedArtifacts.push("progress");
  if (primaryIntent === "request_video")
    requestedArtifacts.push("video_analysis");
  if (primaryIntent === "request_perspective")
    requestedArtifacts.push("feedback_request");
  if (primaryIntent === "prepare_handoff")
    requestedArtifacts.push("handoff_preview");
  if (
    input.context.currentStep !== undefined &&
    input.context.currentStep !== null
  ) {
    requestedArtifacts.push("session");
  }
  const proposedTools: string[] = ["dogos_get_relevant_context"];
  if (primaryIntent === "prepare_handoff") {
    proposedTools.push("dogos_preview_handoff");
  }
  if (primaryIntent === "request_perspective") {
    proposedTools.push("dogos_create_feedback_request");
  }
  if (primaryIntent === "record_observation") {
    proposedTools.push("dogos_create_memory_candidate");
  }
  return {
    contextNeeds: [
      "dog_profile",
      "active_goal",
      "active_plan",
      "safety_state",
      "confirmed_memory",
      ...(primaryIntent === "request_video" ||
      primaryIntent === "prepare_handoff"
        ? ["media_evidence"]
        : []),
      ...(primaryIntent === "request_perspective" ||
      primaryIntent === "prepare_handoff"
        ? ["collaboration_context"]
        : []),
    ],
    materialQuestion:
      primaryIntent === "ask_clarifying"
        ? "What changed immediately before this happened, and is there any sign of pain or sudden health change?"
        : null,
    memoryCandidates:
      primaryIntent === "record_observation" && message.length > 0
        ? [
            {
              category: "episodic_event",
              subject: "owner.observation",
              value: message.slice(0, 500),
            },
          ]
        : [],
    primaryIntent,
    proposedTools: proposedTools.slice(0, primaryIntent === "respond" ? 2 : 3),
    requestedArtifacts: [...new Set(requestedArtifacts)],
    responseRisk: lowerRisk
      ? "safety_sensitive"
      : primaryIntent === "respond" || primaryIntent === "record_observation"
        ? "routine"
        : "decision_bearing",
    stepLimit:
      primaryIntent === "respond" || primaryIntent === "record_observation"
        ? 2
        : 3,
  };
}
