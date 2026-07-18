import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  CompositeRequestAuthenticator,
  createRequestAuthenticator,
  LocalRequestAuthenticator,
  SupabaseRequestAuthenticator,
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
    await expect(
      new LocalRequestAuthenticator("preview").authenticate(
        { "x-dogos-user": "owner" },
        "trace-3",
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

  it.each(["preview", "production"] as const)(
    "refuses hybrid development identities at %s boot",
    (environment) => {
      expect(() =>
        createRequestAuthenticator({
          authMode: "hybrid",
          databaseUrl: undefined,
          environment,
          publishableKey: undefined,
          supabaseUrl: undefined,
        }),
      ).toThrow("HYBRID_AUTH_FORBIDDEN");
    },
  );

  it("passes only bounded referral metadata into account bootstrap", async () => {
    const calls: Array<{ referralCode?: string | null }> = [];
    const accounts = {
      bootstrap: async (input: {
        authUserId: string;
        displayName: string;
        locale: string;
        referralCode?: string | null;
      }) => {
        calls.push(
          input.referralCode === undefined
            ? {}
            : { referralCode: input.referralCode },
        );
        return {
          appUserId: "app-user-1",
          capabilities: {
            coachingMessagesPerDay: 12,
            concurrentDogs: 1,
            liveCoachingMinutesPerMonth: 0,
            planAdjustmentsPerMonth: 1,
            videoAnalysesPerMonth: 0,
          },
          country: "CH",
          currency: "CHF",
          displayName: input.displayName,
          householdId: "household-1",
          householdName: "New Owner household",
          locale: input.locale,
          role: "owner" as const,
          tier: "freemium" as const,
          timezone: "Europe/Zurich",
        };
      },
      close: async () => undefined,
      resolveByAuthUser: async () => null,
    };
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          email: "owner@example.test",
          id: "auth-user-1",
          user_metadata: {
            full_name: "New Owner",
            locale: "de-CH",
            referral_code: " abc123 ",
          },
        }),
      );
    const authenticator = new SupabaseRequestAuthenticator(
      "https://supabase.test",
      "publishable",
      "postgres://unused",
      fetcher,
      accounts as never,
    );

    await expect(
      authenticator.authenticate({ authorization: "Bearer token" }, "trace-1"),
    ).resolves.toMatchObject({
      actorId: "app-user-1",
      authMode: "supabase",
      householdId: "household-1",
    });
    expect(calls).toEqual([{ referralCode: "ABC123" }]);
  });
});
