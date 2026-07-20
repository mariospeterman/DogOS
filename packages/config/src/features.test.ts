import { describe, expect, it } from "vitest";

import {
  loadDogosReleaseConfig,
  privatePilotFeatureDefaults,
} from "./features.js";

describe("DogOS release feature config", () => {
  it("defaults to the private pilot hard scope freeze", () => {
    const release = loadDogosReleaseConfig({});

    expect(release.channel).toBe("private_pilot");
    expect(release.pilotGoalFamily).toBe("goal.loose_leash_walking");
    expect(release.features).toMatchObject({
      coach: true,
      handoff: true,
      live: false,
      professionalMarketplace: false,
      runtimeWebSearch: false,
      vectorMemory: false,
      vod: true,
    });
  });

  it("parses explicit boolean overrides for controlled smoke tests", () => {
    const release = loadDogosReleaseConfig({
      DOGOS_FEATURE_LIVE: "true",
      DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE: "1",
      DOGOS_RELEASE_CHANNEL: "local",
    });

    expect(release.channel).toBe("local");
    expect(release.features.live).toBe(true);
    expect(release.features.professionalMarketplace).toBe(true);
    expect(privatePilotFeatureDefaults.live).toBe(false);
  });
});
