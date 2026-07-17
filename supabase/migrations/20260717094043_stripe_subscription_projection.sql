create or replace function private.project_stripe_subscription(
  p_event_id text,
  p_event_type text,
  p_household_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_tier_code api.canonical_code,
  p_canonical_status text,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id uuid;
  v_capability record;
begin
  if p_event_id is null or p_event_type is null then
    raise exception 'PROVIDER_EVENT_INVALID' using errcode = 'P0001';
  end if;
  if p_canonical_status not in (
    'active', 'trialing', 'past_due', 'incomplete', 'paused', 'canceled'
  ) then
    raise exception 'SUBSCRIPTION_STATUS_UNSUPPORTED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from private.tier_catalog
    where tier_code = p_tier_code and active
  ) then
    raise exception 'SUBSCRIPTION_TIER_UNSUPPORTED' using errcode = 'P0001';
  end if;

  insert into private.provider_events (
    provider, provider_event_id, event_type, signature_result,
    processing_status, bounded_payload
  ) values (
    'stripe', p_event_id, p_event_type, 'verified', 'processing',
    jsonb_build_object(
      'householdId', p_household_id,
      'subscriptionId', p_subscription_id,
      'tier', p_tier_code,
      'status', p_canonical_status
    )
  ) on conflict (provider, provider_event_id) do nothing;
  if not found then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  update api.entitlements
  set status = 'inactive',
      effective_until = coalesce(
        effective_until,
        greatest(effective_from + interval '1 microsecond', clock_timestamp())
      )
  where household_id = p_household_id
    and status = 'active';
  update api.subscriptions
  set canonical_status = 'canceled', updated_at = now()
  where household_id = p_household_id
    and canonical_status in ('active', 'trialing', 'past_due');

  if p_tier_code = 'tier.freemium' then
    select id into v_subscription_id
    from api.subscriptions
    where household_id = p_household_id and provider = 'local'
    order by created_at
    limit 1;
    if v_subscription_id is null then
      insert into api.subscriptions (
        household_id, provider, tier_code, canonical_status,
        current_period_start
      ) values (
        p_household_id, 'local', 'tier.freemium', 'active', now()
      ) returning id into v_subscription_id;
    else
      update api.subscriptions
      set tier_code = 'tier.freemium', canonical_status = 'active',
          current_period_start = now(), current_period_end = null,
          updated_at = now()
      where id = v_subscription_id;
    end if;
  else
    insert into api.subscriptions (
      household_id, provider, provider_customer_id, provider_subscription_id,
      tier_code, canonical_status, current_period_start, current_period_end
    ) values (
      p_household_id, 'stripe', p_customer_id, p_subscription_id,
      p_tier_code, p_canonical_status, p_period_start, p_period_end
    )
    on conflict (provider, provider_subscription_id) do update
    set provider_customer_id = excluded.provider_customer_id,
        tier_code = excluded.tier_code,
        canonical_status = excluded.canonical_status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        updated_at = now()
    returning id into v_subscription_id;
  end if;

  for v_capability in
    select capability.key, capability.value
    from private.tier_catalog catalog,
      lateral jsonb_each(catalog.capabilities) capability
    where catalog.tier_code = p_tier_code
  loop
    insert into api.entitlements (
      household_id, subscription_id, capability_code, limits,
      effective_from, effective_until, source_code, status
    ) values (
      p_household_id, v_subscription_id, v_capability.key::api.canonical_code,
      v_capability.value, now(), null,
      case when p_tier_code = 'tier.freemium'
        then 'entitlement.account_default'::api.canonical_code
        else 'entitlement.stripe_subscription'::api.canonical_code
      end,
      'active'
    );
  end loop;

  update private.provider_events
  set processing_status = 'processed', processed_at = now()
  where provider = 'stripe' and provider_event_id = p_event_id;
  return true;
exception when others then
  update private.provider_events
  set processing_status = 'failed', processed_at = now()
  where provider = 'stripe' and provider_event_id = p_event_id;
  raise;
end;
$$;

revoke all on function private.project_stripe_subscription(
  text, text, uuid, text, text, api.canonical_code, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function private.project_stripe_subscription(
  text, text, uuid, text, text, api.canonical_code, text, timestamptz, timestamptz
) to service_role;

create index subscriptions_provider_customer_idx
  on api.subscriptions(provider, provider_customer_id)
  where provider_customer_id is not null;
