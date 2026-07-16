import { z } from "zod";

import {
  canonicalCodeSchema,
  entityIdSchema,
  isoTimestampSchema,
} from "./common.js";

export const acquisitionChannelSchema = z.enum([
  "organic",
  "whatsapp_share",
  "app_store",
  "play_store",
  "trainer_referral",
  "partner_referral",
  "event",
  "paid_campaign",
]);

export const growthInviteSchema = z.strictObject({
  id: entityIdSchema,
  publicCodeHash: z.string().regex(/^[a-f0-9]{64}$/),
  issuerUserId: entityIdSchema.nullable(),
  campaignCode: canonicalCodeSchema,
  createdAt: isoTimestampSchema,
  expiresAt: isoTimestampSchema,
  maxRedemptions: z.number().int().positive(),
  status: z.enum(["active", "expired", "revoked"]),
});

export const growthAttributionSchema = z.strictObject({
  id: entityIdSchema,
  inviteId: entityIdSchema.nullable(),
  channel: acquisitionChannelSchema,
  anonymousVisitorHash: z.string().regex(/^[a-f0-9]{64}$/),
  campaignCode: canonicalCodeSchema.nullable(),
  landingPath: z.string().regex(/^\/[a-z0-9/_-]*$/),
  occurredAt: isoTimestampSchema,
  convertedUserId: entityIdSchema.nullable(),
});

const suitabilitySchema = z.strictObject({
  protocolFit: z.number().min(0).max(100),
  dogContextFit: z.number().min(0).max(100),
  evidenceQuality: z.number().min(0).max(100),
  availability: z.number().min(0).max(100),
});

export const partnerRecommendationCandidateSchema = z.strictObject({
  id: entityIdSchema,
  offerCode: canonicalCodeSchema,
  category: z.enum(["equipment", "food", "trainer_session"]),
  relevanceReasonCodes: z.array(canonicalCodeSchema).min(1).max(6),
  evidenceSourceIds: z.array(entityIdSchema).max(6),
  suitability: suitabilitySchema,
  compensated: z.boolean(),
  disclosure: z.strictObject({
    "de-CH": z.string().min(1).max(120),
    en: z.string().min(1).max(120),
  }),
  redirectTargetId: entityIdSchema,
  status: z.enum(["active", "unavailable"]),
});

export type AcquisitionChannel = z.infer<typeof acquisitionChannelSchema>;
export type GrowthInvite = z.infer<typeof growthInviteSchema>;
export type GrowthAttribution = z.infer<typeof growthAttributionSchema>;
export type PartnerRecommendationCandidate = z.infer<
  typeof partnerRecommendationCandidateSchema
>;

export function rankPartnerRecommendations(
  input: unknown[],
): PartnerRecommendationCandidate[] {
  const candidates = input
    .map((candidate) => partnerRecommendationCandidateSchema.parse(candidate))
    .filter((candidate) => candidate.status === "active");

  const score = (candidate: PartnerRecommendationCandidate) =>
    candidate.suitability.protocolFit * 0.4 +
    candidate.suitability.dogContextFit * 0.25 +
    candidate.suitability.evidenceQuality * 0.2 +
    candidate.suitability.availability * 0.15;

  return candidates.sort(
    (left, right) =>
      score(right) - score(left) ||
      left.offerCode.localeCompare(right.offerCode),
  );
}
