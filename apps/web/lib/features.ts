import { publicFeatureConfig } from "@dogos/config/features";

export const dogosFeatures = publicFeatureConfig({
  DOGOS_FEATURE_LIVE: process.env.NEXT_PUBLIC_DOGOS_FEATURE_LIVE,
  DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE:
    process.env.NEXT_PUBLIC_DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE,
  DOGOS_FEATURE_VOD: process.env.NEXT_PUBLIC_DOGOS_FEATURE_VOD,
});
