create type api.video_analysis_status as enum (
  'upload_requested',
  'uploaded',
  'processing',
  'completed',
  'failed'
);

create table api.video_analyses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  actor_user_id uuid not null references api.users(id) on delete restrict,
  status api.video_analysis_status not null default 'upload_requested',
  original_filename text not null check (char_length(original_filename) between 1 and 180),
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint not null check (size_bytes between 1 and 262144000),
  storage_object_key text not null unique,
  findings jsonb not null default '[]'::jsonb,
  failure_code api.canonical_code,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(findings) = 'array')
);

alter table api.video_analyses enable row level security;
alter table api.video_analyses force row level security;

create trigger video_analyses_set_updated_at before update on api.video_analyses
for each row execute function private.set_updated_at();

create index video_analyses_household_dog_created_idx
  on api.video_analyses(household_id, dog_id, created_at desc);

create policy video_analyses_household_read on api.video_analyses
for select to authenticated
using (api.is_household_member(household_id));

revoke all on table api.video_analyses from public, anon;
grant select on table api.video_analyses to authenticated;
grant all on table api.video_analyses to service_role;
