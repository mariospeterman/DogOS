import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  CompositeRequestAuthenticator,
  LocalRequestAuthenticator,
} from "./auth.js";

describe("request authentication", () => {
  it("resolves deterministic identities only outside production", async () => {
    const authenticator = new LocalRequestAuthenticator("test");
    await expect(
      authenticator.authenticate({ "x-dogos-user": "caregiver" }, "trace-1"),
    ).resolves.toMatchObject({
      actorId: "10000000-0000-0000-0000-000000000002",
      authMode: "development",
      householdId: "20000000-0000-0000-0000-000000000001",
      role: "caregiver",
    });
    await expect(
      new LocalRequestAuthenticator("production").authenticate(
        { "x-dogos-user": "owner" },
        "trace-2",
      ),
    ).rejects.toEqual(new AuthenticationError("AUTH_REQUIRED"));
  });

  it("uses bearer authentication first in local hybrid mode", async () => {
    const calls: string[] = [];
    const hybrid = new CompositeRequestAuthenticator([
      {
        authenticate: async () => {
          calls.push("supabase");
          return {
            actorId: "user-1",
            authMode: "supabase" as const,
            householdId: "household-1",
            identity: "owner" as const,
            role: "owner" as const,
            traceId: "trace-3",
          };
        },
      },
      {
        authenticate: async () => {
          calls.push("local");
          throw new AuthenticationError("AUTH_REQUIRED");
        },
      },
    ]);

    await expect(
      hybrid.authenticate({ authorization: "Bearer token" }, "trace-3"),
    ).resolves.toMatchObject({ authMode: "supabase" });
    expect(calls).toEqual(["supabase"]);
  });
});
