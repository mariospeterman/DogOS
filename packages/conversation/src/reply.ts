import type {
  CoachContextKind,
  CoachLinks,
  CoachReply,
  CoachTrainingContext,
} from "./types.js";

const germanPattern =
  /\b(heute|warum|plan|training|hund|leine|fortschritt|schwer|hilfe|milo|akut|schmerz)\b|[äöüß]/i;
const englishPattern =
  /\b(today|why|plan|training|dog|leash|progress|hard|help|acute|pain)\b/i;
const acutePattern = /\b(schmerz|lahm|verletzt|akut|pain|limp|injur|acute)\w*/i;
const whyPattern = /\b(warum|weshalb|why|explain)\b/i;
const progressPattern =
  /\b(fortschritt|entwicklung|progress|better|verbess)\w*/i;
const planPattern = /\b(plan|woche|schedule|kalender|calendar)\b/i;

function trainingCopy(context: CoachTrainingContext, de: boolean) {
  switch (context.currentStep?.stepCode) {
    case "step.recall_short_distance":
      return de
        ? {
            plan: "baut den Rückruf zuerst auf kurzer Distanz und bei niedriger Ablenkung auf",
            today:
              "Sichere die Schleppleine am Geschirr, gib das Rückrufsignal einmal und bestätige die unmittelbare Wendung zu dir. Löse nach sechs sauberen Wiederholungen auf.",
          }
        : {
            plan: "builds recall first at short distance and under low distraction",
            today:
              "Attach the long line to the harness, give the recall cue once, and mark the immediate turn toward you. Finish after six clean repetitions.",
          };
    case "step.loose_leash_low_distraction":
      return de
        ? {
            plan: "baut lockere Leinenführung zuerst auf einem übersichtlichen Abschnitt auf",
            today:
              "Beginne auf einem übersichtlichen Abschnitt, gehe bei lockerer Leine weiter und bestätige freiwillige Orientierung.",
          }
        : {
            plan: "builds loose-leash handling first on a clear stretch",
            today:
              "Start on a clear stretch, continue while the leash stays loose, and mark voluntary check-ins.",
          };
    case "step.calm_engagement_low_distraction":
      return de
        ? {
            plan: "baut ruhige Orientierung zuerst unter niedriger Ablenkung auf",
            today:
              "Wähle genügend Abstand, warte auf freiwillige Orientierung und bestätige ruhiges, ansprechbares Verhalten.",
          }
        : {
            plan: "builds calm engagement first under low distraction",
            today:
              "Choose enough distance, wait for voluntary orientation, and mark calm, responsive behaviour.",
          };
    default:
      return de
        ? {
            plan: `arbeitet zuerst an ${context.stage}`,
            today: `Trainiere den aktuellen Schritt ${context.currentStep?.repetitions ?? "in wenigen"} Mal unter niedriger Ablenkung und bestätige jede saubere Ausführung.`,
          }
        : {
            plan: `starts with ${context.stage}`,
            today: `Train the current step for ${context.currentStep?.repetitions ?? "a few"} repetitions under low distraction and mark each clean response.`,
          };
  }
}

export function inferCoachLocale(
  text: string,
  current: "de-CH" | "en",
): "de-CH" | "en" {
  const german = germanPattern.test(text);
  const english = englishPattern.test(text);
  if (german !== english) return german ? "de-CH" : "en";
  return current;
}

