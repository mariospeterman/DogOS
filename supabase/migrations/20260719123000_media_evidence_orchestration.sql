create table if not exists private.media_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  uploader_user_id uuid not null references api.users(id),
  storage_provider text not null check (storage_provider in ('supabase')),
  storage_object_key text not null,
  checksum_sha256 text,
  expected_size_bytes bigint not null check (expected_size_bytes > 0),
  verified_size_bytes bigint check (verified_size_bytes is null or verified_size_bytes > 0),
  mime_type text not null,
  container text,
  video_codec text,
  duration_seconds numeric check (duration_seconds is null or duration_seconds > 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  frame_rate numeric check (frame_rate is null or frame_rate > 0),
  has_audio boolean,
  rotation_degrees integer,
  quality_score numeric check (quality_score is null or quality_score between 0 and 1),
  consent_version text not null,
  raw_delete_after timestamptz not null,
  derived_delete_after timestamptz not null,
  upload_status text not null default 'requested'
    check (upload_status in ('requested', 'uploaded', 'verified', 'failed', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, storage_object_key)
);

create table if not exists private.context_snapshots (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  task text not null,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  conversation_id uuid,
  locale text not null,
  compiler_version text not null,
  knowledge_release_id text,
  token_estimate integer not null default 0 check (token_estimate >= 0),
  truncated_categories text[] not null default '{}',
  selected_reasons jsonb not null default '{}'::jsonb,
  excluded_reasons jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table private.model_runs
  add column if not exists context_snapshot_id uuid
    references private.context_snapshots(id) on delete set null,
  add column if not exists task text,
  add column if not exists model_release_manifest_id text,
  add column if not exists policy_version text;

create table if not exists private.media_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references api.video_analyses(id) on delete cascade,
  media_asset_id uuid references private.media_assets(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  task text not null,
  provider text not null,
  model text not null,
  model_release_manifest_id text,
  policy_version text not null,
  context_snapshot_id uuid,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'abstained')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  failure_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.media_job_attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.media_analysis_runs(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  worker_id text not null,
  status text not null check (status in ('started', 'completed', 'failed')),
  failure_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (run_id, attempt_number)
);

create table if not exists api.timeline_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  event_type text not null,
  subject_id uuid,
  occurred_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.evidence_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  source_type text not null
    check (source_type in ('owner_report', 'session', 'video', 'live', 'cv', 'trainer_report', 'system')),
  source_id uuid,
  label text not null,
  observed_at timestamptz,
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= 0),
  confidence numeric not null check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  requires_owner_confirmation boolean not null default false,
  owner_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_ms is null or start_ms is null or end_ms >= start_ms)
);

create table if not exists private.interpretations (
  id uuid primary key default gen_random_uuid(),
  evidence_item_id uuid not null references private.evidence_items(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  interpretation_type text not null,
  candidate jsonb not null,
  status text not null default 'candidate'
    check (status in ('candidate', 'confirmed', 'rejected', 'superseded')),
  created_at timestamptz not null default now()
);

create table if not exists private.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.media_analysis_runs(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  report jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'owner_visible', 'superseded')),
  created_at timestamptz not null default now()
);

create table if not exists private.live_events (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid references api.live_coaching_sessions(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  event_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  confidence numeric check (confidence is null or confidence between 0 and 1),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists private.confidence_calibrations (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  provider text not null,
  model text not null,
  dataset_version text not null,
  threshold numeric not null check (threshold between 0 and 1),
  precision numeric check (precision is null or precision between 0 and 1),
  recall numeric check (recall is null or recall between 0 and 1),
  abstain_below numeric not null check (abstain_below between 0 and 1),
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_household_dog_idx
  on private.media_assets (household_id, dog_id, created_at desc);
create index if not exists context_snapshots_household_dog_idx
  on private.context_snapshots (household_id, dog_id, created_at desc);
create index if not exists media_analysis_runs_analysis_idx
  on private.media_analysis_runs (analysis_id, created_at desc);
create index if not exists timeline_events_household_dog_idx
  on api.timeline_events (household_id, dog_id, occurred_at desc);
create index if not exists evidence_items_household_dog_idx
  on private.evidence_items (household_id, dog_id, created_at desc);
create index if not exists live_events_session_idx
  on private.live_events (live_session_id, started_at desc);

alter table api.timeline_events enable row level security;
alter table api.timeline_events force row level security;

create policy "timeline events are visible to household members"
  on api.timeline_events
  for select
  to authenticated
  using (private.can_read_household(household_id));

revoke all on api.timeline_events from public, anon;
grant select on api.timeline_events to authenticated;
grant all on api.timeline_events to service_role;
revoke all on private.media_assets from anon, authenticated;
revoke all on private.context_snapshots from anon, authenticated;
revoke all on private.media_analysis_runs from anon, authenticated;
revoke all on private.media_job_attempts from anon, authenticated;
revoke all on private.evidence_items from anon, authenticated;
revoke all on private.interpretations from anon, authenticated;
revoke all on private.analysis_reports from anon, authenticated;
revoke all on private.live_events from anon, authenticated;
revoke all on private.confidence_calibrations from anon, authenticated;
