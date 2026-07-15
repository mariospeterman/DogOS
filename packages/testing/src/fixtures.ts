import type {
  Anamnesis,
  BreedContext,
  Measurement,
  SessionEvidence,
} from "@dogos/contracts";
import type { SafetyAssessmentInput } from "@dogos/safety-engine";

export interface LocalizedOwnerCase {
  locale: "de-CH" | "en";
  currency: "CHF" | "EUR";
  jurisdiction: "CH" | "DE";
  answers: {
    recentBite: "nein" | "no";
    suspectedPain: "nein" | "no";
    suddenChange: "nein" | "no";
    concern: "zieht_an_der_leine" | "pulls_on_leash";
    goal: "lockere_leine" | "loose_leash";
  };
}

export const germanOwnerCase: LocalizedOwnerCase = {
  locale: "de-CH",
  currency: "CHF",
  jurisdiction: "CH",
  answers: {
    recentBite: "nein",
    suspectedPain: "nein",
    suddenChange: "nein",
    concern: "zieht_an_der_leine",
    goal: "lockere_leine",
  },
};

export const englishOwnerCase: LocalizedOwnerCase = {
  locale: "en",
  currency: "EUR",
  jurisdiction: "DE",
  answers: {
    recentBite: "no",
    suspectedPain: "no",
    suddenChange: "no",
    concern: "pulls_on_leash",
    goal: "loose_leash",
  },
};

const answerCode = {
  nein: "answer.no",
  no: "answer.no",
  zieht_an_der_leine: "concern.leash_pulling",
  pulls_on_leash: "concern.leash_pulling",
  lockere_leine: "goal.loose_leash_walking",
  loose_leash: "goal.loose_leash_walking",
} as const;

export interface CanonicalCase {
  presentationLocale: string;
  currency: string;
  jurisdiction: string;
  goalFamily: string;
  safetyInput: SafetyAssessmentInput;
  progressSessions: SessionEvidence[];
}

function progressMeasurement(
  metricCode: Measurement["metricCode"],
  value: number | boolean,
  measuredAt: string,
): Measurement {
  const units: Partial<Record<Measurement["metricCode"], string | null>> = {
    "metric.success_rate": "unit.percent",
    "metric.food_acceptance": null,
    "metric.recovery_seconds": "unit.second",
  };
  return {
    metricCode,
    value,
    unit: units[metricCode] ?? null,
    unknown: false,
    source: "owner_report",
    method: "method.session_summary",
    measuredAt,
    quality: "high",
  };
}

function progressSessions(): SessionEvidence[] {
  return [1, 2, 3].map((sequence) => {
    const completedAt = `2026-07-${(10 + sequence).toString().padStart(2, "0")}T10:00:00.000Z`;
    return {
      sessionId: `91000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
      completedAt,
      measurements: [
        progressMeasurement("metric.success_rate", 85, completedAt),
        progressMeasurement("metric.food_acceptance", true, completedAt),
        progressMeasurement("metric.recovery_seconds", 30, completedAt),
      ],
      ownerCheckin: null,
      observations: [],
    };
  });
}

export function canonicalizeLocalizedCase(
  input: LocalizedOwnerCase,
  breedContext: BreedContext = {
    status: "unknown",
    breeds: [],
    sourcedPhysicalConstraintCodes: [],
  },
): CanonicalCase {
  const anamnesis: Anamnesis = {
    id: "92000000-0000-4000-8000-000000000001",
    version: 1,
    completed: true,
    answers: [
      {
        state: "answered",
        questionCode: "question.recent_bite",
        questionVersion: 1,
        canonicalAnswerCode: answerCode[input.answers.recentBite],
        evidenceId: "92000000-0000-4000-8000-000000000002",
      },
    ],
    behaviorConcerns: [
      {
        id: "92000000-0000-4000-8000-000000000003",
        concernCode: answerCode[input.answers.concern],
        triggerCodes: ["trigger.walking_forward"],
        frequencyCode: "frequency.often",
        intensity: 3,
        evidenceIds: ["92000000-0000-4000-8000-000000000004"],
      },
    ],
    safetyEvents: [],
  };
  return {
    presentationLocale: input.locale,
    currency: input.currency,
    jurisdiction: input.jurisdiction,
    goalFamily: answerCode[input.answers.goal],
    safetyInput: {
      dogProfile: {
        id: "93000000-0000-4000-8000-000000000001",
        birthDateEstimate: "2022-04-01",
        developmentStage: "adult",
        sex: "female",
        neuterStatus: "neutered",
        weightKg: 18,
        breedContext,
      },
      healthContext: {
        reportedConditionCodes: [],
        medicationCodes: [],
        suspectedPain: answerCode[input.answers.suspectedPain] !== "answer.no",
        suddenBehaviorChange:
          answerCode[input.answers.suddenChange] !== "answer.no",
        physicalConstraintCodes: [],
        evidenceIds: ["93000000-0000-4000-8000-000000000002"],
      },
      householdContext: {
        childrenPresent: false,
        otherAnimalCodes: [],
        environmentCode: "environment.home_low_distraction",
        availableEquipmentCodes: [
          "equipment.marker",
          "equipment.food_reward",
          "equipment.leash",
          "equipment.harness",
        ],
        managementConstraintCodes: [],
      },
      anamnesis,
      observations: [],
      currentEnvironmentCode: "environment.home_low_distraction",
      supportedEnvironmentCodes: ["environment.home_low_distraction"],
      requiredSafetyQuestionCodes: ["question.recent_bite"],
    },
    progressSessions: progressSessions(),
  };
}
