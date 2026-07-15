create domain api.reason_code as text
  check (value ~ '^[A-Z][A-Z0-9_]*$');

create domain api.measurement_source as text
  check (value in ('owner_report', 'trainer_report', 'system', 'future_video'));

alter type api.evidence_level rename value 'user_report' to 'owner_report';

update api.dog_history set source = 'owner_report' where source = 'user_report';
update api.dog_health_context set source = 'owner_report' where source = 'user_report';
update api.anamnesis_answers set source = 'owner_report' where source = 'user_report';
update api.behavior_concerns set source = 'owner_report' where source = 'user_report';
update api.safety_events set source = 'owner_report' where source = 'user_report';
update api.goal_measurements set source = 'owner_report' where source = 'user_report';
update api.session_measurements set source = 'owner_report' where source = 'user_report';
update api.observations set source = 'owner_report' where source = 'user_report';

alter table api.dog_history alter column source drop default;
alter table api.dog_history alter column source type api.measurement_source using source::api.measurement_source;
alter table api.dog_history alter column source set default 'owner_report';
alter table api.dog_health_context alter column source drop default;
alter table api.dog_health_context alter column source type api.measurement_source using source::api.measurement_source;
alter table api.dog_health_context alter column source set default 'owner_report';
alter table api.anamnesis_answers alter column source drop default;
alter table api.anamnesis_answers alter column source type api.measurement_source using source::api.measurement_source;
alter table api.anamnesis_answers alter column source set default 'owner_report';
alter table api.behavior_concerns alter column source drop default;
alter table api.behavior_concerns alter column source type api.measurement_source using source::api.measurement_source;
alter table api.behavior_concerns alter column source set default 'owner_report';
alter table api.safety_events alter column source drop default;
alter table api.safety_events alter column source type api.measurement_source using source::api.measurement_source;
alter table api.safety_events alter column source set default 'owner_report';
alter table api.goal_measurements alter column source type api.measurement_source using source::api.measurement_source;
alter table api.session_measurements alter column source type api.measurement_source using source::api.measurement_source;
alter table api.observations alter column source type api.measurement_source using source::api.measurement_source;

alter table api.plan_versions
  alter column generation_reason_codes type api.reason_code[]
  using generation_reason_codes::text[]::api.reason_code[];
alter table api.data_quality_assessments
  alter column reason_codes type api.reason_code[]
  using reason_codes::text[]::api.reason_code[];
alter table api.plan_adjustments
  alter column reason_codes type api.reason_code[]
  using reason_codes::text[]::api.reason_code[];
alter table api.professional_referrals
  alter column reason_code type api.reason_code
  using reason_code::text::api.reason_code;

alter table api.risk_assessments
  add column reason_codes api.reason_code[] not null default '{}';
alter table api.progress_evaluations
  add column reason_codes api.reason_code[] not null default '{}',
  add column candidate_next_action api.canonical_code,
  alter column confidence drop not null,
  drop constraint progress_evaluations_confidence_check,
  add constraint progress_evaluations_confidence_check
    check (confidence in ('unavailable', 'low', 'moderate', 'high'));

create table private.command_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references api.users(id) on delete cascade,
  command_code api.canonical_code not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  trace_id text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (actor_user_id, command_code, idempotency_key),
  check ((response_status is null) = (response_body is null)),
  check (response_status is null or response_status between 200 and 599)
);

create table private.signed_actions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  key_id text not null,
  purpose api.canonical_code not null,
  household_id uuid not null references api.households(id) on delete cascade,
  actor_user_id uuid references api.users(id) on delete cascade,
  contact_id uuid references api.user_contacts(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  nonce text not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  one_time boolean not null default false,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check (consumed_at is null or consumed_at >= issued_at),
  check (revoked_at is null or revoked_at >= issued_at)
);

alter table private.command_idempotency enable row level security;
alter table private.command_idempotency force row level security;
alter table private.signed_actions enable row level security;
alter table private.signed_actions force row level security;

comment on domain api.reason_code is
  'Stable uppercase persisted engine reason such as SAFETY_SUSPECTED_PAIN.';
comment on domain api.measurement_source is
  'Canonical source vocabulary shared by owner facts and measurements.';
comment on table private.command_idempotency is
  'Server-only command deduplication and exact retry response storage.';
comment on table private.signed_actions is
  'Server-only purpose-bound signed action state for expiry, revocation and replay protection.';
