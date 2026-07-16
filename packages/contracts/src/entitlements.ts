export const subscriptionTiers = ["freemium", "plus", "pro", "ultra"] as const;
export type SubscriptionTier = (typeof subscriptionTiers)[number];

export interface TierCapabilities {
  coachingMessagesPerDay: number;
  concurrentDogs: number;
  liveCoachingMinutesPerMonth: number;
  planAdjustmentsPerMonth: number;
  videoAnalysesPerMonth: number;
}

export const tierCapabilities: Record<SubscriptionTier, TierCapabilities> = {
  freemium: {
    coachingMessagesPerDay: 12,
    concurrentDogs: 1,
    liveCoachingMinutesPerMonth: 0,
    planAdjustmentsPerMonth: 1,
    videoAnalysesPerMonth: 0,
  },
  plus: {
    coachingMessagesPerDay: 40,
    concurrentDogs: 2,
    liveCoachingMinutesPerMonth: 0,
    planAdjustmentsPerMonth: 4,
    videoAnalysesPerMonth: 2,
  },
  pro: {
    coachingMessagesPerDay: 100,
    concurrentDogs: 5,
    liveCoachingMinutesPerMonth: 60,
    planAdjustmentsPerMonth: 12,
    videoAnalysesPerMonth: 10,
  },
  ultra: {
    coachingMessagesPerDay: 250,
    concurrentDogs: 10,
    liveCoachingMinutesPerMonth: 240,
    planAdjustmentsPerMonth: 30,
    videoAnalysesPerMonth: 30,
  },
};

export function capabilitiesForTier(tier: SubscriptionTier): TierCapabilities {
  return structuredClone(tierCapabilities[tier]);
}
