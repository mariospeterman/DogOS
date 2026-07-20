import { z } from "zod";

const flag = (defaultValue: boolean) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === "") return defaultValue;
      if (typeof value === "boolean") return value;
      if (typeof value !== "string") return value;
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
      return value;
    }, z.boolean())
    .default(defaultValue);

const releaseChannelSchema = z
  .enum(["local", "private_pilot", "preview", "production"])
  .default("private_pilot");

export const dogosFeatureSchema = z.object({
  coach: flag(true),
  memory: flag(true),
  plan: flag(true),
  sessions: flag(true),
  progress: flag(true),
  vod: flag(true),
  handoff: flag(true),
  professionalReview: flag(true),
  live: flag(false),
  highFrequencyCv: flag(false),
  customDogPose: flag(false),
  family360: flag(false),
  professionalMarketplace: flag(false),
  calcom: flag(false),
  stripeConnect: flag(false),
  referrals: flag(false),
  ambassadors: flag(false),
  affiliates: flag(false),
  knowledgeScout: flag(false),
  runtimeWebSearch: flag(false),
  vectorMemory: flag(false),
  nativeWrappers: flag(false),
});

export type DogOSFeatureConfig = z.infer<typeof dogosFeatureSchema>;

export interface DogOSReleaseConfig {
  channel: z.infer<typeof releaseChannelSchema>;
  features: DogOSFeatureConfig;
  pilotGoalFamily: string;
}

export const privatePilotFeatureDefaults = dogosFeatureSchema.parse({});

export function loadDogosReleaseConfig(
  input: Record<string, string | undefined>,
): DogOSReleaseConfig {
  return {
    channel: releaseChannelSchema.parse(input.DOGOS_RELEASE_CHANNEL),
    features: dogosFeatureSchema.parse({
      ambassadors: input.DOGOS_FEATURE_AMBASSADORS,
      affiliates: input.DOGOS_FEATURE_AFFILIATES,
      calcom: input.DOGOS_FEATURE_CALCOM,
      coach: input.DOGOS_FEATURE_COACH,
      customDogPose: input.DOGOS_FEATURE_CUSTOM_DOG_POSE,
      family360: input.DOGOS_FEATURE_FAMILY_360,
      handoff: input.DOGOS_FEATURE_HANDOFF,
      highFrequencyCv: input.DOGOS_FEATURE_HIGH_FREQUENCY_CV,
      knowledgeScout: input.DOGOS_FEATURE_KNOWLEDGE_SCOUT,
      live: input.DOGOS_FEATURE_LIVE,
      memory: input.DOGOS_FEATURE_MEMORY,
      nativeWrappers: input.DOGOS_FEATURE_NATIVE_WRAPPERS,
      plan: input.DOGOS_FEATURE_PLAN,
      professionalMarketplace: input.DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE,
      professionalReview: input.DOGOS_FEATURE_PROFESSIONAL_REVIEW,
      progress: input.DOGOS_FEATURE_PROGRESS,
      referrals: input.DOGOS_FEATURE_REFERRALS,
      runtimeWebSearch: input.DOGOS_FEATURE_RUNTIME_WEB_SEARCH,
      sessions: input.DOGOS_FEATURE_SESSIONS,
      stripeConnect: input.DOGOS_FEATURE_STRIPE_CONNECT,
      vectorMemory: input.DOGOS_FEATURE_VECTOR_MEMORY,
      vod: input.DOGOS_FEATURE_VOD,
    }),
    pilotGoalFamily:
      input.DOGOS_PILOT_GOAL_FAMILY ?? "goal.loose_leash_walking",
  };
}

export function publicFeatureConfig(
  input: Record<string, string | undefined>,
): Pick<DogOSFeatureConfig, "live" | "professionalMarketplace" | "vod"> {
  const release = loadDogosReleaseConfig(input);
  return {
    live: release.features.live,
    professionalMarketplace: release.features.professionalMarketplace,
    vod: release.features.vod,
  };
}
