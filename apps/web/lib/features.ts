function featureFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

export const dogosFeatures = {
  live: featureFlag(process.env.NEXT_PUBLIC_DOGOS_FEATURE_LIVE, false),
  professionalMarketplace: featureFlag(
    process.env.NEXT_PUBLIC_DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE,
    false,
  ),
  vod: featureFlag(process.env.NEXT_PUBLIC_DOGOS_FEATURE_VOD, true),
} as const;
