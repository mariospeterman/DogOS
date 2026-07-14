import { describe, expect, it } from "vitest";

import { assertNoPrivateBrowserEnv, parseWebEnv } from "./web.js";

describe("web environment", () => {
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
