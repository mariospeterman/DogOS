import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  OnboardingRepository,
  OnboardingSessionRepository,
} from "@dogos/database";
import { OnboardingService } from "./onboarding-service.js";

const connection =
  process.env.DOGOS_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(connection, { prepare: false });
const repository = new OnboardingRepository(connection);
const sessions = new OnboardingSessionRepository(connection);
const service = new OnboardingService(repository);
const ownerUserId = randomUUID();
const authUserId = randomUUID();
const householdId = randomUUID();

beforeAll(async () => {
  await sql`
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at,
       updated_at, confirmation_token, email_change, email_change_token_new,
       recovery_token)
    values ('00000000-0000-0000-0000-000000000000', ${authUserId},
      'authenticated', 'authenticated', ${`pwa-${authUserId}@dogos.test`},
      extensions.crypt('integration-only', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', '')
  `;
  await sql`
    insert into api.users
      (id, auth_user_id, preferred_locale, locale_status, fallback_locale,
       country, legal_jurisdiction, timezone, currency)
    values (${ownerUserId}, ${authUserId}, 'en', 'confirmed', 'de-CH',
      'CH', 'CH', 'Europe/Zurich', 'CHF')
  `;
  await sql`
    insert into api.households
      (id, name, default_locale, fallback_locale, country, legal_jurisdiction,
       timezone, currency, created_by)
    values (${householdId}, 'PWA integration household', 'en', 'de-CH',
      'CH', 'CH', 'Europe/Zurich', 'CHF', ${ownerUserId})
  `;
  await sql`
    insert into api.household_members
      (household_id, user_id, role, status, joined_at)
    values (${householdId}, ${ownerUserId}, 'owner', 'active', now())
  `;
});

afterAll(async () => {
  await sessions.close();
  await repository.close();
  await sql.end();
});

describe("durable PWA onboarding", () => {
  it("projects one real dog, goal, risk assessment, plan, and schedule", async () => {
    const snapshot = {
      answers: {
        baseline_collection: "baseline_collection.choice.2",
        behavior_concern: "behavior_concern.choice.1",
        dog_history: "dog_history.choice.2",
        dog_identity: "dog_identity.text:Echo",
        goal_selection: "goal_selection.choice.1",
        health_screen: "health_screen.choice.1",
        household_context: "household_context.choice.1",
        safety_screen: "safety_screen.choice.1",
        training_setup: "training_setup.choice.1",
      },
      audit: [],
      country: "CH" as const,
      currency: "CHF" as const,
      locale: "en" as const,
      notes: {
        concern_description: "Leash tension appears around movement",
        dog_profile_summary: "Adult Belgian Malinois with prior training",
        goal_description: "Walk on a loose leash around moderate distraction",
      },
      state: "plan_ready" as const,
      timezone: "Europe/Zurich" as const,
    };
    const input = { actorUserId: ownerUserId, householdId };
    const first = await service.projectOwner(input, snapshot);
    const replay = await service.projectOwner(input, snapshot);
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      baselineSuccessRate: 50,
      dogName: "Echo",
      goal: "goal.loose_leash_walking",
      planStatus: "active",
      riskDisposition: "continue_low_risk_training",
    });

    const dashboard = await repository.findPrimaryByHousehold(householdId);
    expect(dashboard).toMatchObject({
      behaviorConcernDescription: "Leash tension appears around movement",
      dogProfileSummary: "Adult Belgian Malinois with prior training",
      goalText: "Walk on a loose leash around moderate distraction",
      latestDecision: "repeat_step",
    });
    expect(dashboard?.calendar.length).toBeGreaterThan(0);
    const [counts] = await sql`
      select
        (select count(*)::integer from private.onboarding_projections
          where owner_user_id = ${ownerUserId}) as projections,
        (select count(*)::integer from private.audit_events
          where actor_user_id = ${ownerUserId} and action = 'onboarding.projected') as audits
    `;
    expect(counts).toMatchObject({ audits: 1, projections: 1 });
  });

  it("keeps non-pilot goals out of autonomous plan generation", async () => {
    const otherOwner = randomUUID();
    const otherAuthUser = randomUUID();
    const otherHousehold = randomUUID();
    await sql`
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at,
         updated_at, confirmation_token, email_change, email_change_token_new,
         recovery_token)
      values ('00000000-0000-0000-0000-000000000000', ${otherAuthUser},
        'authenticated', 'authenticated', ${`unsupported-${otherAuthUser}@dogos.test`},
        extensions.crypt('integration-only', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', '')
    `;
    await sql`
      insert into api.users
        (id, auth_user_id, preferred_locale, locale_status, fallback_locale,
         country, legal_jurisdiction, timezone, currency)
      values (${otherOwner}, ${otherAuthUser}, 'en', 'confirmed', 'de-CH',
        'CH', 'CH', 'Europe/Zurich', 'CHF')
    `;
    await sql`
      insert into api.households
        (id, name, default_locale, fallback_locale, country, legal_jurisdiction,
         timezone, currency, created_by)
      values (${otherHousehold}, 'Unsupported household', 'en', 'de-CH',
        'CH', 'CH', 'Europe/Zurich', 'CHF', ${otherOwner})
    `;
    await sql`
      insert into api.household_members
        (household_id, user_id, role, status, joined_at)
      values (${otherHousehold}, ${otherOwner}, 'owner', 'active', now())
    `;

    const projected = await service.projectOwner(
      { actorUserId: otherOwner, householdId: otherHousehold },
      {
        answers: {
          baseline_collection: "baseline_collection.choice.2",
          behavior_concern: "behavior_concern.choice.2",
          dog_history: "dog_history.choice.2",
          dog_identity: "dog_identity.text:Scout",
          goal_selection: "goal_selection.choice.2",
          health_screen: "health_screen.choice.1",
          household_context: "household_context.choice.1",
          safety_screen: "safety_screen.choice.1",
          training_setup: "training_setup.choice.1",
        },
        audit: [],
        country: "CH" as const,
        currency: "CHF" as const,
        locale: "en" as const,
        notes: {
          goal_description: "Return on one cue around movement",
        },
        state: "plan_ready" as const,
        timezone: "Europe/Zurich" as const,
      },
    );

    expect(projected).toMatchObject({
      dogName: "Scout",
      goal: "goal.recall",
      planId: null,
      planStatus: "setup_required",
    });
    const dashboard = await repository.findPrimaryByHousehold(otherHousehold);
    expect(dashboard).toMatchObject({
      dogName: "Scout",
      goal: "goal.recall",
      planId: null,
      planStatus: "setup_required",
    });
    expect(dashboard?.calendar).toHaveLength(0);
  });

  it("persists the owner conversation with optimistic concurrency", async () => {
    const version = await sessions.save({
      expectedVersion: null,
      householdId,
      ownerUserId,
      state: { messages: [], state: "dog_identity" },
    });
    await expect(
      sessions.save({
        expectedVersion: version + 1,
        householdId,
        ownerUserId,
        state: { messages: [] },
      }),
    ).rejects.toThrow("ONBOARDING_SESSION_STALE");
    expect((await sessions.load(ownerUserId))?.version).toBe(version);
  });
});
