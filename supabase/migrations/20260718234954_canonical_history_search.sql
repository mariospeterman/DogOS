create table private.coach_chapters (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.coach_conversations(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  workspace text not null default 'coach'
    check (workspace in ('setup', 'coach', 'plan', 'train', 'progress', 'media')),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 1200),
  first_message_id uuid references private.coach_messages(id) on delete set null,
  latest_message_id uuid references private.coach_messages(id) on delete set null,
  message_count integer not null default 0 check (message_count >= 0),
  pinned_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  searchable_text tsvector generated always as (
    to_tsvector('simple', title || ' ' || summary || ' ' || workspace)
  ) stored
);

create trigger coach_chapters_set_updated_at before update on private.coach_chapters
for each row execute function private.set_updated_at();

create unique index coach_chapters_conversation_workspace_title_idx
  on private.coach_chapters(conversation_id, workspace, lower(title));

create index coach_chapters_household_dog_updated_idx
  on private.coach_chapters(household_id, dog_id, updated_at desc);

create index coach_chapters_search_gin_idx
  on private.coach_chapters using gin(searchable_text);

alter table private.coach_chapters enable row level security;
alter table private.coach_chapters force row level security;

revoke all on table private.coach_chapters from public, anon, authenticated;
grant all on table private.coach_chapters to service_role;

create index if not exists coach_conversations_household_dog_last_idx
  on private.coach_conversations(household_id, dog_id, last_message_at desc);

create index if not exists video_analyses_search_gin_idx
  on api.video_analyses using gin (
    to_tsvector(
      'simple',
      original_filename || ' ' || findings::text
    )
  );

create index if not exists video_analysis_observations_search_gin_idx
  on private.video_analysis_observations using gin (
    to_tsvector(
      'simple',
      observation_code::text || ' ' || evidence || ' ' || recommendation
    )
  );

create index if not exists live_coaching_sessions_search_gin_idx
  on api.live_coaching_sessions using gin (
    to_tsvector(
      'simple',
      room_name || ' ' || coalesce(summary, '')
    )
  );
