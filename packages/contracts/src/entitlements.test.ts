import { describe, expect, it } from "vitest";

import { capabilitiesForTier, subscriptionTiers } from "./entitlements.js";

describe("tier capabilities", () => {
  it("keeps every tier explicit and monotonically bounded", () => {
    expect(subscriptionTiers).toEqual(["freemium", "plus", "pro", "ultra"]);
    const limits = subscriptionTiers.map(
      (tier) => capabilitiesForTier(tier).coachingMessagesPerDay,
    );
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    expect(capabilitiesForTier("freemium").videoAnalysesPerMonth).toBe(0);
  });
});
