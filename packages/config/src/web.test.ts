import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertNoPrivateBrowserEnv, parseWebEnv } from "./web.js";

describe("web environment", () => {
  it("passes the mobile origin through Turborepo in development", () => {
    const turboConfig = JSON.parse(
      readFileSync(new URL("../../../turbo.json", import.meta.url), "utf8"),
    ) as {
      tasks?: Record<string, { passThroughEnv?: string[] }>;
    };

    expect(turboConfig.tasks?.["@dogos/web#dev"]?.passThroughEnv).toEqual(
      expect.arrayContaining(["NEXT_PUBLIC_API_URL", "WEB_ORIGIN"]),
    );
  });

  it("parses browser-safe local defaults", () => {
    expect(parseWebEnv({})).toEqual({
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
      NEXT_PUBLIC_DOGOS_ENV: "local",
    });
  });

  it("rejects private-looking NEXT_PUBLIC variables", () => {
    expect(() =>
      assertNoPrivateBrowserEnv({ NEXT_PUBLIC_SERVICE_ROLE_KEY: "unsafe" }),
    ).toThrow(/SERVICE_ROLE/);
  });
});
