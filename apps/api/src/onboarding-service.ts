import { createHash, randomUUID } from "node:crypto";
import { developmentProtocols } from "@dogos/knowledge";
import {
  OnboardingRepository,
  type DogProductContext,
  type OnboardingFacts,
  type OnboardingIds,
} from "@dogos/database";
import { assessSafety, developmentSafetyRuleSet } from "@dogos/safety-engine";
import { generatePlan } from "@dogos/training-engine";
import type { Anamnesis, SafetyEvent } from "@dogos/contracts";
import type { ConversationSnapshot, ProviderContact } from "@dogos/whatsapp";

const goalByChoice = {
  "goal_selection.choice.1": "goal.loose_leash_walking",
  "goal_selection.choice.2": "goal.recall",
  "goal_selection.choice.3": "goal.calm_engagement",
} as const;

const concernByChoice = {
  "behavior_concern.choice.1": "concern.leash_pulling",
  "behavior_concern.choice.2": "concern.recall_unreliable",
  "behavior_concern.choice.3": "concern.encounter_arousal",
} as const;

function choice<T extends Record<string, unknown>, F>(
  mapping: T,
  value: string | undefined,
  fallback: F,
): T[keyof T] | F {
  return value !== undefined && value in mapping
    ? mapping[value as keyof T]
    : fallback;
}

function textAnswer(value: string | undefined, state: string): string {
  const prefix = `${state}.text:`;
  if (value === undefined || !value.startsWith(prefix)) {
    throw new Error(`ONBOARDING_${state.toUpperCase()}_REQUIRED`);
  }
  return value.slice(prefix.length).trim();
}

function canonicalFacts(snapshot: ConversationSnapshot): OnboardingFacts {
  const answers = snapshot.answers;
  const goalCode = choice(
    goalByChoice,
    answers.goal_selection,
    "goal.loose_leash_walking",
  );
  const goalLabels: Record<string, Record<"de-CH" | "en", string>> = {
    "goal.calm_engagement": {
      "de-CH": "Ruhige Orientierung bei Begegnungen",
      en: "Calm engagement around encounters",
    },
    "goal.loose_leash_walking": {
      "de-CH": "Lockere Leine auf Alltagswegen",
      en: "A loose leash on daily walks",
    },
    "goal.recall": {
      "de-CH": "Zuverlässiger Rückruf bei wenig Ablenkung",
      en: "Reliable recall under low distraction",
    },
  };
  return {
    ageBand: choice(
      {
        "dog_history.choice.1": "puppy",
        "dog_history.choice.2": "adult",
        "dog_history.choice.3": "senior",
      } as const,
      answers.dog_history,
      "unknown",
    ),
    baselineSuccessRate: choice(
      {
        "baseline_collection.choice.1": 20,
        "baseline_collection.choice.2": 50,
        "baseline_collection.choice.3": 80,
      } as const,
      answers.baseline_collection,
      50,
    ),
    behaviorConcernCode: choice(
      concernByChoice,
      answers.behavior_concern,
      "concern.leash_pulling",
    ),
    behaviorConcernDescription:
      snapshot.notes?.concern_description?.trim() || null,
    dogName: textAnswer(answers.dog_identity, "dog_identity"),
    dogProfileSummary: snapshot.notes?.dog_profile_summary?.trim() || null,
    equipmentCodes:
      answers.training_setup === "training_setup.choice.1"
        ? (developmentProtocols.find(
            (protocol) => protocol.goalFamily === goalCode,
          )?.requiredEquipmentCodes ?? [])
        : [],
    goalCode,
    goalText:
      snapshot.notes?.goal_description?.trim() ||
      goalLabels[goalCode]?.[snapshot.locale] ||
      goalCode,
    householdSize:
      answers.household_context === "household_context.choice.1"
        ? "single"
        : answers.household_context === "household_context.choice.2"
          ? "multiple"
          : "unknown",
    locale: snapshot.locale,
    safetyEvent:
      answers.safety_screen === "safety_screen.choice.2"
        ? "snap"
        : answers.safety_screen === "safety_screen.choice.3"
          ? "bite_child"
          : "none",
    suspectedPain: answers.health_screen === "health_screen.choice.2",
  };
}

