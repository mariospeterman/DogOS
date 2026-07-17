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
  "step.calm_engagement_low_distraction": {
    "de-CH": "ruhige Orientierung mit gut kontrollierbarem Abstand",
    en: "calm engagement at a manageable distance",
  },
  "step.loose_leash_low_distraction": {
    "de-CH": "lockere Leine unter niedriger Ablenkung",
    en: "loose-leash handling under low distraction",
  },
  "step.low_distraction_baseline": {
    "de-CH": "Orientierung unter niedriger Ablenkung",
    en: "orientation under low distraction",
  },
  "step.recall_short_distance": {
    "de-CH": "Rückruf auf kurzer Distanz bei niedriger Ablenkung",
    en: "short-distance recall under low distraction",
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
