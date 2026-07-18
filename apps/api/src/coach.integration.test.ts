import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  CoachConversationService,
  PostgresCoachConversationStore,
} from "@dogos/conversation";

const connection = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(connection, { prepare: false });
const store = new PostgresCoachConversationStore(connection);
const service = new CoachConversationService(store);
const scope = {
  actorUserId: "10000000-0000-0000-0000-000000000001",
  dogId: "30000000-0000-0000-0000-000000000001",
  householdId: "20000000-0000-0000-0000-000000000001",
  locale: "de-CH" as const,
};

beforeAll(async () => {
  await sql`
    delete from private.coach_conversations
    where household_id = ${scope.householdId} and dog_id = ${scope.dogId}
  `;
});

afterAll(async () => {
  await sql`
    delete from private.coach_conversations
    where household_id = ${scope.householdId} and dog_id = ${scope.dogId}
  `;
  await store.close();
  await sql.end();
});

describe("PostgreSQL chat-first Coach", () => {
  it("keeps onboarding and coaching in one deduplicated timeline", async () => {
    await service.importHistory({
      messages: [
        {
          content: "Tell me about your dog.",
          id: "onboarding-intro",
          role: "assistant",
        },
        {
          content: "Milo is working on lead handling.",
          id: "onboarding-answer",
          role: "user",
        },
      ],
      scope,
      traceId: "trace:coach-onboarding",
    });
    const input = {
      channel: "web" as const,
      clientMessageId: "coach-integration-web",
      context: {
        dogName: "Milo",
        durationMinutes: 4,
        evidenceCount: 2,
        goal: "lockere Leine",
        latestDecision: "repeat_step",
        stage: "Orientierung unter wenig Ablenkung",
      },
      contextKind: "plan" as const,
      links: {
        plan: "/app/plan",
        progress: "/app/progress",
        session: "/app/session/session-1",
        today: "/app/today",
      },
      message: "Warum dieser Block?",
      scope,
      traceId: "trace:coach-web",
    };
    await service.send(input);
    const replay = await service.send(input);

    expect(replay.conversation.messages).toHaveLength(4);
    expect(
      replay.conversation.messages.map((message) => message.channel),
    ).toEqual(["web", "web", "web", "web"]);
    const [counts] = await sql`
      select
        (select count(*)::int from private.coach_channel_bindings) as bindings,
        (select count(*)::int from private.coach_messages) as messages
    `;
    expect(counts).toMatchObject({ bindings: 1, messages: 4 });
  });
});