function ids(): OnboardingIds {
  return {
    anamnesisId: randomUUID(),
    baselineMeasurementId: randomUUID(),
    behaviorConcernId: randomUUID(),
    dogId: randomUUID(),
    goalId: randomUUID(),
    goalVersionId: randomUUID(),
    healthContextId: randomUUID(),
    planId: randomUUID(),
    riskAssessmentId: randomUUID(),
    safetyEventId: randomUUID(),
  };
}

export class OnboardingService {
  constructor(private readonly repository: OnboardingRepository) {}

  findByContact(contactId: string): Promise<DogProductContext | null> {
    return this.repository.findByContact(contactId);
  }

  async project(
    contact: ProviderContact,
    snapshot: ConversationSnapshot,
  ): Promise<DogProductContext> {
    if (contact.userId === null || contact.householdId === null) {
      throw new Error("LINKED_CONTACT_REQUIRED");
    }
    return this.projectSource(
      {
        actorUserId: contact.userId,
        channel: "whatsapp",
        contactId: contact.id,
        householdId: contact.householdId,
        ownerUserId: null,
      },
      snapshot,
    );
  }

  projectOwner(
    input: { actorUserId: string; householdId: string },
    snapshot: ConversationSnapshot,
  ): Promise<DogProductContext> {
    return this.projectSource(
      {
        ...input,
        channel: "pwa",
        contactId: null,
        ownerUserId: input.actorUserId,
      },
      snapshot,
    );
  }

