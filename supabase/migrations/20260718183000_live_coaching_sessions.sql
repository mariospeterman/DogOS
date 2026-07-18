create type api.live_coaching_status as enum (
  'created',
  'active',
  'completed',
  'failed'
);

create table api.live_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  actor_user_id uuid not null references api.users(id) on delete restrict,
  status api.live_coaching_status not null default 'created',
  room_name text not null unique check (room_name ~ '^dogos-[a-f0-9-]{36}$'),
  planned_minutes integer not null check (planned_minutes between 1 and 60),
  consumed_minutes integer not null default 0 check (consumed_minutes >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table api.live_coaching_sessions enable row level security;
alter table api.live_coaching_sessions force row level security;

create trigger live_coaching_sessions_set_updated_at before update on api.live_coaching_sessions
for each row execute function private.set_updated_at();

create index live_coaching_sessions_household_dog_created_idx
  on api.live_coaching_sessions(household_id, dog_id, created_at desc);

create policy live_coaching_sessions_household_read on api.live_coaching_sessions
for select to authenticated
using (private.can_read_household(household_id));

revoke all on table api.live_coaching_sessions from public, anon;
grant select on table api.live_coaching_sessions to authenticated;
grant all on table api.live_coaching_sessions to service_role;
