create table private.whatsapp_usage_windows (
  contact_id uuid not null references private.whatsapp_provider_contacts(id) on delete cascade,
  bucket_start timestamptz not null,
  message_count integer not null check (message_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (contact_id, bucket_start)
);

alter table private.whatsapp_usage_windows enable row level security;
alter table private.whatsapp_usage_windows force row level security;

comment on table private.whatsapp_usage_windows is
  'Server-only bounded counters. No message content or personal data is stored here.';
