import postgres, { type Sql } from "postgres";
import type { SubscriptionTier } from "@dogos/contracts";

export class BillingRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async customerForHousehold(householdId: string): Promise<string | null> {
    const [row] = await this.#sql`
      select provider_customer_id
      from api.subscriptions
      where household_id = ${householdId}::uuid
        and provider = 'stripe'
        and provider_customer_id is not null
      order by updated_at desc
      limit 1
    `;
    return typeof row?.provider_customer_id === "string"
      ? row.provider_customer_id
      : null;
  }

  async householdForProvider(input: {
    customerId: string;
    householdMetadata: string | null;
    subscriptionId: string;
  }): Promise<string | null> {
    if (input.householdMetadata !== null) {
      const [household] = await this.#sql`
        select id::text from api.households
        where id = ${input.householdMetadata}::uuid and status = 'active'
      `;
      if (typeof household?.id === "string") return household.id;
    }
    const [subscription] = await this.#sql`
      select household_id::text
      from api.subscriptions
      where provider = 'stripe'
        and (provider_subscription_id = ${input.subscriptionId}
          or provider_customer_id = ${input.customerId})
      order by updated_at desc
      limit 1
    `;
    return typeof subscription?.household_id === "string"
      ? subscription.household_id
      : null;
  }

  async projectSubscription(input: {
    canonicalStatus:
      "active" | "canceled" | "incomplete" | "past_due" | "paused" | "trialing";
    customerId: string;
    eventId: string;
    eventType: string;
    householdId: string;
    periodEnd: Date | null;
    periodStart: Date | null;
    subscriptionId: string;
    tier: SubscriptionTier;
  }): Promise<boolean> {
    const [row] = await this.#sql`
      select private.project_stripe_subscription(
        ${input.eventId}, ${input.eventType}, ${input.householdId}::uuid,
        ${input.customerId}, ${input.subscriptionId},
        ${`tier.${input.tier}`}::api.canonical_code, ${input.canonicalStatus},
        ${input.periodStart}, ${input.periodEnd}
      ) as projected
    `;
    return row?.projected === true;
  }
}
