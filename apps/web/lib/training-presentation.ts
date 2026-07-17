import type { ProductDashboard } from "./product";

interface TrainingPresentation {
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

export function trainingPresentation(
  product: Pick<ProductDashboard, "goal">,
): TrainingPresentation {
  return presentations[product.goal] ?? fallback;
}
