alter table private.onboarding_projections
  add column owner_user_id uuid references api.users(id) on delete cascade;

alter table private.onboarding_projections
  alter column contact_id drop not null;

alter table private.onboarding_projections
  add constraint onboarding_projection_single_source_check
  check (num_nonnulls(contact_id, owner_user_id) = 1);

create unique index onboarding_projections_owner_user_unique
  on private.onboarding_projections(owner_user_id)
  where owner_user_id is not null;

create table private.owner_onboarding_sessions (
  owner_user_id uuid primary key references api.users(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  state jsonb not null,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.owner_onboarding_sessions enable row level security;
alter table private.owner_onboarding_sessions force row level security;
revoke all on private.owner_onboarding_sessions from public, anon, authenticated;
grant all on private.owner_onboarding_sessions to service_role;

create index owner_onboarding_sessions_household_idx
  on private.owner_onboarding_sessions(household_id);
