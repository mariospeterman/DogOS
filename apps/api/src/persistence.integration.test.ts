import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import type { RiskAssessment } from "@dogos/contracts";
import { AccountRepository, PostgresRepository } from "@dogos/database";

const connection =
  process.env.DOGOS_TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(connection, { prepare: false });
const repository = new PostgresRepository(connection);
const accounts = new AccountRepository(connection);
const actorUserId = "10000000-0000-0000-0000-000000000001";
const dogId = "30000000-0000-0000-0000-000000000001";
const canonicalRuleSetId = "52000000-0000-4000-8000-000000000001";
const key = "integration-risk-roundtrip";

beforeAll(async () => {
  await sql`
    insert into private.rule_sets
      (id, rule_set_code, version, canonical_definition, validity_state)
    values (${canonicalRuleSetId}, 'rules.persistence_test', 1, '{"developmentOnly":true}', 'draft')
    on conflict (id) do nothing
  `;
});

afterAll(async () => {
  await repository.close();
  await accounts.close();
  await sql.end();
});

describe("PostgreSQL decision transaction", () => {
  it("loads the persisted account and complete entitlement set", async () => {
    await expect(accounts.resolveByAppUser(actorUserId)).resolves.toMatchObject(
      {
        appUserId: actorUserId,
        capabilities: {
          coachingMessagesPerDay: 12,
          concurrentDogs: 1,
          liveCoachingMinutesPerMonth: 0,
          planAdjustmentsPerMonth: 1,
          videoAnalysesPerMonth: 0,
        },
        householdId: "20000000-0000-0000-0000-000000000001",
        role: "owner",
        tier: "freemium",
      },
    );
  });

  it("persists canonical reasons, replays once, and audits once", async () => {
    const decision: RiskAssessment = {
      riskLevel: "high",
      disposition: "require_veterinary_review",
      triggeredRuleIds: ["safety.suspected_pain"],
      reasonCodes: ["SAFETY_SUSPECTED_PAIN"],
      evidenceIds: [],
      prohibitedActionCodes: ["action.autonomous_training"],
      requiredQuestionCodes: [],
      permittedNextActionCodes: ["action.professional_escalation"],
      ruleSetId: canonicalRuleSetId,
      ruleSetVersion: "1.0.0",
    };
    const context = {
      actorUserId,
      commandCode: "command.assess_safety",
      idempotencyKey: key,
      requestHash: "sha256:same-request",
      traceId: "trace:persistence-integration",
    };

    const first = await repository.executeCommand(
      context,
      "safety.assessed",
      "risk_assessment",
      async (tx) => {
        const id = await repository.persistRiskAssessment(tx, dogId, decision);
        return { status: 201, body: { id }, targetId: id };
      },
    );
    const replay = await repository.executeCommand(
      context,
      "safety.assessed",
      "risk_assessment",
      async () => {
        throw new Error("replayed operation must not execute");
      },
    );

    const [stored] = await sql`
      select reason_codes::text[] as reason_codes, disposition_code
      from api.risk_assessments where id = ${first.body.id}
    `;
    const [counts] = await sql`
      select
        (select count(*)::int from api.risk_assessments where id = ${first.body.id}) as decisions,
        (select count(*)::int from private.audit_events where request_id = ${key}) as audits
    `;
    expect(stored?.reason_codes).toEqual(["SAFETY_SUSPECTED_PAIN"]);
    expect(stored?.disposition_code).toBe(
      "disposition.require_veterinary_review",
    );
    expect(replay).toEqual({ ...first, replayed: true });
    expect(counts).toMatchObject({ decisions: 1, audits: 1 });
  });
});
