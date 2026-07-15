create table private.whatsapp_provider_contacts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta_cloud' check (provider = 'meta_cloud'),
  external_contact_id text not null,
  external_contact_hash text not null,
  status text not null default 'provisional'
    check (status in ('provisional', 'linked', 'unlinked', 'blocked')),
  user_id uuid references api.users(id) on delete set null,
  household_id uuid references api.households(id) on delete set null,
  locale api.locale_tag not null default 'de-CH',
  allowlisted boolean not null default false,
  linked_at timestamptz,
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_contact_id),
  unique (provider, external_contact_hash),
  check ((status = 'linked') = (user_id is not null and household_id is not null)),
  check (linked_at is null or user_id is not null)
);

create table private.whatsapp_conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references private.whatsapp_provider_contacts(id) on delete cascade,
  workflow_state text not null,
  canonical_state jsonb not null default '{}',
  last_inbound_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id),
  check (jsonb_typeof(canonical_state) = 'object')
);

create table private.whatsapp_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  contact_id uuid not null references private.whatsapp_provider_contacts(id) on delete cascade,
  message_kind text not null
    check (message_kind in ('text', 'button', 'list', 'voice_transcript', 'media_placeholder')),
  message_body text,
  received_at timestamptz not null,
  processed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  trace_id text not null,
  created_at timestamptz not null default now(),
  check (length(coalesce(message_body, '')) <= 2000)
);

create table private.whatsapp_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text unique,
  contact_id uuid not null references private.whatsapp_provider_contacts(id) on delete cascade,
  message_kind text not null check (message_kind in ('text', 'interactive', 'template', 'media')),
  message_body text,
  delivery_state text not null default 'queued'
    check (delivery_state in ('queued', 'sent', 'delivered', 'read', 'failed')),
  retry_count integer not null default 0 check (retry_count between 0 and 10),
  next_retry_at timestamptz,
  trace_id text not null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(coalesce(message_body, '')) <= 2000)
);

create table private.whatsapp_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null,
  delivery_state text not null check (delivery_state in ('sent', 'delivered', 'read', 'failed')),
  provider_timestamp timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (provider_message_id, delivery_state, provider_timestamp)
);

create table private.whatsapp_message_commands (
  id uuid primary key default gen_random_uuid(),
  inbound_event_id uuid not null references private.whatsapp_inbound_events(id) on delete cascade,
  command_code api.canonical_code not null,
  idempotency_key text not null,
  target_id uuid,
  trace_id text not null,
  created_at timestamptz not null default now(),
  unique (inbound_event_id, command_code),
  unique (idempotency_key)
);

create table private.whatsapp_processing_failures (
  id uuid primary key default gen_random_uuid(),
  inbound_event_id uuid references private.whatsapp_inbound_events(id) on delete cascade,
  outbound_message_id uuid references private.whatsapp_outbound_messages(id) on delete cascade,
  normalized_code text not null,
  retryable boolean not null,
  retry_count integer not null default 0 check (retry_count between 0 and 10),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  trace_id text not null,
  created_at timestamptz not null default now(),
  check ((inbound_event_id is null) <> (outbound_message_id is null))
);

create table private.whatsapp_identity_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references private.whatsapp_provider_contacts(id) on delete cascade,
  token_hash text not null unique,
  nonce text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  user_id uuid references api.users(id) on delete set null,
  household_id uuid references api.households(id) on delete set null,
  trace_id text not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create index whatsapp_inbound_events_retention_idx
  on private.whatsapp_inbound_events (expires_at);
create index whatsapp_outbound_messages_retry_idx
  on private.whatsapp_outbound_messages (next_retry_at)
  where delivery_state = 'failed' and next_retry_at is not null;
create index whatsapp_identity_links_active_idx
  on private.whatsapp_identity_links (token_hash, expires_at)
  where consumed_at is null and revoked_at is null;

alter table private.whatsapp_provider_contacts enable row level security;
alter table private.whatsapp_provider_contacts force row level security;
alter table private.whatsapp_conversation_sessions enable row level security;
alter table private.whatsapp_conversation_sessions force row level security;
alter table private.whatsapp_inbound_events enable row level security;
alter table private.whatsapp_inbound_events force row level security;
alter table private.whatsapp_outbound_messages enable row level security;
alter table private.whatsapp_outbound_messages force row level security;
alter table private.whatsapp_delivery_events enable row level security;
alter table private.whatsapp_delivery_events force row level security;
alter table private.whatsapp_message_commands enable row level security;
alter table private.whatsapp_message_commands force row level security;
alter table private.whatsapp_processing_failures enable row level security;
alter table private.whatsapp_processing_failures force row level security;
alter table private.whatsapp_identity_links enable row level security;
alter table private.whatsapp_identity_links force row level security;

comment on table private.whatsapp_inbound_events is
  'Deduplicated Meta events. Message bodies expire after seven days and raw webhook payloads are not retained.';
comment on table private.whatsapp_identity_links is
  'One-time account-link records. Only token hashes are persisted.';