  private async projectSource(
    source: {
      actorUserId: string;
      channel: "pwa" | "whatsapp";
      contactId: string | null;
      householdId: string;
      ownerUserId: string | null;
    },
    snapshot: ConversationSnapshot,
  ): Promise<DogProductContext> {
    const existing =
      source.contactId === null
        ? await this.repository.findByOwner(source.actorUserId)
        : await this.repository.findByContact(source.contactId);
    if (existing !== null && existing.planStatus !== "setup_required") {
      return existing;
    }
    const facts = canonicalFacts(snapshot);
    const entityIds = ids();
    const safetyEvent: SafetyEvent | null =
      facts.safetyEvent === "none"
        ? null
        : {
            childInvolved: facts.safetyEvent === "bite_child",
            eventCode:
              facts.safetyEvent === "snap"
                ? "safety.snap"
                : "safety.child_involved",
            evidenceIds: [],
            id: entityIds.safetyEventId!,
            injuryOccurred: null,
            occurredAt: null,
            recency: "recent",
            severity: facts.safetyEvent === "snap" ? 2 : 5,
          };
    if (safetyEvent === null) entityIds.safetyEventId = null;
    const safetyAnswerId = randomUUID();
    const anamnesis: Anamnesis = {
      answers: [
        {
          canonicalAnswerCode:
            facts.safetyEvent === "none" ? "answer.no" : "answer.yes",
          evidenceId: safetyAnswerId,
          questionCode: "question.recent_bite",
          questionVersion: 1,
          state: "answered",
        },
      ],
      behaviorConcerns: [
        {
          concernCode: facts.behaviorConcernCode,
          evidenceIds: [],
          frequencyCode: null,
          id: entityIds.behaviorConcernId,
          intensity: null,
          triggerCodes: [],
        },
      ],
      completed: true,
      id: entityIds.anamnesisId,
      safetyEvents: safetyEvent === null ? [] : [safetyEvent],
      version: 1,
    };
    const safety = assessSafety({
      anamnesis,
      currentEnvironmentCode: "environment.outdoor_low_distraction",
      dogProfile: {
        birthDateEstimate: null,
        breedContext: {
          breeds: [],
          sourcedPhysicalConstraintCodes: [],
          status: "unknown",
        },
        developmentStage: facts.ageBand,
        id: entityIds.dogId,
        neuterStatus: "unknown",
        sex: "unknown",
        weightKg: null,
      },
      healthContext: {
        evidenceIds: facts.suspectedPain ? [entityIds.healthContextId] : [],
        medicationCodes: [],
        physicalConstraintCodes: [],
        reportedConditionCodes: [],
        suddenBehaviorChange: facts.suspectedPain,
        suspectedPain: facts.suspectedPain,
      },
      householdContext: {
        availableEquipmentCodes: facts.equipmentCodes,
        childrenPresent: null,
        environmentCode: "environment.outdoor_low_distraction",
        managementConstraintCodes: [],
        otherAnimalCodes: [],
      },
      observations: [],
      requiredSafetyQuestionCodes: ["question.recent_bite"],
      supportedEnvironmentCodes: ["environment.outdoor_low_distraction"],
    });
    const protocol = developmentProtocols.find(
      (candidate) => candidate.goalFamily === facts.goalCode,
    );
    const now = new Date();
    const firstSession = new Date(now);
    firstSession.setUTCDate(firstSession.getUTCDate() + 1);
    firstSession.setUTCHours(7, 0, 0, 0);
    const generated =
      protocol === undefined
        ? null
        : generatePlan({
            createdAt: now.toISOString(),
            eligibilityContext: {
              activeRuleSetVersion: developmentSafetyRuleSet.version,
              baselineMeasurements: [
                {
                  evidenceId: entityIds.baselineMeasurementId,
                  measurement: {
                    measuredAt: now.toISOString(),
                    method: "method.owner_estimate",
                    metricCode: "metric.success_rate",
                    quality: "moderate",
                    source: "owner_report",
                    unit: "unit.percent",
                    unknown: false,
                    value: facts.baselineSuccessRate,
                  },
                },
              ],
              behaviorConcernCodes: [facts.behaviorConcernCode],
              dogProfile: {
                birthDateEstimate: null,
                breedContext: {
                  breeds: [],
                  sourcedPhysicalConstraintCodes: [],
                  status: "unknown",
                },
                developmentStage: facts.ageBand,
                id: entityIds.dogId,
                neuterStatus: "unknown",
                sex: "unknown",
                weightKg: null,
              },
              evaluatedAt: now.toISOString(),
              healthContext: {
                evidenceIds: facts.suspectedPain
                  ? [entityIds.healthContextId]
                  : [],
                medicationCodes: [],
                physicalConstraintCodes: [],
                reportedConditionCodes: [],
                suddenBehaviorChange: facts.suspectedPain,
                suspectedPain: facts.suspectedPain,
              },
              householdContext: {
                availableEquipmentCodes: facts.equipmentCodes,
                childrenPresent: null,
                environmentCode: "environment.outdoor_low_distraction",
                managementConstraintCodes: [],
                otherAnimalCodes: [],
              },
              jurisdiction: "CH",
              mode: "development",
              ownerProfile: {
                accessibilityConstraintCodes: [],
                availableMinutesPerDay: null,
                capabilityCodes:
                  facts.equipmentCodes.length > 0
                    ? ["capability.marker_delivery"]
                    : [],
                confidence: null,
                experienceLevel: "unknown",
              },
              presentationLocale: facts.locale,
              releaseChannel:
                source.channel === "whatsapp"
                  ? "channel.whatsapp"
                  : "channel.web",
              safetyAssessment: safety,
            },
            mode: "development",
            planId: entityIds.planId,
            planVersion: 1,
            prioritisedGoals: [
              {
                goal: {
                  canonicalGoalType: facts.goalCode,
                  dogId: entityIds.dogId,
                  id: entityIds.goalId,
                  priority: 1,
                  status: "active",
                },
                version: {
                  baseline: { successRate: facts.baselineSuccessRate },
                  environmentCode: "environment.outdoor_low_distraction",
                  escalationConditionCodes: ["escalate.professional_review"],
                  goalId: entityIds.goalId,
                  horizonDays: 21,
                  id: entityIds.goalVersionId,
                  measurementCodes: ["metric.success_rate"],
                  stopConditionCodes: ["stop.safety_escalation"],
                  successCriteria: { consecutiveSessions: 3 },
                  target: { successRate: 80 },
                  version: 1,
                },
              },
            ],
            protocols: [protocol],
            ruleSet: developmentSafetyRuleSet,
            schedule: {
              firstSessionAt: firstSession.toISOString(),
              recoveryAfterSessions: 2,
              sessionsPerStep: 3,
            },
          });
    const plan = generated?.status === "generated" ? generated.plan : null;
    const snapshotHash = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");
    return this.repository.persist({
      actorUserId: source.actorUserId,
      channel: source.channel,
      contactId: source.contactId,
      facts,
      householdId: source.householdId,
      ids: entityIds,
      ownerUserId: source.ownerUserId,
      plan,
      riskAssessment: safety,
      snapshotHash,
    });
  }
}
