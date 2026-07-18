create table private.account_attributions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  app_user_id uuid not null references api.users(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  source_code api.canonical_code not null,
  referral_code text,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (referral_code is null or referral_code ~ '^[A-Z0-9]{6,32}$'),
  check (jsonb_typeof(metadata) = 'object')
);

alter table private.account_attributions enable row level security;
alter table private.account_attributions force row level security;

create unique index account_attributions_one_first_touch_idx
  on private.account_attributions(auth_user_id)
  where source_code = 'source.landing_referral';

drop function private.bootstrap_account(uuid, text, api.locale_tag);

create or replace function private.bootstrap_account(
  p_auth_user_id uuid,
  p_display_name text,
  p_locale api.locale_tag default 'en',
  p_referral_code text default null
)
returns table (
  app_user_id uuid,
  household_id uuid,
  membership_role api.membership_role,
  subscription_tier api.canonical_code
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_household_id uuid;
  v_subscription_id uuid;
  v_display_name text;
  v_referral_code text;
  v_capability record;
begin
  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'AUTH_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));
  v_display_name := nullif(left(trim(p_display_name), 120), '');
  v_referral_code := nullif(upper(trim(coalesce(p_referral_code, ''))), '');
  if v_referral_code is not null and v_referral_code !~ '^[A-Z0-9]{6,32}$' then
    raise exception 'REFERRAL_CODE_INVALID' using errcode = 'P0001';
  end if;

  insert into api.users (
    auth_user_id, display_name, preferred_locale, locale_status, fallback_locale,
    country, legal_jurisdiction, timezone, currency
  )
  values (
    p_auth_user_id, v_display_name, p_locale, 'detected', 'en',
    'CH', 'CH', 'Europe/Zurich', 'CHF'
  )
  on conflict (auth_user_id) do update
    set display_name = coalesce(api.users.display_name, excluded.display_name),
        updated_at = now()
  returning id into v_user_id;

  select hm.household_id
  into v_household_id
  from api.household_members hm
  where hm.user_id = v_user_id
    and hm.status = 'active'
  order by case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
    hm.created_at
  limit 1;

  if v_household_id is null then
    insert into api.households (
      name, default_locale, fallback_locale, country, legal_jurisdiction,
      timezone, currency, created_by
    )
    values (
      coalesce(v_display_name || ' household', 'DogOS household'),
      p_locale, 'en', 'CH', 'CH', 'Europe/Zurich', 'CHF', v_user_id
    )
    returning id into v_household_id;

    insert into api.household_members (
      household_id, user_id, role, status, joined_at
    )
    values (v_household_id, v_user_id, 'owner', 'active', now());
  end if;

  if v_referral_code is not null then
    insert into private.account_attributions (
      auth_user_id, app_user_id, household_id, source_code, referral_code,
      metadata
    )
    values (
      p_auth_user_id, v_user_id, v_household_id, 'source.landing_referral',
      v_referral_code, jsonb_build_object('channel', 'web')
    )
    on conflict (auth_user_id)
      where source_code = 'source.landing_referral'
    do nothing;
  end if;

  select s.id
  into v_subscription_id
  from api.subscriptions s
  where s.household_id = v_household_id
    and s.canonical_status in ('active', 'trialing', 'past_due')
  limit 1;

  if v_subscription_id is null then
    insert into api.subscriptions (
      household_id, provider, provider_subscription_id, tier_code,
      canonical_status, current_period_start
    )
    values (
      v_household_id, 'dogos', 'free:' || v_household_id::text,
      'tier.freemium', 'active', now()
    )
    returning id into v_subscription_id;
  end if;

  for v_capability in
    select key, value
    from jsonb_each((
      select tc.capabilities
      from private.tier_catalog tc
      join api.subscriptions s on s.tier_code = tc.tier_code
      where s.id = v_subscription_id
    ))
  loop
    insert into api.entitlements (
      household_id, subscription_id, capability_code, limits,
      effective_from, source_code, status
    )
    values (
      v_household_id, v_subscription_id, v_capability.key,
      v_capability.value, now(), 'source.account_bootstrap', 'active'
    )
    on conflict (household_id, capability_code)
      where status = 'active' and effective_until is null
    do nothing;
  end loop;

  return query
  select v_user_id, v_household_id, hm.role, s.tier_code
  from api.household_members hm
  join api.subscriptions s on s.id = v_subscription_id
  where hm.user_id = v_user_id
    and hm.household_id = v_household_id
    and hm.status = 'active';
end;
$$;

revoke all on table private.account_attributions from public, anon, authenticated;
grant all on table private.account_attributions to service_role;
revoke all on function private.bootstrap_account(uuid, text, api.locale_tag, text)
  from public, anon, authenticated;
grant execute on function private.bootstrap_account(uuid, text, api.locale_tag, text)
  to service_role;
