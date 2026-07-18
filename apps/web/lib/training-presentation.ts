import type { ProductDashboard } from "./product";

export interface TrainingPresentation {
  instruction: (dogName: string) => string;
  measurement: (repetitions: number) => string;
  stage: string;
  title: string;
  unit: string;
  why: string;
}

const presentations: Record<string, TrainingPresentation> = {
  "goal.calm_engagement": {
    instruction: (dogName) =>
      `Wähle so viel Abstand, dass ${dogName} die Begegnung wahrnimmt und noch ansprechbar bleibt. Bestätige ruhige Orientierung zu dir und vergrössere den Abstand, falls die Ansprechbarkeit sinkt.`,
    measurement: (repetitions) =>
      `${repetitions} Begegnungen: ruhige Orientierung jeweils direkt erfassen`,
    stage: "Ruhige Orientierung mit gut kontrollierbarem Abstand",
    title: "Ansprechbar bei Begegnungen",
    unit: "Begegnungen",
    why: "Ein gut kontrollierbarer Abstand macht die Beobachtungen vergleichbar. Erst wiederholte Sitzungsdaten verändern Distanz oder Schwierigkeit.",
  },
  "goal.loose_leash_walking": {
    instruction: (dogName) =>
      `Beginne in einem ruhigen Abschnitt. Bestätige, wenn sich ${dogName} freiwillig an dir orientiert, und gehe weiter. Wird die Leine straff, bleibst du stehen und setzt erst bei lockerer Leine fort.`,
    measurement: (repetitions) =>
      `${repetitions} Abschnitte: lockere Leine jeweils direkt erfassen`,
    stage: "Lockere Leine unter niedriger Ablenkung",
    title: "Lockere Leine im ruhigen Abschnitt",
    unit: "Abschnitte",
    why: "Eine ruhige, vergleichbare Strecke zeigt, ob Orientierung und Leinenführung stabiler werden. Erst wiederholte Sitzungsdaten verändern die Schwierigkeit.",
  },
  "goal.recall": {
    instruction: (dogName) =>
      `Arbeite auf kurzer, gesicherter Distanz. Gib dein Rückrufsignal einmal, bestätige ${dogName}s sofortiges Umdrehen und belohne die vollständige Rückkehr bei dir. Setze danach ruhig neu an.`,
    measurement: (repetitions) =>
      `${repetitions} Rückrufe: sofortiges Umdrehen und vollständige Rückkehr erfassen`,
    stage: "Rückruf auf kurzer Distanz bei niedriger Ablenkung",
    title: "Kurzer, klarer Rückruf",
    unit: "Rückrufe",
    why: "Kurze Distanz und niedrige Ablenkung trennen das Rückrufsignal zunächst von konkurrierenden Reizen. Erst wiederholte Sitzungsdaten verändern Distanz oder Schwierigkeit.",
  },
};

const fallback: TrainingPresentation = {
  instruction: (dogName) =>
    `Führe den aktuellen Trainingsschritt mit ${dogName} in einer gut kontrollierbaren Situation aus und erfasse das Ergebnis direkt nach jedem Versuch.`,
  measurement: (repetitions) =>
    `${repetitions} Versuche: Ergebnis jeweils direkt erfassen`,
  stage: "Aktueller Trainingsschritt unter niedriger Ablenkung",
  title: "Aktueller Trainingsblock",
  unit: "Versuche",
  why: "Vergleichbare Bedingungen machen Veränderungen messbar. Erst wiederholte Sitzungsdaten verändern die Schwierigkeit.",
};

const englishPresentations: Record<string, TrainingPresentation> = {
  "goal.calm_engagement": {
    instruction: (dogName) =>
      `Choose enough distance for ${dogName} to notice the encounter and still respond to you. Mark calm orientation back to you, and add distance if responsiveness drops.`,
    measurement: (repetitions) =>
      `${repetitions} encounters: record calm orientation immediately`,
    stage: "Calm orientation at a manageable distance",
    title: "Responsive around encounters",
    unit: "encounters",
    why: "A manageable distance keeps observations comparable. Distance or difficulty changes only after repeated session evidence.",
  },
  "goal.loose_leash_walking": {
    instruction: (dogName) =>
      `Start in a quiet stretch. Mark when ${dogName} voluntarily orients to you and continue. If the lead tightens, pause and resume once it is loose.`,
    measurement: (repetitions) =>
      `${repetitions} sections: record loose-lead success immediately`,
    stage: "Loose lead under low distraction",
    title: "Loose lead in a quiet area",
    unit: "sections",
    why: "A quiet, repeatable route shows whether orientation and lead handling are becoming stable. Difficulty changes only from repeated session evidence.",
  },
  "goal.recall": {
    instruction: (dogName) =>
      `Work at a short, secured distance. Give the recall cue once, mark ${dogName}'s immediate turn, and reward the complete return to you. Reset calmly before the next repetition.`,
    measurement: (repetitions) =>
      `${repetitions} recalls: record the immediate turn and complete return`,
    stage: "Recall at short distance under low distraction",
    title: "Short, clear recall",
    unit: "recalls",
    why: "Short distance and low distraction isolate the recall cue from competing stimuli. Distance or difficulty changes only after repeated session evidence.",
  },
};

const englishFallback: TrainingPresentation = {
  instruction: (dogName) =>
    `Run the current training step with ${dogName} in a controlled situation and record each result immediately.`,
  measurement: (repetitions) =>
    `${repetitions} attempts: record each result immediately`,
  stage: "Current training step under low distraction",
  title: "Current training block",
  unit: "attempts",
  why: "Comparable conditions make change measurable. Difficulty changes only from repeated session evidence.",
};

export function trainingPresentation(
  product: Pick<ProductDashboard, "goal">,
  locale: "de-CH" | "en" = "de-CH",
): TrainingPresentation {
  return locale === "en"
    ? (englishPresentations[product.goal] ?? englishFallback)
    : (presentations[product.goal] ?? fallback);
}
