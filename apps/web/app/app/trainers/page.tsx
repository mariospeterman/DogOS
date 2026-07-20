"use client";

import {
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { dogosApiHeaders, dogosApiUrl } from "../../../lib/api-client";
import { dogosFeatures } from "../../../lib/features";
import { useProductDashboard } from "../../../lib/product";

interface PartnerOffer {
  bookingProvider: "cal.com" | null;
  city: string | null;
  disclosure: string;
  evidenceLevel: string;
  id: string;
  kind: string;
  priceLabel: string | null;
  rank: number;
  reason: string;
  title: string;
}

export default function TrainersPage() {
  const { product } = useProductDashboard();
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!dogosFeatures.professionalMarketplace) return;
    if (product === null) return;
    let active = true;
    void (async () => {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/partner-offers`),
        { cache: "no-store", headers: await dogosApiHeaders() },
      );
      if (response.ok && active) {
        const body = (await response.json()) as { offers: PartnerOffer[] };
        setOffers(body.offers);
      }
    })();
    return () => {
      active = false;
    };
  }, [product]);

  async function createReferral(offerId: string) {
    if (product === null) return;
    const response = await fetch(
      dogosApiUrl(`/v1/dogs/${product.dogId}/partner-referrals`),
      {
        body: JSON.stringify({ offerId }),
        headers: await dogosApiHeaders(true),
        method: "POST",
      },
    );
    if (!response.ok) {
      setMessage("Referral could not be created.");
      return;
    }
    const body = (await response.json()) as { referral: { url: string } };
    window.location.assign(body.referral.url);
  }

  if (!dogosFeatures.professionalMarketplace) {
    return (
      <AppShell title="Professional network" eyebrow="Private pilot" wide>
        <section className="command-panel">
          <div>
            <p className="eyebrow">Capability disabled</p>
            <h2>Professional marketplace is not part of this pilot.</h2>
            <p>
              DogOS can still prepare a secure trainer or veterinary handoff
              from the Coach when you ask for professional help.
            </p>
          </div>
          <Link className="button secondary" href="/app/coach?space=plan">
            <CalendarClock size={17} /> Ask Coach
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Professional network" eyebrow="Reviewed referrals" wide>
      <section className="command-panel">
        <div>
          <p className="eyebrow">Suitability before commission</p>
          <h2>Trainer, vet, and gear referrals with disclosures</h2>
          <p>
            DogOS ranks by protocol fit, dog context, evidence quality, and
            availability. Commerce never enters the training decision.
          </p>
        </div>
        <Link className="button secondary" href="/app/coach?space=plan">
          <CalendarClock size={17} /> Ask Coach
        </Link>
      </section>

      <section className="dashboard-grid">
        {offers.map((offer) => (
          <article className="glass-panel" key={offer.id}>
            <span className="panel-kicker">
              <BadgeCheck size={16} />{" "}
              {offer.evidenceLevel.replaceAll("_", " ")}
            </span>
            <h3>{offer.title}</h3>
            <p className="microcopy">{offer.reason}</p>
            <div className="stat-row">
              <span>{offer.city ?? offer.kind.replaceAll("_", " ")}</span>
              <strong>
                {offer.priceLabel ?? `${Math.round(offer.rank * 100)}% fit`}
              </strong>
            </div>
            <p className="legal-line">
              <ShieldCheck size={15} /> {offer.disclosure}
            </p>
            <button
              className="button primary wide"
              onClick={() => void createReferral(offer.id)}
            >
              <ExternalLink size={17} /> Open
            </button>
          </article>
        ))}
      </section>
      {message ? <p className="helper">{message}</p> : null}
    </AppShell>
  );
}
