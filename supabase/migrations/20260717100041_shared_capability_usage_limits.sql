create table private.capability_usage_buckets (
  household_id uuid not null references api.households(id) on delete cascade,
  actor_user_id uuid not null references api.users(id) on delete cascade,
  capability_code api.canonical_code not null,
  period_kind text not null check (period_kind in ('day', 'month')),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (
    household_id, actor_user_id, capability_code, period_kind, period_start
  )
);

alter table private.capability_usage_buckets enable row level security;
alter table private.capability_usage_buckets force row level security;

create or replace function private.consume_capability(
  p_household_id uuid,
  p_actor_user_id uuid,
  p_capability_code api.canonical_code,
  p_period_kind text,
  p_limit integer,
  p_period_start date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  if p_limit < 0 or p_period_kind not in ('day', 'month') then
    raise exception 'CAPABILITY_LIMIT_INVALID' using errcode = 'P0001';
  end if;
  if p_limit = 0 then return false; end if;
  if not exists (
    select 1 from api.household_members
    where household_id = p_household_id
      and user_id = p_actor_user_id
      and status = 'active'
      and revoked_at is null
  ) then
    raise exception 'ACCESS_DENIED' using errcode = 'P0001';
  end if;

  insert into private.capability_usage_buckets (
    household_id, actor_user_id, capability_code, period_kind,
    period_start, used
  ) values (
    p_household_id, p_actor_user_id, p_capability_code, p_period_kind,
    p_period_start, 1
  )
  on conflict (
    household_id, actor_user_id, capability_code, period_kind, period_start
  ) do update
    set used = private.capability_usage_buckets.used + 1,
        updated_at = now()
    where private.capability_usage_buckets.used < p_limit
  returning used into v_used;
  return v_used is not null;
end;
$$;

revoke all on table private.capability_usage_buckets
  from public, anon, authenticated;
grant all on table private.capability_usage_buckets to service_role;
revoke all on function private.consume_capability(
  uuid, uuid, api.canonical_code, text, integer, date
) from public, anon, authenticated;
grant execute on function private.consume_capability(
  uuid, uuid, api.canonical_code, text, integer, date
) to service_role;
