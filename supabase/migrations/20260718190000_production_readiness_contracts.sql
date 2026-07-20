create type private.video_analysis_job_status as enum (
  'queued',
  'processing',
  'completed',
  'failed',
  'dead_letter'
);

create table private.video_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references api.video_analyses(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  status private.video_analysis_job_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  failure_code api.canonical_code,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger video_analysis_jobs_set_updated_at before update on private.video_analysis_jobs
for each row execute function private.set_updated_at();

create index video_analysis_jobs_status_next_attempt_idx
  on private.video_analysis_jobs(status, next_attempt_at, created_at);

create index video_analysis_jobs_household_created_idx
  on private.video_analysis_jobs(household_id, created_at desc);

alter table private.video_analysis_jobs enable row level security;
alter table private.video_analysis_jobs force row level security;

revoke all on table private.video_analysis_jobs from public, anon, authenticated;
grant all on table private.video_analysis_jobs to service_role;

create table private.video_analysis_observations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references api.video_analyses(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  observation_code api.canonical_code not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  evidence text not null check (char_length(evidence) between 1 and 800),
  recommendation text not null check (char_length(recommendation) between 1 and 800),
  status text not null default 'candidate'
    check (status in ('candidate', 'confirmed', 'rejected', 'superseded')),
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(source_refs) = 'array')
);

create index video_analysis_observations_analysis_idx
  on private.video_analysis_observations(analysis_id, created_at);

alter table private.video_analysis_observations enable row level security;
alter table private.video_analysis_observations force row level security;

revoke all on table private.video_analysis_observations from public, anon, authenticated;
grant all on table private.video_analysis_observations to service_role;

alter table private.coach_messages
  add column if not exists workspace text not null default 'coach'
    check (workspace in ('setup', 'coach', 'plan', 'train', 'progress', 'media')),
  add column if not exists secondary_tags text[] not null default '{}',
  add column if not exists artifact_refs jsonb not null default '[]'::jsonb,
  add column if not exists ui_parts jsonb not null default '[]'::jsonb,
  add column if not exists parent_message_id uuid references private.coach_messages(id) on delete set null,
  add column if not exists superseded_by_message_id uuid references private.coach_messages(id) on delete set null,
  add column if not exists generation_status text not null default 'completed'
    check (generation_status in ('pending', 'streaming', 'completed', 'failed', 'superseded')),
  add column if not exists immutable_metadata jsonb not null default '{}'::jsonb,
  add column if not exists searchable_text tsvector generated always as (
    to_tsvector('simple', coalesce(content, ''))
  ) stored,
  add constraint coach_messages_artifact_refs_array
    check (jsonb_typeof(artifact_refs) = 'array'),
  add constraint coach_messages_ui_parts_array
    check (jsonb_typeof(ui_parts) = 'array'),
  add constraint coach_messages_immutable_metadata_object
    check (jsonb_typeof(immutable_metadata) = 'object');

create index if not exists coach_messages_conversation_created_idx
  on private.coach_messages(conversation_id, created_at, id);

create index if not exists coach_messages_workspace_created_idx
  on private.coach_messages(workspace, created_at desc);

create index if not exists coach_messages_context_subject_idx
  on private.coach_messages(context_kind, context_subject_id)
  where context_subject_id is not null;

create index if not exists coach_messages_artifact_refs_gin_idx
  on private.coach_messages using gin (artifact_refs);

create index if not exists coach_messages_search_gin_idx
  on private.coach_messages using gin (searchable_text);

create type private.memory_fact_status as enum (
  'candidate',
  'confirmed',
  'rejected',
  'superseded',
  'expired',
  'forgotten'
);

create table private.memory_facts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid references api.dogs(id) on delete cascade,
  category text not null check (
    category in (
      'stable_profile',
      'episodic_event',
      'working_state',
      'derived_pattern',
      'temporary_state'
    )
  ),
  subject text not null check (char_length(subject) between 1 and 120),
  value text not null check (char_length(value) between 1 and 1000),
  source_message_id uuid references private.coach_messages(id) on delete set null,
  evidence_refs jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  sensitivity text not null default 'normal'
    check (sensitivity in ('normal', 'sensitive', 'high')),
  status private.memory_fact_status not null default 'candidate',
  observed_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz,
  superseded_by uuid references private.memory_facts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(evidence_refs) = 'array')
);

create trigger memory_facts_set_updated_at before update on private.memory_facts
for each row execute function private.set_updated_at();

create index memory_facts_lookup_idx
  on private.memory_facts(household_id, dog_id, status, category, updated_at desc);

create index memory_facts_search_idx
  on private.memory_facts using gin (
    to_tsvector('simple', subject || ' ' || value)
  );

alter table private.memory_facts enable row level security;
alter table private.memory_facts force row level security;

revoke all on table private.memory_facts from public, anon, authenticated;
grant all on table private.memory_facts to service_role;

create table api.notification_preferences (
  household_id uuid primary key references api.households(id) on delete cascade,
  timezone text not null default 'Europe/Zurich',
  quiet_hours_start time,
  quiet_hours_end time,
  web_push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table api.notification_preferences enable row level security;
alter table api.notification_preferences force row level security;

create trigger notification_preferences_set_updated_at before update on api.notification_preferences
for each row execute function private.set_updated_at();

create policy notification_preferences_owner_read on api.notification_preferences
for select to authenticated
using (private.has_household_role(household_id, array['owner']::api.membership_role[]));

revoke all on table api.notification_preferences from public, anon;
grant select on table api.notification_preferences to authenticated;
grant all on table api.notification_preferences to service_role;
