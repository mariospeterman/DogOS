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
        "SUPABASE_SECRET_KEY",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_APP_SECRET",
        "WHATSAPP_MODE",
        "WHATSAPP_VERIFY_TOKEN",
      ]),
    );
  });

  it("provides explicit local-only defaults", () => {
    const environment = loadApiEnv({ NODE_ENV: "test" });

    expect(environment.API_PORT).toBe(4000);
    expect(environment.USE_MOCK_PROVIDERS).toBe(true);
  });

  it("rejects mock providers in production", () => {
    expect(() =>
      loadApiEnv({
        DOGOS_ENV: "production",
        NODE_ENV: "production",
        SIGNED_LINK_SECRET: "a-production-secret-that-is-long-enough",
        USE_MOCK_PROVIDERS: "true",
        WEB_ORIGIN: "https://dogos.example",
      }),
    ).toThrow(/USE_MOCK_PROVIDERS/);
  });

  it("requires production secrets instead of applying development defaults", () => {
    expect(() =>
      loadApiEnv({
        DOGOS_ENV: "production",
        NODE_ENV: "production",
        USE_MOCK_PROVIDERS: "false",
        WEB_ORIGIN: "https://dogos.example",
      }),
    ).toThrow(/SIGNED_LINK_SECRET/);
  });
});
