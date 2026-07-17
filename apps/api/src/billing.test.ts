import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  loadStripeBillingConfig,
  StripeBillingService,
  type StripeBillingConfig,
} from "./billing.js";

const config: StripeBillingConfig = {
  prices: { plus: "price_plus", pro: "price_pro", ultra: "price_ultra" },
  products: {
    plus: "prod_plus",
    pro: "prod_pro",
    ultra: "prod_ultra",
  },
  secretKey: "sk_test_local",
  webhookSecret: "whsec_test_local",
};

describe("Stripe billing boundary", () => {
  it("is disabled when empty and rejects partial configuration", () => {
    expect(loadStripeBillingConfig({})).toBeNull();
    expect(() =>
      loadStripeBillingConfig({ STRIPE_SECRET_KEY: "sk_test_partial" }),
    ).toThrow("STRIPE_CONFIGURATION_INCOMPLETE");
  });

  it("verifies and projects a mapped subscription event", async () => {
    const projectSubscription = vi.fn().mockResolvedValue(true);
    const service = new StripeBillingService(config, {
      customerForHousehold: vi.fn().mockResolvedValue(null),
      householdForProvider: vi
        .fn()
        .mockResolvedValue("20000000-0000-0000-0000-000000000001"),
      projectSubscription,
    });
    const payload = JSON.stringify({
      api_version: "2026-06-30.preview",
      created: 1_784_200_000,
      data: {
        object: {
          customer: "cus_test",
          id: "sub_test",
          items: {
            data: [
              {
                current_period_end: 1_786_880_000,
                current_period_start: 1_784_200_000,
                price: { product: "prod_plus" },
              },
            ],
          },
          metadata: {
            householdId: "20000000-0000-0000-0000-000000000001",
          },
          object: "subscription",
          status: "active",
        },
      },
      id: "evt_test",
      livemode: false,
      object: "event",
      pending_webhooks: 1,
      request: null,
      type: "customer.subscription.created",
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: config.webhookSecret,
    });
    await expect(service.processWebhook(payload, signature)).resolves.toBe(
      true,
    );
    expect(projectSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_test",
        tier: "plus",
      }),
    );
    await expect(service.processWebhook(payload, "invalid")).rejects.toThrow();
  });
});