export function composeCoachReply(input: {
  context: CoachTrainingContext;
  contextKind?: CoachContextKind;
  currentLocale: "de-CH" | "en";
  links: CoachLinks;
  message: string;
}): CoachReply {
  const locale = inferCoachLocale(input.message, input.currentLocale);
  const de = locale === "de-CH";
  const training = trainingCopy(input.context, de);
  const actions = [];
  let text: string;

  if (acutePattern.test(input.message)) {
    text = de
      ? `Ich kann die akute Veränderung bei ${input.context.dogName} nicht medizinisch beurteilen. Beschreibe sie kurz und lass sie bei anhaltenden oder deutlichen Beschwerden tierärztlich abklären. Das ist keine Diagnose. Dein Verlauf und der Coach bleiben verfügbar.`
      : `I cannot medically assess the acute change in ${input.context.dogName}. Describe it briefly and seek veterinary assessment if it is persistent or pronounced. This is not a diagnosis. Your history and Coach remain available.`;
    actions.push({
      href: input.links.progress,
      label: de ? "Verlauf öffnen" : "Open history",
      kind: "secondary" as const,
    });
  } else if (whyPattern.test(input.message)) {
    text = de
      ? `${input.context.dogName} arbeitet gerade an ${input.context.goal}. Der Block bleibt bei ${input.context.stage}, bis die Ausführung in mehreren vergleichbaren Einheiten stabil ist. So verändern wir nur eine Schwierigkeit zurzeit und können erkennen, was tatsächlich funktioniert.`
      : `${input.context.dogName} is currently working on ${input.context.goal}. The block remains at ${input.context.stage} until execution is stable across comparable sessions. That changes one difficulty at a time so we can tell what actually works.`;
    actions.push({
      href: input.links.plan,
      label: de ? "Plan und Evidenz" : "Plan and evidence",
      kind: "secondary" as const,
    });
  } else if (
    progressPattern.test(input.message) ||
    input.contextKind === "progress"
  ) {
    text = de
      ? `${input.context.evidenceCount} vergleichbare Einheiten liegen vor. Die aktuelle Entscheidung ist: Schwierigkeit halten. Noch eine saubere Einheit gibt eine bessere Grundlage für die nächste Anpassung.`
      : `${input.context.evidenceCount} comparable sessions are available. The current decision is to hold difficulty. One more clean session gives a better basis for the next adjustment.`;
    actions.push({
      href: input.links.progress,
      label: de ? "Fortschritt ansehen" : "View progress",
      kind: "primary" as const,
    });
  } else if (planPattern.test(input.message) || input.contextKind === "plan") {
    const milestone =
      input.context.targetSuccessRate === undefined ||
      input.context.requiredConsecutiveSessions === undefined
        ? ""
        : de
          ? ` Ausgangspunkt sind etwa ${input.context.baselineSuccessRate ?? "noch nicht ausreichend gemessene"} Prozent; die nächste Etappe ist ${input.context.targetSuccessRate} Prozent in ${input.context.requiredConsecutiveSessions} vergleichbaren Einheiten.`
          : ` The baseline is about ${input.context.baselineSuccessRate ?? "not yet sufficiently measured"} percent; the next milestone is ${input.context.targetSuccessRate} percent across ${input.context.requiredConsecutiveSessions} comparable sessions.`;
    text = de
      ? `Der Plan für ${input.context.dogName} ${training.plan}. Die Einheiten bleiben mit ${input.context.durationMinutes} Minuten kurz, damit Ausführung und Messung sauber bleiben.${milestone} Danach entscheidet die dokumentierte Leistung über den nächsten Schritt.`
      : `${input.context.dogName}'s plan ${training.plan}. Sessions stay short at ${input.context.durationMinutes} minutes so execution and measurement remain clean.${milestone} Documented performance then determines the next step.`;
    actions.push({
      href: input.links.plan,
      label: de ? "Plan öffnen" : "Open plan",
      kind: "primary" as const,
    });
  } else {
    text = de
      ? `Heute: ${input.context.durationMinutes} Minuten mit ${input.context.dogName}. ${training.today} Schreib mir danach kurz, was leicht oder schwer war.`
      : `Today: ${input.context.durationMinutes} minutes with ${input.context.dogName}. ${training.today} Then tell me briefly what felt easy or difficult.`;
    actions.push({
      href: input.links.today,
      label: de ? "Heutigen Block öffnen" : "Open today's block",
      kind: "primary" as const,
    });
  }

  return { actions, locale, text };
}
