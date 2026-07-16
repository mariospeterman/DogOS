import { describe, expect, it } from "vitest";

import {
  buildShareUrl,
  buildWhatsAppStartUrl,
  normalizeReferralCode,
} from "./distribution.js";

describe("distribution links", () => {
  it("keeps referral codes non-authoritative and bounded", () => {
    expect(normalizeReferralCode(" ab12cd ")).toBe("AB12CD");
    expect(normalizeReferralCode("../../account")).toBeNull();
    expect(normalizeReferralCode("short")).toBeNull();
  });

  it("preserves existing WhatsApp parameters and encodes the start message", () => {
    const url = new URL(
      buildWhatsAppStartUrl("https://wa.me/15551617622?app_absent=0", {
        locale: "en",
        referralCode: "DOGOS26",
      }),
    );
    expect(url.searchParams.get("app_absent")).toBe("0");
    expect(url.searchParams.get("text")).toBe("Start DogOS · Invite DOGOS26");
  });

  it("shares the canonical web entry without account data", () => {
    expect(buildShareUrl("https://app.dogos.example/app/today")).toBe(
      "https://app.dogos.example/?source=share",
    );
  });
});
