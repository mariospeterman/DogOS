"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { BillingActions } from "../../../../components/billing-actions";
import { dogosApiHeaders, dogosApiUrl } from "../../../../lib/api-client";

export default function BillingPage() {
  const [tier, setTier] = useState("freemium");
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    void (async () => {
      const response = await fetch(dogosApiUrl("/v1/me"), {
        headers: await dogosApiHeaders(),
      });
      if (response.ok) {
        const body = (await response.json()) as {
          billingAvailable: boolean;
          tier: string;
        };
        setAvailable(body.billingAvailable);
        setTier(body.tier);
      }
    })();
  }, []);
  return (
    <AppShell title="Billing" eyebrow="Stripe und Tarif">
      {available ? (
        <BillingActions tier={tier} />
      ) : (
        <p className="helper">
          Billing ist in dieser Umgebung nicht konfiguriert.
        </p>
      )}
    </AppShell>
  );
}
