create table if not exists api.partner_offers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'affiliate_equipment', 'affiliate_food', 'trainer_booking', 'veterinary_triage'
  )),
  title text not null check (char_length(title) between 3 and 140),
  reason text not null check (char_length(reason) between 3 and 500),
  country api.country_code not null default 'CH',
  city text,
  price_label text,
  evidence_level api.evidence_level not null default 'professional_consensus',
  disclosure text not null check (char_length(disclosure) between 3 and 500),
  booking_provider text check (booking_provider is null or booking_provider in ('cal.com')),
  booking_url text,
  affiliate_url text,
  rank_score numeric not null default 0 check (rank_score between 0 and 1),
  commission_basis_points integer not null default 0
    check (commission_basis_points between 0 and 10000),
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'revoked')),
  reviewed_by uuid references api.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (commission_basis_points = 0 or disclosure ilike '%affiliate%'),
  check (status <> 'active' or reviewed_at is not null)
);

create table if not exists private.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  actor_user_id uuid not null references api.users(id) on delete restrict,
  offer_id uuid not null references api.partner_offers(id) on delete restrict,
  rewardful_referral_id text,
  provider text,
  provider_reference text,
  redirect_url text not null,
  status text not null default 'created'
    check (status in ('created', 'clicked', 'booked', 'converted', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.partner_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references private.partner_referrals(id) on delete cascade,
  provider text not null check (provider in ('rewardful', 'manual', 'stripe')),
  provider_event_id text,
  amount_minor integer not null default 0,
  currency api.currency_code not null default 'CHF',
  entry_type text not null check (entry_type in ('pending', 'approved', 'paid', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create or replace function private.create_partner_redirect(
  offer_id uuid,
  referral_id uuid,
  rewardful_referral_id text
) returns text
language plpgsql
stable
as $$
declare
  selected api.partner_offers%rowtype;
  base_url text;
begin
  select * into selected from api.partner_offers where id = offer_id;
  if selected.id is null then
    raise exception 'PARTNER_OFFER_NOT_FOUND';
  end if;
  base_url := coalesce(selected.booking_url, selected.affiliate_url);
  if base_url is null or base_url !~ '^https://[^[:space:]]+$' then
    raise exception 'PARTNER_OFFER_REDIRECT_INVALID';
  end if;
  return base_url ||
    case when position('?' in base_url) > 0 then '&' else '?' end ||
    'dogos_referral=' || referral_id::text ||
    case
      when rewardful_referral_id is null then ''
      else '&rewardful_referral=' || replace(rewardful_referral_id, ' ', '')
    end;
end;
$$;

create or replace function private.partner_referral_redirect()
returns trigger
language plpgsql
as $$
declare
  selected api.partner_offers%rowtype;
begin
  select * into selected from api.partner_offers where id = new.offer_id;
  if selected.status <> 'active' then
    raise exception 'PARTNER_OFFER_NOT_ACTIVE';
  end if;
  new.provider := selected.booking_provider;
  new.redirect_url := private.create_partner_redirect(
    new.offer_id,
    new.id,
    new.rewardful_referral_id
  );
  return new;
end;
$$;

drop trigger if exists partner_referral_redirect_before_insert
  on private.partner_referrals;
create trigger partner_referral_redirect_before_insert
  before insert on private.partner_referrals
  for each row execute function private.partner_referral_redirect();

create index if not exists partner_offers_active_kind_idx
  on api.partner_offers (kind, country, rank_score desc)
  where status = 'active';
create index if not exists partner_referrals_household_dog_idx
  on private.partner_referrals (household_id, dog_id, created_at desc);

alter table api.partner_offers enable row level security;
alter table api.partner_offers force row level security;

create policy "active partner offers are visible to authenticated users"
  on api.partner_offers
  for select
  to authenticated
  using (status = 'active');

revoke all on api.partner_offers from public, anon;
grant select on api.partner_offers to authenticated;
grant all on api.partner_offers to service_role;
revoke all on private.partner_referrals from anon, authenticated;
revoke all on private.partner_commission_ledger from anon, authenticated;

insert into api.partner_offers (
  id, kind, title, reason, country, city, price_label, evidence_level,
  disclosure, booking_provider, booking_url, affiliate_url, rank_score,
  commission_basis_points, status, reviewed_at
) values
  (
    '00000000-0000-0000-0000-000000000101',
    'trainer_booking',
    'Certified recall trainer',
    'Certified force-free trainer with recall and leash-work coverage.',
    'CH',
    'Zurich',
    'From CHF 95',
    'professional_consensus',
    'Professional referral. Commission never affects ranking.',
    'cal.com',
    'https://cal.com/dogos/demo-trainer',
    null,
    0.91,
    0,
    'active',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'veterinary_triage',
    'Veterinary triage guidance',
    'Use when pain, acute health change, injury, or food refusal appears.',
    'CH',
    null,
    null,
    'professional_consensus',
    'Veterinary escalation. DogOS does not provide diagnosis.',
    null,
    'https://dogos.example/vet-triage',
    null,
    0.88,
    0,
    'active',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'affiliate_equipment',
    'Light 5-10m training line',
    'Long-line recall setup for distance without removing safety control.',
    'CH',
    null,
    'CHF 24-39',
    'professional_consensus',
    'Affiliate link. Suitability is ranked before commission.',
    null,
    null,
    'https://dogos.example/gear/long-line',
    0.80,
    1200,
    'active',
    now()
  )
on conflict (id) do update set
  kind = excluded.kind,
  title = excluded.title,
  reason = excluded.reason,
  disclosure = excluded.disclosure,
  rank_score = excluded.rank_score,
  status = excluded.status,
  updated_at = now();
