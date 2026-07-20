import Stripe from "stripe";
import { subscriptionTiers, type SubscriptionTier } from "@dogos/contracts";
import type { BillingRepository } from "@dogos/database";

const paidTiers = ["plus", "pro", "ultra"] as const;
type PaidTier = (typeof paidTiers)[number];

export interface StripeBillingConfig {
  prices: Record<PaidTier, string>;
  products: Record<PaidTier, string>;
  secretKey: string;
  webhookSecret: string;
}

export function loadStripeBillingConfig(
  environment: NodeJS.ProcessEnv,
): StripeBillingConfig | null {
  const values = {
    prices: {
      plus: environment.STRIPE_PRICE_PLUS_CHF,
      pro: environment.STRIPE_PRICE_PRO_CHF,
      ultra: environment.STRIPE_PRICE_ULTRA_CHF,
    },
    products: {
      plus: environment.STRIPE_PRODUCT_PLUS,
      pro: environment.STRIPE_PRODUCT_PRO,
      ultra: environment.STRIPE_PRODUCT_ULTRA,
    },
    secretKey: environment.STRIPE_SECRET_KEY,
    webhookSecret: environment.STRIPE_WEBHOOK_SECRET,
  };
  const flat = [
    ...Object.values(values.prices),
    ...Object.values(values.products),
    values.secretKey,
    values.webhookSecret,
  ];
  if (flat.every((value) => value === undefined || value === "")) return null;
  if (flat.some((value) => value === undefined || value === "")) {
    throw new Error("STRIPE_CONFIGURATION_INCOMPLETE");
  }
  return values as StripeBillingConfig;
}

export class StripeBillingService {
  readonly #stripe: Stripe;

  constructor(
    readonly config: StripeBillingConfig,
    private readonly repository: Pick<
      BillingRepository,
      "customerForHousehold" | "householdForProvider" | "projectSubscription"
    >,
  ) {
    this.#stripe = new Stripe(config.secretKey, { maxNetworkRetries: 2 });
  }

  async createCheckout(input: {
    householdId: string;
    rewardfulReferralId?: string | null;
    returnBaseUrl: string;
    tier: PaidTier;
  }): Promise<string> {
    const customer = await this.repository.customerForHousehold(
      input.householdId,
    );
    const session = await this.#stripe.checkout.sessions.create({
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      cancel_url: `${input.returnBaseUrl}/app/account?billing=cancelled`,
      client_reference_id: input.rewardfulReferralId ?? input.householdId,
      ...(customer === null
        ? { customer_creation: "always" as const }
        : { customer }),
      line_items: [{ price: this.config.prices[input.tier], quantity: 1 }],
      locale: "auto",
      metadata: {
        householdId: input.householdId,
        rewardfulReferralId: input.rewardfulReferralId ?? "",
        tier: input.tier,
      },
      mode: "subscription",
      subscription_data: {
        metadata: {
          householdId: input.householdId,
          rewardfulReferralId: input.rewardfulReferralId ?? "",
          tier: input.tier,
        },
      },
      success_url: `${input.returnBaseUrl}/app/account?billing=success`,
    });
    if (session.url === null) throw new Error("STRIPE_CHECKOUT_URL_MISSING");
    return session.url;
  }

  async createPortal(input: {
    householdId: string;
    returnBaseUrl: string;
  }): Promise<string> {
    const customer = await this.repository.customerForHousehold(
      input.householdId,
    );
    if (customer === null) throw new Error("STRIPE_CUSTOMER_NOT_FOUND");
    const session = await this.#stripe.billingPortal.sessions.create({
      customer,
      return_url: `${input.returnBaseUrl}/app/account`,
    });
    return session.url;
  }

  async processWebhook(rawBody: string, signature: string): Promise<boolean> {
    const event = this.#stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.webhookSecret,
    );
    if (
      ![
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      return false;
    }
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const householdId = await this.repository.householdForProvider({
      customerId,
      householdMetadata: subscription.metadata.householdId ?? null,
      subscriptionId: subscription.id,
    });
    if (householdId === null) throw new Error("STRIPE_HOUSEHOLD_NOT_FOUND");

    const active = ["active", "trialing", "past_due"].includes(
      subscription.status,
    );
    const tier = active ? this.#tierFromSubscription(subscription) : "freemium";
    const firstItem = subscription.items.data[0];
    return this.repository.projectSubscription({
      canonicalStatus: active
        ? (subscription.status as "active" | "past_due" | "trialing")
        : "active",
      customerId,
      eventId: event.id,
      eventType: event.type,
      householdId,
      periodEnd:
        active && firstItem !== undefined
          ? new Date(firstItem.current_period_end * 1_000)
          : null,
      periodStart:
        active && firstItem !== undefined
          ? new Date(firstItem.current_period_start * 1_000)
          : null,
      subscriptionId: subscription.id,
      tier,
    });
  }

  #tierFromSubscription(subscription: Stripe.Subscription): SubscriptionTier {
    const productIds = new Set(
      subscription.items.data.map((item) =>
        typeof item.price.product === "string"
          ? item.price.product
          : item.price.product.id,
      ),
    );
    const matched = paidTiers.filter((tier) =>
      productIds.has(this.config.products[tier]),
    );
    if (matched.length !== 1 || !subscriptionTiers.includes(matched[0]!)) {
      throw new Error("STRIPE_PRODUCT_UNMAPPED");
    }
    return matched[0]!;
  }
}
