import { describe, expect, it } from "vitest";

import {
  growthAttributionSchema,
  growthInviteSchema,
  partnerRecommendationCandidateSchema,
  rankPartnerRecommendations,
} from "./distribution.js";

const candidate = (id: string, offerCode: string, protocolFit: number) => ({
  id,
  offerCode,
  category: "equipment",
  relevanceReasonCodes: ["reason.protocol_equipment_fit"],
  evidenceSourceIds: [],
  suitability: {
    protocolFit,
    dogContextFit: 80,
    evidenceQuality: 70,
    availability: 100,
  },
  compensated: true,
  disclosure: {
    "de-CH": "Affiliate-Link: DogOS kann eine Provision erhalten.",
    en: "Affiliate link: DogOS may receive a commission.",
  },
  redirectTargetId: "93000000-0000-4000-8000-000000000001",
  status: "active",
});

describe("growth and partner contracts", () => {
  it("stores only a hash for a public invite code", () => {
    const invite = growthInviteSchema.parse({
      id: "92000000-0000-4000-8000-000000000001",
      publicCodeHash: "a".repeat(64),
      issuerUserId: null,
      campaignCode: "campaign.owner_share",
      createdAt: "2026-07-16T20:00:00.000Z",
      expiresAt: "2026-08-16T20:00:00.000Z",
      maxRedemptions: 20,
      status: "active",
    });
    expect(invite).not.toHaveProperty("publicCode");
  });

  it("rejects personal or external data in attribution landing paths", () => {
    expect(() =>
      growthAttributionSchema.parse({
        id: "92000000-0000-4000-8000-000000000002",
        inviteId: null,
        channel: "whatsapp_share",
        anonymousVisitorHash: "b".repeat(64),
        campaignCode: null,
        landingPath: "/?email=owner@example.com",
        occurredAt: "2026-07-16T20:01:00.000Z",
        convertedUserId: null,
      }),
    ).toThrow();
  });

  it("ranks by fit while excluding commission amount", () => {
    const lower = candidate(
      "94000000-0000-4000-8000-000000000001",
      "offer.long_line.standard",
      70,
    );
    const higher = candidate(
      "94000000-0000-4000-8000-000000000002",
      "offer.long_line.working",
      95,
    );
    expect(rankPartnerRecommendations([lower, higher])[0]?.offerCode).toBe(
      "offer.long_line.working",
    );
    expect(() =>
      partnerRecommendationCandidateSchema.parse({
        ...higher,
        commissionMinor: 5000,
      }),
    ).toThrow();
  });
});
