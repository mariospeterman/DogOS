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
    text = de
      ? `Der Plan für ${input.context.dogName} baut Orientierung zuerst unter niedriger Ablenkung auf. Die Einheiten bleiben mit ${input.context.durationMinutes} Minuten kurz, damit Ausführung und Messung sauber bleiben. Danach entscheidet die dokumentierte Leistung über den nächsten Schritt.`
      : `${input.context.dogName}'s plan builds orientation under low distraction first. Sessions stay short at ${input.context.durationMinutes} minutes so execution and measurement remain clean. Documented performance then determines the next step.`;
    actions.push({
      href: input.links.plan,
      label: de ? "Plan öffnen" : "Open plan",
      kind: "primary" as const,
    });
  } else {
    text = de
      ? `Heute: ${input.context.durationMinutes} Minuten ruhige Orientierung mit ${input.context.dogName}. Beginne auf einem übersichtlichen Abschnitt, gehe bei lockerer Leine weiter und bestätige freiwillige Orientierung. Schreib mir danach kurz, was leicht oder schwer war.`
      : `Today: ${input.context.durationMinutes} minutes of calm orientation with ${input.context.dogName}. Start on a clear stretch, continue with a loose leash, and mark voluntary check-ins. Then tell me briefly what felt easy or difficult.`;
    actions.push({
      href: input.links.today,
      label: de ? "Heutigen Block öffnen" : "Open today's block",
      kind: "primary" as const,
    });
  }

  return { actions, locale, text };
}
