import postgres, { type Sql } from "postgres";
import {
  subscriptionTiers,
  type SubscriptionTier,
  type TierCapabilities,
} from "@dogos/contracts";

export interface AccountRecord {
  appUserId: string;
  capabilities: TierCapabilities;
  country: string;
  currency: string;
  displayName: string | null;
  householdId: string;
  householdName: string;
  locale: string;
  role: "owner" | "caregiver" | "viewer";
  tier: SubscriptionTier;
  timezone: string;
}

interface AccountRow {
  app_user_id: string;
  capability_code: string;
  country: string;
  currency: string;
  display_name: string | null;
  household_id: string;
  household_name: string;
  limits: unknown;
  locale: string;
  role: string;
  tier_code: string;
  timezone: string;
}

const capabilityCodes = [
  "capability.coaching_messages",
  "capability.concurrent_dogs",
  "capability.live_coaching_minutes",
  "capability.plan_adjustments",
  "capability.video_analyses",
] as const;

function positiveIntegerLimit(
  limits: unknown,
  key: "maximum" | "perDay" | "perMonth",
): number {
  if (typeof limits !== "object" || limits === null || !(key in limits)) {
    throw new Error("ENTITLEMENT_LIMIT_INVALID");
  }
  const value = (limits as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("ENTITLEMENT_LIMIT_INVALID");
  }
  return value;
}

function mapAccountRows(rows: AccountRow[]): AccountRecord | null {
  const first = rows[0];
  if (first === undefined) return null;
  const tier = first.tier_code.startsWith("tier.")
    ? first.tier_code.slice("tier.".length)
    : "";
  if (!subscriptionTiers.includes(tier as SubscriptionTier)) {
    throw new Error("SUBSCRIPTION_TIER_UNSUPPORTED");
  }
  if (!["owner", "caregiver", "viewer"].includes(first.role)) {
    throw new Error("MEMBERSHIP_ROLE_UNSUPPORTED");
  }
  const limits = new Map(rows.map((row) => [row.capability_code, row.limits]));
  for (const code of capabilityCodes) {
    if (!limits.has(code)) throw new Error("ENTITLEMENT_SET_INCOMPLETE");
  }
  return {
    appUserId: first.app_user_id,
    capabilities: {
      coachingMessagesPerDay: positiveIntegerLimit(
        limits.get("capability.coaching_messages"),
        "perDay",
      ),
      concurrentDogs: positiveIntegerLimit(
        limits.get("capability.concurrent_dogs"),
        "maximum",
      ),
      liveCoachingMinutesPerMonth: positiveIntegerLimit(
        limits.get("capability.live_coaching_minutes"),
        "perMonth",
      ),
      planAdjustmentsPerMonth: positiveIntegerLimit(
        limits.get("capability.plan_adjustments"),
        "perMonth",
      ),
      videoAnalysesPerMonth: positiveIntegerLimit(
        limits.get("capability.video_analyses"),
        "perMonth",
      ),
    },
    country: first.country,
    currency: first.currency,
    displayName: first.display_name,
    householdId: first.household_id,
    householdName: first.household_name,
    locale: first.locale,
    role: first.role as AccountRecord["role"],
    tier: tier as SubscriptionTier,
    timezone: first.timezone,
  };
}

export class AccountRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async resolveByAuthUser(authUserId: string): Promise<AccountRecord | null> {
    const rows = await this.#accountRows("auth", authUserId);
    return mapAccountRows(rows);
  }

  async resolveByAppUser(appUserId: string): Promise<AccountRecord | null> {
    const rows = await this.#accountRows("app", appUserId);
    return mapAccountRows(rows);
  }

  async bootstrap(input: {
    authUserId: string;
    displayName: string;
    locale: string;
    referralCode?: string | null;
  }): Promise<AccountRecord> {
    await this.#sql`
      select * from private.bootstrap_account(
        ${input.authUserId}::uuid,
        ${input.displayName},
        ${input.locale}::api.locale_tag,
        ${input.referralCode ?? null}
      )
    `;
    const account = await this.resolveByAuthUser(input.authUserId);
    if (account === null) throw new Error("ACCOUNT_BOOTSTRAP_FAILED");
    return account;
  }

  async #accountRows(
    identityKind: "app" | "auth",
    identityId: string,
  ): Promise<AccountRow[]> {
    return this.#sql<AccountRow[]>`
      with selected_membership as (
        select hm.*
        from api.users candidate
        join api.household_members hm on hm.user_id = candidate.id
        join api.households candidate_household on candidate_household.id = hm.household_id
        where ${
          identityKind === "auth"
            ? this.#sql`candidate.auth_user_id = ${identityId}::uuid`
            : this.#sql`candidate.id = ${identityId}::uuid`
        }
          and candidate.status = 'active'
          and candidate_household.status = 'active'
          and hm.status = 'active'
        order by case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
          hm.created_at
        limit 1
      )
      select
        u.id::text as app_user_id,
        u.display_name,
        u.preferred_locale::text as locale,
        h.id::text as household_id,
        h.name as household_name,
        h.country::text,
        h.currency::text,
        h.timezone,
        hm.role::text,
        s.tier_code::text,
        e.capability_code::text,
        e.limits
      from api.users u
      join selected_membership hm on hm.user_id = u.id
      join api.households h on h.id = hm.household_id
      join api.subscriptions s on s.household_id = h.id
        and s.canonical_status in ('active', 'trialing', 'past_due')
      join api.entitlements e on e.household_id = h.id
        and e.subscription_id = s.id
        and e.status = 'active'
        and e.effective_from <= now()
        and (e.effective_until is null or e.effective_until > now())
      order by e.capability_code
    `;
  }
}
