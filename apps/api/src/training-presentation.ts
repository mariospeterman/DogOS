const goalLabels: Record<string, Record<"de-CH" | "en", string>> = {
  "goal.calm_engagement": {
    "de-CH": "ruhiger Orientierung bei Begegnungen",
    en: "calm engagement around encounters",
  },
  "goal.loose_leash_walking": {
    "de-CH": "lockerer Leine auf Alltagswegen",
    en: "a loose leash on daily walks",
  },
  "goal.recall": {
    "de-CH": "zuverlässigem Rückruf bei wenig Ablenkung",
    en: "reliable recall under low distraction",
  },
};

const stageLabels: Record<string, Record<"de-CH" | "en", string>> = {
  "step.low_distraction_baseline": {
    "de-CH": "Orientierung unter niedriger Ablenkung",
    en: "orientation under low distraction",
  },
};

function label(
  labels: Record<string, Record<"de-CH" | "en", string>>,
  code: string | null | undefined,
  locale: "de-CH" | "en",
  fallback: Record<"de-CH" | "en", string>,
): string {
  return code === undefined || code === null
    ? fallback[locale]
    : (labels[code]?.[locale] ?? fallback[locale]);
}

export function presentGoal(
  code: string | null | undefined,
  locale: "de-CH" | "en",
): string {
  return label(goalLabels, code, locale, {
    "de-CH": "dem aktuellen Trainingsziel",
    en: "the current training goal",
  });
}

export function presentStage(
  code: string | null | undefined,
  locale: "de-CH" | "en",
): string {
  return label(stageLabels, code, locale, {
    "de-CH": "dem aktuellen Trainingsblock",
    en: "the current training block",
  });
}
