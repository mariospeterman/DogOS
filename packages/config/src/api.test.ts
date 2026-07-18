import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { loadApiEnv } from "./api.js";

describe("API environment", () => {
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
        "DOGOS_LLM_MODE",
        "OPENAI_API_KEY",
        "SUPABASE_SECRET_KEY",
        "STRIPE_SECRET_KEY",
      ]),
    );
  });

  it("provides explicit local-only defaults", () => {
    const environment = loadApiEnv({ NODE_ENV: "test" });

    expect(environment.API_PORT).toBe(4000);
  });

  it("requires Supabase credentials in production", () => {
    expect(() =>
      loadApiEnv({
        DOGOS_ENV: "production",
        NODE_ENV: "production",
        SIGNED_LINK_SECRET: "a-production-secret-that-is-long-enough",
        WEB_ORIGIN: "https://dogos.example",
      }),
    ).toThrow(/Supabase auth requires DATABASE_URL/);
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
