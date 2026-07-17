import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { OnboardingRepository, PostgresRepository } from "@dogos/database";
import { OnboardingService } from "./onboarding-service.js";

const connection = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(connection, { prepare: false });
const repository = new OnboardingRepository(connection);
const commands = new PostgresRepository(connection);
const service = new OnboardingService(repository);
const contactId = randomUUID();

beforeAll(async () => {
  await sql`
    insert into private.whatsapp_provider_contacts
      (id, provider, external_contact_id, external_contact_hash, status,
       user_id, household_id, locale, allowlisted, linked_at)
    values (${contactId}, 'meta_cloud', ${`integration:${contactId}`},
      ${`hash:${contactId}`}, 'linked',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001', 'en', true, now())
  `;
});

afterAll(async () => {
  await commands.close();
  await repository.close();
  await sql.end();
});

describe("durable WhatsApp onboarding", () => {
  it("projects one real dog, assessment, goal, plan, and schedule", async () => {
    const contact = {
      externalId: `integration:${contactId}`,
      householdId: "20000000-0000-0000-0000-000000000001",
      id: contactId,
      linked: true,
      locale: "en" as const,
      userId: "10000000-0000-0000-0000-000000000001",
    };
    const snapshot = {
      answers: {
        ai_disclosure: "ai_disclosure.choice.1",
        baseline_collection: "baseline_collection.choice.2",
        behavior_concern: "behavior_concern.choice.1",
        dog_history: "dog_history.choice.2",
        dog_identity: "dog_identity.text:Rex",
        goal_selection: "goal_selection.choice.1",
        health_screen: "health_screen.choice.1",
        household_context: "household_context.choice.1",
        safety_screen: "safety_screen.choice.1",
        training_setup: "training_setup.choice.1",
        welcome: "welcome.choice.1",
      },
      audit: [],
      country: "CH" as const,
      currency: "CHF" as const,
      locale: "en" as const,
      state: "plan_ready" as const,
      timezone: "Europe/Zurich" as const,
    };

    const first = await service.project(contact, snapshot);
    const replay = await service.project(contact, snapshot);
    expect(first).toMatchObject({
      baselineSuccessRate: 50,
      dogName: "Rex",
      goal: "goal.loose_leash_walking",
      planStatus: "active",
      riskDisposition: "continue_low_risk_training",
    });
    expect(replay).toEqual(first);

    const [counts] = await sql`
      select
        (select count(*)::integer from private.onboarding_projections where contact_id = ${contactId}) as projections,
        (select count(*)::integer from api.dogs where id = ${first.dogId}) as dogs,
        (select count(*)::integer from api.plans where id = ${first.planId}) as plans,
        (select count(*)::integer from api.scheduled_sessions ss
          join api.plan_steps ps on ps.id = ss.plan_step_id
          join api.plan_versions pv on pv.id = ps.plan_version_id
          where pv.plan_id = ${first.planId}) as scheduled_sessions
    `;
    expect(counts).toMatchObject({
      dogs: 1,
      plans: 1,
      projections: 1,
      scheduled_sessions: 4,
    });

    const dashboard = await repository.dashboardByDog(
      first.dogId,
      contact.householdId,
    );
    expect(dashboard?.todaySessionId).toEqual(expect.any(String));
    const scheduledSessionId = dashboard!.todaySessionId!;
    const startContext = {
      actorUserId: contact.userId,
      commandCode: "command.start_session",
      idempotencyKey: randomUUID(),
      requestHash: "empty-body",
      traceId: randomUUID(),
    };
    const started = await commands.startSession(
      startContext,
      scheduledSessionId,
      contact.householdId,
    );
    const startReplay = await commands.startSession(
      startContext,
      scheduledSessionId,
      contact.householdId,
    );
    expect(started).toMatchObject({ replayed: false, status: 200 });
    expect(startReplay).toMatchObject({
      body: started.body,
      replayed: true,
      status: 200,
    });

    const completeContext = {
      actorUserId: contact.userId,
      commandCode: "command.complete_session",
      idempotencyKey: randomUUID(),
      requestHash: "complete-body",
      traceId: randomUUID(),
    };
    const completion = await commands.completeSession(
      completeContext,
      started.body.sessionId,
      contact.householdId,
      {
        concernNotes: null,
        confidence: 4,
        difficulty: 2,
        distractionLevel: 1,
        foodAccepted: true,
        locale: "en",
        outcome: "clean",
        repetitions: 4,
        successes: 3,
      },
    );
    const completionReplay = await commands.completeSession(
      completeContext,
      started.body.sessionId,
      contact.householdId,
      {
        concernNotes: null,
        confidence: 4,
        difficulty: 2,
        distractionLevel: 1,
        foodAccepted: true,
        locale: "en",
        outcome: "clean",
        repetitions: 4,
        successes: 3,
      },
    );
    expect(completion.body.status).toBe("completed");
    expect(completionReplay.replayed).toBe(true);
    const [sessionCounts] = await sql`
      select
        (select count(*)::integer from api.sessions where id = ${started.body.sessionId}) as sessions,
        (select count(*)::integer from api.session_measurements where session_id = ${started.body.sessionId}) as measurements,
        (select count(*)::integer from api.owner_checkins where session_id = ${started.body.sessionId}) as checkins,
        (select count(*)::integer from private.audit_events
          where target_id = ${started.body.sessionId}::uuid
            and action in ('session.started', 'session.completed')) as audits
    `;
    expect(sessionCounts).toMatchObject({
      audits: 2,
      checkins: 1,
      measurements: 4,
      sessions: 1,
    });
  }, 15_000);
});
