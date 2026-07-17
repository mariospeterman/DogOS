alter table api.users
  add column display_name text
  check (display_name is null or char_length(display_name) between 1 and 120);

create table private.tier_catalog (
  tier_code api.canonical_code primary key,
  rank smallint not null unique check (rank between 0 and 100),
  capabilities jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(capabilities) = 'object')
);

alter table private.tier_catalog enable row level security;
alter table private.tier_catalog force row level security;

insert into private.tier_catalog (tier_code, rank, capabilities)
values
  ('tier.freemium', 0, '{
    "capability.coaching_messages": {"perDay": 12},
    "capability.concurrent_dogs": {"maximum": 1},
    "capability.live_coaching_minutes": {"perMonth": 0},
    "capability.plan_adjustments": {"perMonth": 1},
    "capability.video_analyses": {"perMonth": 0}
  }'),
  ('tier.plus', 10, '{
    "capability.coaching_messages": {"perDay": 40},
    "capability.concurrent_dogs": {"maximum": 2},
    "capability.live_coaching_minutes": {"perMonth": 0},
    "capability.plan_adjustments": {"perMonth": 4},
    "capability.video_analyses": {"perMonth": 2}
  }'),
  ('tier.pro', 20, '{
    "capability.coaching_messages": {"perDay": 100},
    "capability.concurrent_dogs": {"maximum": 5},
    "capability.live_coaching_minutes": {"perMonth": 60},
    "capability.plan_adjustments": {"perMonth": 12},
    "capability.video_analyses": {"perMonth": 10}
  }'),
  ('tier.ultra', 30, '{
    "capability.coaching_messages": {"perDay": 250},
    "capability.concurrent_dogs": {"maximum": 10},
    "capability.live_coaching_minutes": {"perMonth": 240},
    "capability.plan_adjustments": {"perMonth": 30},
    "capability.video_analyses": {"perMonth": 30}
  }');

create unique index subscriptions_one_current_per_household_idx
  on api.subscriptions(household_id)
  where canonical_status in ('active', 'trialing', 'past_due');

create unique index entitlements_one_active_capability_idx
  on api.entitlements(household_id, capability_code)
  where status = 'active' and effective_until is null;

create or replace function private.bootstrap_account(
  p_auth_user_id uuid,
  p_display_name text,
  p_locale api.locale_tag default 'en'
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
  v_capability record;
begin
  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'AUTH_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));
  v_display_name := nullif(left(trim(p_display_name), 120), '');

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

revoke all on table private.tier_catalog from public, anon, authenticated;
grant all on table private.tier_catalog to service_role;
revoke all on function private.bootstrap_account(uuid, text, api.locale_tag)
  from public, anon, authenticated;
grant execute on function private.bootstrap_account(uuid, text, api.locale_tag)
  to service_role;
