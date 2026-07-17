import postgres, { type Sql } from "postgres";

export class CapabilityUsageRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async consumeCoachingMessage(input: {
    actorUserId: string;
    householdId: string;
    limit: number;
    timezone: string;
  }): Promise<boolean> {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: input.timezone,
      year: "numeric",
    }).formatToParts(new Date());
    const value = (kind: "day" | "month" | "year") =>
      parts.find((part) => part.type === kind)?.value;
    const periodStart = `${value("year")}-${value("month")}-${value("day")}`;
    const [row] = await this.#sql`
      select private.consume_capability(
        ${input.householdId}::uuid,
        ${input.actorUserId}::uuid,
        'capability.coaching_messages'::api.canonical_code,
        'day', ${input.limit}, ${periodStart}::date
      ) as consumed
    `;
    return row?.consumed === true;
  }
}
