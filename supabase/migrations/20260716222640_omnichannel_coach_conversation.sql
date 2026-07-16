create table private.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  active_locale api.locale_tag not null default 'de-CH',
  status text not null default 'active' check (status in ('active', 'archived')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, dog_id)
);

create table private.coach_channel_bindings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.coach_conversations(id) on delete cascade,
  channel text not null check (channel in ('web', 'whatsapp')),
  external_binding_id text,
  status text not null default 'active' check (status in ('active', 'unlinked', 'blocked')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (conversation_id, channel, external_binding_id)
);

create unique index coach_channel_bindings_external_unique
  on private.coach_channel_bindings (channel, external_binding_id)
  where external_binding_id is not null and status = 'active';

create table private.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private.coach_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  channel text not null check (channel in ('web', 'whatsapp', 'system')),
  content_type text not null default 'text' check (content_type in ('text', 'voice_transcript', 'media_placeholder')),
  content text not null check (length(content) between 1 and 4000),
  actor_user_id uuid references api.users(id) on delete set null,
  client_message_id text,
  provider_message_id text,
  context_kind text check (context_kind is null or context_kind in ('today', 'plan', 'session', 'progress', 'general')),
  context_subject_id uuid,
  trace_id text not null,
  created_at timestamptz not null default now()
);

create index coach_messages_timeline_idx
  on private.coach_messages (conversation_id, created_at, id);
create unique index coach_messages_client_dedup_idx
  on private.coach_messages (conversation_id, channel, client_message_id)
  where client_message_id is not null;
create unique index coach_messages_provider_dedup_idx
  on private.coach_messages (conversation_id, channel, provider_message_id)
  where provider_message_id is not null;
create index coach_conversations_household_idx
  on private.coach_conversations (household_id, last_message_at desc);

alter table private.coach_conversations enable row level security;
alter table private.coach_conversations force row level security;
alter table private.coach_channel_bindings enable row level security;
alter table private.coach_channel_bindings force row level security;
alter table private.coach_messages enable row level security;
alter table private.coach_messages force row level security;

comment on table private.coach_conversations is
  'Canonical dog coaching threads shared by authenticated web and provider channels.';
comment on table private.coach_channel_bindings is
  'Channel routing metadata only. It must not become the conversation system of record.';
comment on table private.coach_messages is
  'Ordered canonical coaching timeline. Web messages are not automatically delivered to WhatsApp.';
