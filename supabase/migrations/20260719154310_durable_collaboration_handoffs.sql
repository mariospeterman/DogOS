create table private.case_share_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  subject_type text not null check (subject_type in (
    'case', 'feedback_request', 'trainer_handoff', 'veterinary_handoff',
    'video_analysis', 'live_session'
  )),
  subject_id uuid,
  recipient_email_hash text,
  recipient_role text not null check (recipient_role in (
    'observer_guest', 'trainer', 'veterinarian', 'professional_assistant'
  )),
  scopes text[] not null,
  max_views integer not null default 5 check (max_views > 0 and max_views <= 50),
  view_count integer not null default 0 check (view_count >= 0),
  claimed_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references api.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (array_length(scopes, 1) between 1 and 16)
);

create table api.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  requested_by uuid not null references api.users(id) on delete restrict,
  recipient_role text not null check (recipient_role in (
    'caregiver', 'observer_guest', 'trainer', 'veterinarian'
  )),
  target_type text not null default 'case' check (target_type in (
    'case', 'goal', 'session', 'video_analysis', 'live_session'
  )),
  target_id uuid,
  questions jsonb not null,
  media_requested boolean not null default false,
  due_at timestamptz,
  status text not null default 'open' check (status in (
    'open', 'submitted', 'cancelled', 'expired'
  )),
  share_grant_id uuid references private.case_share_grants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pg_column_size(questions) <= 8192)
);

create table api.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  feedback_request_id uuid not null references api.feedback_requests(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  responder_user_id uuid references api.users(id) on delete set null,
  responder_role text not null check (responder_role in (
    'owner', 'caregiver', 'observer_guest', 'trainer', 'veterinarian'
  )),
  structured_observations jsonb not null,
  subjective_interpretation text,
  certainty numeric(4, 3) not null default 0.5 check (certainty between 0 and 1),
  evidence_refs jsonb not null default '[]'::jsonb,
  observed_at timestamptz,
  submitted_at timestamptz not null default now(),
  superseded_by uuid,
  correction_state text not null default 'current' check (correction_state in (
    'current', 'superseded', 'corrected'
  )),
  check (pg_column_size(structured_observations) <= 16384),
  check (pg_column_size(evidence_refs) <= 8192)
);

create table api.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  reviewer_user_id uuid references api.users(id) on delete set null,
  professional_role text not null check (professional_role in ('trainer', 'veterinarian')),
  credential_snapshot jsonb not null default '{}'::jsonb,
  target_type text not null check (target_type in (
    'case', 'feedback_response', 'video_analysis', 'live_session',
    'plan', 'handoff_package'
  )),
  target_id uuid,
  correction_type text not null check (correction_type in (
    'observation_confirmed',
    'observation_corrected',
    'observation_not_visible',
    'interpretation_rejected',
    'timing_corrected',
    'plan_step_supported',
    'plan_step_rejected',
    'additional_context_requested',
    'safety_escalation_supported',
    'safety_escalation_corrected'
  )),
  observable_corrections jsonb not null default '[]'::jsonb,
  interpretation_corrections jsonb not null default '[]'::jsonb,
  plan_feedback text,
  safety_note text,
  open_questions text[] not null default '{}',
  outcome text not null default 'submitted' check (outcome in (
    'submitted', 'accepted_by_owner', 'rejected_by_owner', 'superseded'
  )),
  signed_at timestamptz not null default now(),
  superseded_by uuid,
  created_at timestamptz not null default now(),
  check (pg_column_size(credential_snapshot) <= 8192),
  check (pg_column_size(observable_corrections) <= 16384),
  check (pg_column_size(interpretation_corrections) <= 16384)
);

create table api.handoff_packages (
  id uuid primary key default gen_random_uuid(),
  package_type text not null check (package_type in ('trainer_handoff', 'veterinary_handoff')),
  version integer not null default 1 check (version > 0),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  professional_referral_id uuid references api.professional_referrals(id) on delete set null,
  created_by uuid not null references api.users(id) on delete restrict,
  locale api.locale_tag not null default 'de-CH',
  included_from timestamptz,
  included_until timestamptz not null default now(),
  included_artifact_refs jsonb not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  consent_reference text not null,
  release_refs jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  content_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (pg_column_size(snapshot) <= 131072),
  check (pg_column_size(included_artifact_refs) <= 32768),
  check (pg_column_size(evidence_refs) <= 32768)
);

create table api.handoff_deliveries (
  id uuid primary key default gen_random_uuid(),
  handoff_package_id uuid not null references api.handoff_packages(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  delivery_method text not null check (delivery_method in (
    'secure_link', 'pdf_download', 'secure_email'
  )),
  share_grant_id uuid references private.case_share_grants(id) on delete set null,
  recipient_email_hash text,
  status text not null default 'created' check (status in (
    'created', 'sent', 'claimed', 'revoked', 'expired', 'failed'
  )),
  created_by uuid not null references api.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.case_access_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  share_grant_id uuid references private.case_share_grants(id) on delete set null,
  actor_user_id uuid references api.users(id) on delete set null,
  actor_role text not null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  outcome text not null default 'success',
  trace_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (pg_column_size(metadata) <= 8192)
);

alter table private.case_share_grants enable row level security;
alter table private.case_share_grants force row level security;
alter table api.feedback_requests enable row level security;
alter table api.feedback_requests force row level security;
alter table api.feedback_responses enable row level security;
alter table api.feedback_responses force row level security;
alter table api.professional_reviews enable row level security;
alter table api.professional_reviews force row level security;
alter table api.handoff_packages enable row level security;
alter table api.handoff_packages force row level security;
alter table api.handoff_deliveries enable row level security;
alter table api.handoff_deliveries force row level security;
alter table private.case_access_events enable row level security;
alter table private.case_access_events force row level security;

revoke all on private.case_share_grants from public, anon, authenticated;
revoke all on private.case_access_events from public, anon, authenticated;
grant all on private.case_share_grants to service_role;
grant all on private.case_access_events to service_role;
grant select, insert, update on api.feedback_requests to service_role;
grant select, insert, update on api.feedback_responses to service_role;
grant select, insert, update on api.professional_reviews to service_role;
grant select, insert, update on api.handoff_packages to service_role;
grant select, insert, update on api.handoff_deliveries to service_role;

create policy feedback_requests_household_read
  on api.feedback_requests for select
  using (private.can_read_dog(dog_id, false));

create policy feedback_responses_household_read
  on api.feedback_responses for select
  using (private.can_read_dog(dog_id, false));

create policy professional_reviews_household_read
  on api.professional_reviews for select
  using (private.can_read_dog(dog_id, false));

create policy handoff_packages_household_read
  on api.handoff_packages for select
  using (private.can_read_dog(dog_id, false));

create policy handoff_deliveries_household_read
  on api.handoff_deliveries for select
  using (private.can_read_dog(dog_id, false));

create index case_share_grants_token_hash_idx on private.case_share_grants(token_hash);
create index case_share_grants_dog_idx on private.case_share_grants(household_id, dog_id, expires_at);
create index feedback_requests_dog_idx on api.feedback_requests(household_id, dog_id, created_at desc);
create index feedback_responses_request_idx on api.feedback_responses(feedback_request_id, submitted_at desc);
create index professional_reviews_dog_idx on api.professional_reviews(household_id, dog_id, created_at desc);
create index handoff_packages_dog_idx on api.handoff_packages(household_id, dog_id, created_at desc);
create index case_access_events_grant_idx on private.case_access_events(share_grant_id, occurred_at desc);
