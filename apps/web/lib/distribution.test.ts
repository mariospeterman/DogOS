import { describe, expect, it } from "vitest";

import { buildShareUrl, normalizeReferralCode } from "./distribution.js";

describe("distribution links", () => {
  it("keeps referral codes non-authoritative and bounded", () => {
    expect(normalizeReferralCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeReferralCode("../../account")).toBeNull();
    expect(normalizeReferralCode("short")).toBeNull();
  });

  it("shares the canonical web entry without account data", () => {
    expect(buildShareUrl("https://app.dogos.example/app/today")).toBe(
      "https://app.dogos.example/?source=share",
    );
  });
});
