import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadApiEnv } from "./api.js";

describe("API environment", () => {
  it("documents critical real-provider variables in .env.example", () => {
    const example = readFileSync(
      new URL("../../../.env.example", import.meta.url),
      "utf8",
    );

    for (const name of [
      "DATABASE_URL",
      "DIRECT_URL",
      "DOGOS_AI_POLICY_VERSION",
      "DOGOS_RELEASE_CHANNEL",
      "DOGOS_PILOT_GOAL_FAMILY",
      "DOGOS_FEATURE_LIVE",
      "DOGOS_FEATURE_PROFESSIONAL_MARKETPLACE",
      "DOGOS_AI_RELEASE_MANIFESTS_JSON",
      "DOGOS_AI_RELEASE_MANIFEST_COACH_CHAT",
      "DOGOS_TEXT_COACH_MODEL",
      "DOGOS_VOD_PROVIDER",
      "DOGOS_MODEL_SNAPSHOT_APPROVAL",
      "DOGOS_LIVE_PROVIDER",
      "DOGOS_PARTNER_MARKETPLACE_ENABLED",
      "CAL_API_VERSION",
      "GOOGLE_APPLICATION_CREDENTIALS",
      "GOOGLE_VERTEX_ACCESS_TOKEN",
      "GOOGLE_VERTEX_AUTH_MODE",
      "LIVEKIT_API_KEY",
      "LIVEKIT_API_SECRET",
      "LIVEKIT_URL",
      "OPENAI_API_KEY",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_STORAGE_BUCKET",
      "STRIPE_WEBHOOK_SECRET",
      "REWARDFUL_API_SECRET",
    ]) {
      expect(example).toContain(`${name}=`);
    }
  });

  it("passes server credentials through Turborepo in development", () => {
    const turboConfig = JSON.parse(
      readFileSync(new URL("../../../turbo.json", import.meta.url), "utf8"),
    ) as {
      tasks?: Record<string, { passThroughEnv?: string[] }>;
    };
    const environment = turboConfig.tasks?.["@dogos/api#dev"]?.passThroughEnv;

    expect(environment).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "CAL_API_VERSION",
        "DOGOS_LLM_MODE",
        "DOGOS_AI_POLICY_VERSION",
        "DOGOS_AI_RELEASE_MANIFESTS_JSON",
        "DOGOS_AI_RELEASE_MANIFEST_COACH_CHAT",
        "DOGOS_MODEL_SNAPSHOT_APPROVAL",
        "DOGOS_TEXT_COACH_MODEL",
        "DOGOS_VOD_PROVIDER",
        "DOGOS_LIVE_PROVIDER",
        "DOGOS_PARTNER_MARKETPLACE_ENABLED",
        "GOOGLE_APPLICATION_CREDENTIALS",
        "GOOGLE_VERTEX_ACCESS_TOKEN",
        "GOOGLE_VERTEX_AUTH_MODE",
        "LIVEKIT_API_KEY",
        "LIVEKIT_API_SECRET",
        "LIVEKIT_URL",
        "OPENAI_API_KEY",
        "REWARDFUL_API_SECRET",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_STORAGE_BUCKET",
        "STRIPE_SECRET_KEY",
      ]),
    );
  });

  it("provides explicit local-only defaults", () => {
    const environment = loadApiEnv({ NODE_ENV: "test" });

    expect(environment.API_PORT).toBe(4000);
  });

  it("requires complete Supabase credentials in production", () => {
    expect(() =>
      loadApiEnv({
        DOGOS_ENV: "production",
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@db.example/postgres",
        SIGNED_LINK_SECRET: "a-production-secret-that-is-long-enough",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prod_value",
        WEB_ORIGIN: "https://dogos.example",
      }),
    ).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("requires production secrets instead of applying development defaults", () => {
    expect(() =>
      loadApiEnv({
        DOGOS_ENV: "production",
        NODE_ENV: "production",
        WEB_ORIGIN: "https://dogos.example",
      }),
    ).toThrow(/SIGNED_LINK_SECRET/);
  });
});
