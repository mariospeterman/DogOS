import postgres, { type Sql } from "postgres";

export interface StoredOnboardingSession {
  householdId: string;
  ownerUserId: string;
  state: unknown;
  version: number;
}

export class OnboardingSessionRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async load(ownerUserId: string): Promise<StoredOnboardingSession | null> {
    const [row] = await this.#sql`
      select owner_user_id::text, household_id::text, state, state_version
      from private.owner_onboarding_sessions
      where owner_user_id = ${ownerUserId}::uuid
    `;
    return row === undefined
      ? null
      : {
          householdId: String(row.household_id),
          ownerUserId: String(row.owner_user_id),
          state: row.state,
          version: Number(row.state_version),
        };
  }

  async save(input: {
    expectedVersion: number | null;
    householdId: string;
    ownerUserId: string;
    state: unknown;
  }): Promise<number> {
    if (input.expectedVersion === null) {
      const [row] = await this.#sql`
        insert into private.owner_onboarding_sessions
          (owner_user_id, household_id, state)
        values (${input.ownerUserId}, ${input.householdId}, ${this.#sql.json(input.state)})
        on conflict (owner_user_id) do nothing
        returning state_version
      `;
      if (row !== undefined) return Number(row.state_version);
      throw new Error("ONBOARDING_SESSION_STALE");
    }

    const [row] = await this.#sql`
      update private.owner_onboarding_sessions
      set state = ${this.#sql.json(input.state)},
          state_version = state_version + 1,
          updated_at = now()
      where owner_user_id = ${input.ownerUserId}::uuid
        and household_id = ${input.householdId}::uuid
        and state_version = ${input.expectedVersion}
      returning state_version
    `;
    if (row === undefined) throw new Error("ONBOARDING_SESSION_STALE");
    return Number(row.state_version);
  }
}
