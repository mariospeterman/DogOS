import postgres, { type Sql } from "postgres";

export type PartnerOfferKind =
  | "affiliate_equipment"
  | "affiliate_food"
  | "trainer_booking"
  | "veterinary_triage";

export interface PartnerOfferRecord {
  bookingProvider: "cal.com" | null;
  bookingUrl: string | null;
  city: string | null;
  country: string;
  disclosure: string;
  evidenceLevel: string;
  id: string;
  kind: PartnerOfferKind;
  priceLabel: string | null;
  rank: number;
  reason: string;
  title: string;
}

export interface PartnerReferralRecord {
  id: string;
  offerId: string;
  provider: string | null;
  providerReference: string | null;
  status: "created" | "clicked" | "booked" | "converted" | "reversed";
  url: string;
}

interface OfferRow {
  booking_provider: "cal.com" | null;
  booking_url: string | null;
  city: string | null;
  country: string;
  disclosure: string;
  evidence_level: string;
  id: string;
  kind: PartnerOfferKind;
  price_label: string | null;
  rank_score: string | number;
  reason: string;
  title: string;
}

interface ReferralRow {
  id: string;
  offer_id: string;
  provider: string | null;
  provider_reference: string | null;
  redirect_url: string;
  status: PartnerReferralRecord["status"];
}

function mapOffer(row: OfferRow): PartnerOfferRecord {
  return {
    bookingProvider: row.booking_provider,
    bookingUrl: row.booking_url,
    city: row.city,
    country: row.country,
    disclosure: row.disclosure,
    evidenceLevel: row.evidence_level,
    id: row.id,
    kind: row.kind,
    priceLabel: row.price_label,
    rank: Number(row.rank_score),
    reason: row.reason,
    title: row.title,
  };
}

function mapReferral(row: ReferralRow): PartnerReferralRecord {
  return {
    id: row.id,
    offerId: row.offer_id,
    provider: row.provider,
    providerReference: row.provider_reference,
    status: row.status,
    url: row.redirect_url,
  };
}

export interface PartnerMarketplaceStore {
  createReferral(input: {
    actorUserId: string;
    dogId: string;
    householdId: string;
    offerId: string;
    rewardfulReferralId?: string | null;
  }): Promise<PartnerReferralRecord>;
  listOffers(input: {
    dogId: string;
    householdId: string;
    kind?: PartnerOfferKind | null;
  }): Promise<PartnerOfferRecord[]>;
}

export class InMemoryPartnerMarketplaceStore implements PartnerMarketplaceStore {
  readonly #offers: PartnerOfferRecord[];
  readonly #referrals = new Map<string, PartnerReferralRecord>();

  constructor(offers: PartnerOfferRecord[] = defaultPartnerOffers) {
    this.#offers = offers;
  }

  async listOffers(
    input: Parameters<PartnerMarketplaceStore["listOffers"]>[0],
  ) {
    return this.#offers
      .filter(
        (offer) =>
          input.kind === undefined ||
          input.kind === null ||
          offer.kind === input.kind,
      )
      .sort((left, right) => right.rank - left.rank)
      .map((offer) => structuredClone(offer));
  }

  async createReferral(
    input: Parameters<PartnerMarketplaceStore["createReferral"]>[0],
  ) {
    const offer = this.#offers.find(
      (candidate) => candidate.id === input.offerId,
    );
    if (offer === undefined) throw new Error("RESOURCE_NOT_FOUND");
    const id = crypto.randomUUID();
    const url = new URL(
      offer.bookingUrl ?? `https://dogos.example/partners/${offer.id}`,
    );
    url.searchParams.set("dogos_referral", id);
    if (input.rewardfulReferralId) {
      url.searchParams.set("rewardful_referral", input.rewardfulReferralId);
    }
    const referral: PartnerReferralRecord = {
      id,
      offerId: offer.id,
      provider: offer.bookingProvider,
      providerReference: null,
      status: "created",
      url: url.toString(),
    };
    this.#referrals.set(id, referral);
    return structuredClone(referral);
  }
}

export class PartnerMarketplaceRepository implements PartnerMarketplaceStore {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 3, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async listOffers(
    input: Parameters<PartnerMarketplaceStore["listOffers"]>[0],
  ) {
    const rows = await this.#sql<OfferRow[]>`
      select
        offer.id::text,
        offer.kind,
        offer.title,
        offer.reason,
        offer.country,
        offer.city,
        offer.price_label,
        offer.evidence_level,
        offer.disclosure,
        offer.booking_provider,
        offer.booking_url,
        offer.rank_score
      from api.partner_offers offer
      where offer.status = 'active'
        and offer.country in ('CH', 'DE', 'AT')
        and (${input.kind ?? null}::text is null or offer.kind = ${input.kind ?? null})
      order by offer.rank_score desc, offer.created_at desc
      limit 20
    `;
    return rows.map(mapOffer);
  }

  async createReferral(
    input: Parameters<PartnerMarketplaceStore["createReferral"]>[0],
  ) {
    const [row] = await this.#sql<ReferralRow[]>`
      insert into private.partner_referrals (
        household_id, dog_id, actor_user_id, offer_id, rewardful_referral_id
      )
      values (
        ${input.householdId}::uuid,
        ${input.dogId}::uuid,
        ${input.actorUserId}::uuid,
        ${input.offerId}::uuid,
        ${input.rewardfulReferralId ?? null}
      )
      returning id::text, offer_id::text, provider, provider_reference, redirect_url, status
    `;
    if (row === undefined) throw new Error("PARTNER_REFERRAL_CREATE_FAILED");
    return mapReferral(row);
  }
}

const defaultPartnerOffers: PartnerOfferRecord[] = [
  {
    bookingProvider: "cal.com",
    bookingUrl: "https://cal.com/dogos/demo-trainer",
    city: "Zurich",
    country: "CH",
    disclosure: "Professional referral. Commission never affects ranking.",
    evidenceLevel: "professional_consensus",
    id: "00000000-0000-0000-0000-000000000101",
    kind: "trainer_booking",
    priceLabel: "From CHF 95",
    rank: 0.91,
    reason: "Certified force-free trainer with recall and leash-work coverage.",
    title: "Certified recall trainer",
  },
  {
    bookingProvider: null,
    bookingUrl: "https://dogos.example/vet-triage",
    city: null,
    country: "CH",
    disclosure: "Veterinary escalation. DogOS does not provide diagnosis.",
    evidenceLevel: "professional_consensus",
    id: "00000000-0000-0000-0000-000000000102",
    kind: "veterinary_triage",
    priceLabel: null,
    rank: 0.88,
    reason:
      "Use when pain, acute health change, injury, or food refusal appears.",
    title: "Veterinary triage guidance",
  },
  {
    bookingProvider: null,
    bookingUrl: "https://dogos.example/gear/long-line",
    city: null,
    country: "CH",
    disclosure: "Affiliate link. Suitability is ranked before commission.",
    evidenceLevel: "professional_consensus",
    id: "00000000-0000-0000-0000-000000000103",
    kind: "affiliate_equipment",
    priceLabel: "CHF 24-39",
    rank: 0.8,
    reason:
      "Long-line recall setup for distance without removing safety control.",
    title: "Light 5-10m training line",
  },
];
