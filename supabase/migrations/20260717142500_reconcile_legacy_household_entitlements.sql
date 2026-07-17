create or replace function private.ensure_household_entitlements(
  p_household_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id uuid;
  v_tier_code api.canonical_code;
  v_capability record;
begin
  if not exists (
    select 1 from api.households
    where id = p_household_id and status = 'active'
  ) then
    raise exception 'ACTIVE_HOUSEHOLD_NOT_FOUND' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  select id, tier_code
  into v_subscription_id, v_tier_code
  from api.subscriptions
  where household_id = p_household_id
    and canonical_status in ('active', 'trialing', 'past_due')
  order by created_at
  limit 1;

  if v_subscription_id is null then
    insert into api.subscriptions (
      household_id, provider, provider_subscription_id, tier_code,
      canonical_status, current_period_start
    ) values (
      p_household_id, 'dogos', 'free:' || p_household_id::text,
      'tier.freemium', 'active', now()
    )
    returning id, tier_code into v_subscription_id, v_tier_code;
  end if;

  for v_capability in
    select capability.key, capability.value
    from private.tier_catalog catalog,
      lateral jsonb_each(catalog.capabilities) capability
    where catalog.tier_code = v_tier_code and catalog.active
  loop
    if not exists (
      select 1 from api.entitlements
      where household_id = p_household_id
        and capability_code = v_capability.key::api.canonical_code
        and status = 'active'
        and effective_from <= now()
        and (effective_until is null or effective_until > now())
    ) then
      insert into api.entitlements (
        household_id, subscription_id, capability_code, limits,
        effective_from, source_code, status
      ) values (
        p_household_id, v_subscription_id,
        v_capability.key::api.canonical_code, v_capability.value,
        now(), 'source.account_bootstrap', 'active'
      );
    end if;
  end loop;

  return v_subscription_id;
end;
$$;

revoke all on function private.ensure_household_entitlements(uuid)
  from public, anon, authenticated;
grant execute on function private.ensure_household_entitlements(uuid)
  to service_role;

select private.ensure_household_entitlements(id)
from api.households
where status = 'active';
