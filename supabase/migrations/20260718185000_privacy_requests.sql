create type api.privacy_request_status as enum (
  'requested',
  'processing',
  'completed',
  'rejected_legal_hold'
);

create table api.privacy_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  actor_user_id uuid not null references api.users(id) on delete restrict,
  status api.privacy_request_status not null default 'requested',
  reason text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_summary jsonb not null default '{}'::jsonb,
  check (reason is null or char_length(reason) <= 500),
  check (jsonb_typeof(retention_summary) = 'object')
);

alter table api.privacy_deletion_requests enable row level security;
alter table api.privacy_deletion_requests force row level security;

create policy privacy_deletion_requests_owner_read on api.privacy_deletion_requests
for select to authenticated
using (
  private.has_household_role(
    household_id,
    array['owner']::api.membership_role[]
  )
);

revoke all on table api.privacy_deletion_requests from public, anon;
grant select on table api.privacy_deletion_requests to authenticated;
grant all on table api.privacy_deletion_requests to service_role;
