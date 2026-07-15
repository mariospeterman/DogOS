create extension if not exists pgcrypto with schema extensions;

create schema if not exists api;
create schema if not exists private;

revoke all on schema api from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

create domain api.locale_tag as text
  check (
    value ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
    and char_length(value) <= 35
  );

create domain api.country_code as text
  check (value ~ '^[A-Z]{2}$');

create domain api.currency_code as text
  check (value ~ '^[A-Z]{3}$');

create domain api.canonical_code as text
  check (value ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$');

create type api.locale_status as enum (
  'unconfirmed',
  'detected',
  'confirmed'
);

create type api.membership_role as enum (
  'owner',
  'caregiver',
  'viewer'
);

create type api.membership_status as enum (
  'invited',
  'active',
  'revoked'
);

create type api.translation_status as enum (
  'draft_machine_translation',
  'human_review_pending',
  'professionally_reviewed',
  'legal_reviewed',
  'approved_for_release',
  'superseded'
);

create type api.translation_method as enum (
  'source_authored',
  'machine_translation',
  'human_translation',
  'runtime_constrained_translation'
);

create type api.validity_state as enum (
  'draft',
  'valid',
  'expired',
  'revoked',
  'superseded'
);

create type api.evidence_level as enum (
  'verified_fact',
  'professional_consensus',
  'pending_professional_review',
  'product_assumption',
  'user_report',
  'measured_observation',
  'hypothesis'
);

create table api.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_locale api.locale_tag not null default 'de-CH',
  locale_status api.locale_status not null default 'unconfirmed',
  fallback_locale api.locale_tag not null default 'en',
  country api.country_code not null default 'CH',
  legal_jurisdiction text not null default 'CH',
  timezone text not null default 'Europe/Zurich',
  currency api.currency_code not null default 'CHF',
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  default_locale api.locale_tag not null default 'de-CH',
  fallback_locale api.locale_tag not null default 'en',
  country api.country_code not null default 'CH',
  legal_jurisdiction text not null default 'CH',
  timezone text not null default 'Europe/Zurich',
  currency api.currency_code not null default 'CHF',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references api.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  user_id uuid not null references api.users(id) on delete cascade,
  role api.membership_role not null,
  status api.membership_status not null default 'active',
  invited_at timestamptz,
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id),
  check ((status = 'revoked') = (revoked_at is not null))
);

create table api.user_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references api.users(id) on delete cascade,
  provider text not null check (provider in ('whatsapp', 'email', 'phone')),
  contact_hash text not null,
  encrypted_contact bytea,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'revoked')),
  verified_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, contact_hash)
);

create table api.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references api.users(id) on delete set null,
  household_id uuid references api.households(id) on delete set null,
  contact_id uuid references api.user_contacts(id) on delete set null,
  channel text not null default 'whatsapp',
  detected_locale api.locale_tag,
  active_locale api.locale_tag not null default 'de-CH',
  detected_locale_confidence numeric(4, 3)
    check (detected_locale_confidence between 0 and 1),
  locale_source text not null default 'platform_fallback'
    check (locale_source in (
      'explicit_preference', 'confirmed_account', 'whatsapp_metadata',
      'conversation_detection', 'household_default', 'platform_fallback'
    )),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.localized_content (
  id uuid primary key default gen_random_uuid(),
  canonical_content_id api.canonical_code not null,
  canonical_version integer not null check (canonical_version > 0),
  content_type text not null check (content_type in (
    'general', 'onboarding', 'question', 'protocol_instruction',
    'safety_critical', 'legal', 'message_template', 'breed_fact'
  )),
  locale api.locale_tag not null,
  source_locale api.locale_tag not null,
  translation_status api.translation_status not null,
  translation_method api.translation_method not null,
  validity_state api.validity_state not null default 'draft',
  title text,
  body jsonb not null,
  human_reviewer_user_id uuid references api.users(id) on delete set null,
  reviewed_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (canonical_content_id, canonical_version, locale),
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (
    translation_status not in (
      'professionally_reviewed', 'legal_reviewed', 'approved_for_release'
    )
    or (human_reviewer_user_id is not null and reviewed_at is not null)
  )
);

create table api.consent_documents (
  id uuid primary key default gen_random_uuid(),
  canonical_document_id api.canonical_code not null,
  document_type text not null check (document_type in (
    'terms', 'privacy', 'ai_disclosure', 'video_analysis',
    'audio_transcription', 'trainer_sharing', 'research_debug_reuse', 'marketing'
  )),
  version integer not null check (version > 0),
  legal_jurisdiction text not null,
  legal_text_hash text not null,
  effective_from timestamptz not null,
  effective_until timestamptz,
  validity_state api.validity_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (canonical_document_id, version, legal_jurisdiction),
  check (effective_until is null or effective_until > effective_from)
);

create table api.legal_document_localizations (
  id uuid primary key default gen_random_uuid(),
  consent_document_id uuid not null references api.consent_documents(id) on delete restrict,
  localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (consent_document_id, localized_content_id)
);

create table api.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references api.users(id) on delete restrict,
  household_id uuid references api.households(id) on delete restrict,
  consent_document_id uuid not null references api.consent_documents(id) on delete restrict,
  presented_localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  scope jsonb not null default '{}'::jsonb,
  acquisition_channel text not null,
  evidence_reference text,
  granted_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= granted_at)
);

create table private.identity_link_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  nonce text not null unique,
  contact_id uuid not null references api.user_contacts(id) on delete cascade,
  intended_user_id uuid references api.users(id) on delete cascade,
  intended_household_id uuid references api.households(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (consumed_at is null or revoked_at is null)
);

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references api.users(id) on delete set null,
  actor_type text not null default 'user',
  action api.canonical_code not null,
  target_type text not null,
  target_id uuid,
  occurred_at timestamptz not null default now(),
  request_id text,
  trace_id text,
  outcome text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  check (pg_column_size(metadata) <= 16384)
);

create table api.question_definitions (
  id uuid primary key default gen_random_uuid(),
  question_code api.canonical_code not null,
  version integer not null check (version > 0),
  answer_schema jsonb not null,
  sensitivity text not null default 'normal'
    check (sensitivity in ('normal', 'sensitive', 'highly_sensitive')),
  validity_state api.validity_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (question_code, version)
);

create table api.question_localizations (
  id uuid primary key default gen_random_uuid(),
  question_definition_id uuid not null references api.question_definitions(id) on delete restrict,
  localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (question_definition_id, localized_content_id)
);

create table private.translation_reviews (
  id uuid primary key default gen_random_uuid(),
  localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  reviewer_user_id uuid references api.users(id) on delete set null,
  review_type text not null check (review_type in ('human', 'professional', 'legal')),
  outcome text not null check (outcome in ('approved', 'changes_requested', 'rejected')),
  findings jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table api.breed_taxonomy (
  id uuid primary key default gen_random_uuid(),
  canonical_breed_code api.canonical_code not null,
  vbo_id text,
  fci_reference text,
  recognition_status text not null,
  version integer not null check (version > 0),
  validity_state api.validity_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (canonical_breed_code, version)
);

create table api.breed_aliases (
  id uuid primary key default gen_random_uuid(),
  breed_taxonomy_id uuid not null references api.breed_taxonomy(id) on delete cascade,
  locale api.locale_tag not null,
  alias text not null,
  alias_type text not null default 'common_name',
  created_at timestamptz not null default now(),
  unique (breed_taxonomy_id, locale, alias)
);

create table private.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  title text not null,
  publisher text,
  url text,
  doi text,
  retrieved_on date,
  license text,
  legal_jurisdiction text,
  created_at timestamptz not null default now()
);

create table private.knowledge_claims (
  id uuid primary key default gen_random_uuid(),
  canonical_claim_code api.canonical_code not null,
  claim_version integer not null check (claim_version > 0),
  canonical_fact jsonb not null,
  evidence_level api.evidence_level not null,
  validity_state api.validity_state not null default 'draft',
  valid_from timestamptz,
  reviewed_at timestamptz,
  supersedes_claim_id uuid references private.knowledge_claims(id),
  created_at timestamptz not null default now(),
  unique (canonical_claim_code, claim_version)
);

create table private.breed_facts (
  id uuid primary key default gen_random_uuid(),
  breed_taxonomy_id uuid not null references api.breed_taxonomy(id) on delete restrict,
  knowledge_claim_id uuid not null references private.knowledge_claims(id) on delete restrict,
  category api.canonical_code not null,
  legal_jurisdiction text,
  created_at timestamptz not null default now(),
  unique (breed_taxonomy_id, knowledge_claim_id)
);

create table private.breed_fact_sources (
  id uuid primary key default gen_random_uuid(),
  breed_fact_id uuid not null references private.breed_facts(id) on delete cascade,
  knowledge_source_id uuid not null references private.knowledge_sources(id) on delete restrict,
  locator text,
  quote_hash text,
  created_at timestamptz not null default now(),
  unique (breed_fact_id, knowledge_source_id)
);

create table api.training_protocols (
  id uuid primary key default gen_random_uuid(),
  protocol_code api.canonical_code not null unique,
  goal_family api.canonical_code not null,
  status text not null default 'development'
    check (status in ('development', 'active', 'retired')),
  created_at timestamptz not null default now()
);

create table private.protocol_versions (
  id uuid primary key default gen_random_uuid(),
  training_protocol_id uuid not null references api.training_protocols(id) on delete restrict,
  semantic_version text not null,
  canonical_definition jsonb not null,
  evidence_level api.evidence_level not null,
  validity_state api.validity_state not null default 'draft',
  development_only boolean not null default true,
  created_by uuid references api.users(id),
  created_at timestamptz not null default now(),
  unique (training_protocol_id, semantic_version)
);

create table private.protocol_sources (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references private.protocol_versions(id) on delete restrict,
  knowledge_claim_id uuid references private.knowledge_claims(id) on delete restrict,
  knowledge_source_id uuid references private.knowledge_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (knowledge_claim_id is not null or knowledge_source_id is not null)
);

create table private.protocol_reviews (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references private.protocol_versions(id) on delete restrict,
  reviewer_user_id uuid references api.users(id) on delete set null,
  reviewer_qualification text not null,
  findings jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('approved', 'changes_requested', 'rejected')),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table private.protocol_approvals (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references private.protocol_versions(id) on delete restrict,
  review_id uuid not null references private.protocol_reviews(id) on delete restrict,
  legal_jurisdiction text,
  locale api.locale_tag,
  release_channel text not null,
  effective_from timestamptz not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_from)
);

create table private.rule_sets (
  id uuid primary key default gen_random_uuid(),
  rule_set_code api.canonical_code not null,
  version integer not null check (version > 0),
  canonical_definition jsonb not null,
  validity_state api.validity_state not null default 'draft',
  created_at timestamptz not null default now(),
  unique (rule_set_code, version)
);

create table api.protocol_localizations (
  id uuid primary key default gen_random_uuid(),
  protocol_version_id uuid not null references private.protocol_versions(id) on delete restrict,
  localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (protocol_version_id, localized_content_id)
);

create table api.message_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  message_key api.canonical_code not null,
  message_version integer not null check (message_version > 0),
  localized_content_id uuid not null references api.localized_content(id) on delete restrict,
  channel text not null default 'all',
  created_at timestamptz not null default now(),
  unique (message_key, message_version, localized_content_id, channel)
);

create table api.dogs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  birth_date_estimate date,
  sex text check (sex in ('female', 'male', 'intersex', 'unknown')),
  neuter_status text check (neuter_status in ('neutered', 'intact', 'unknown')),
  weight_kg numeric(6, 2) check (weight_kg > 0),
  size_category text check (size_category in ('small', 'medium', 'large', 'giant', 'unknown')),
  breed_status text not null default 'unknown' check (breed_status in ('known', 'mixed', 'unknown')),
  status text not null default 'active' check (status in ('active', 'archived', 'deceased')),
  created_by uuid not null references api.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.dog_breed_links (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  breed_taxonomy_id uuid not null references api.breed_taxonomy(id) on delete restrict,
  source text not null,
  user_certainty numeric(4, 3) check (user_certainty between 0 and 1),
  created_at timestamptz not null default now(),
  unique (dog_id, breed_taxonomy_id)
);

create table api.dog_history (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  origin_code api.canonical_code,
  household_since date,
  life_events jsonb not null default '[]'::jsonb,
  training_history jsonb not null default '[]'::jsonb,
  methods_and_aids jsonb not null default '[]'::jsonb,
  source text not null default 'user_report',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.dog_health_context (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  reported_conditions api.canonical_code[] not null default '{}',
  medications jsonb not null default '[]'::jsonb,
  suspected_pain boolean,
  sudden_behavior_change boolean,
  mobility_constraints api.canonical_code[] not null default '{}',
  source text not null default 'user_report',
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table api.household_context (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  adults_count integer check (adults_count >= 0),
  children_present boolean,
  child_age_bands text[] not null default '{}',
  other_animals jsonb not null default '[]'::jsonb,
  setting_code api.canonical_code,
  routines jsonb not null default '{}'::jsonb,
  management_constraints api.canonical_code[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id)
);

create table api.owner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references api.users(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  experience_level text,
  available_minutes_per_day integer check (available_minutes_per_day >= 0),
  accessibility_needs jsonb not null default '{}'::jsonb,
  confidence_level integer check (confidence_level between 1 and 5),
  reinforcement_preferences api.canonical_code[] not null default '{}',
  communication_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, household_id)
);

create table api.anamneses (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'superseded')),
  completeness numeric(4, 3) check (completeness between 0 and 1),
  quality_status text,
  completed_at timestamptz,
  created_by uuid not null references api.users(id),
  created_at timestamptz not null default now(),
  unique (dog_id, version)
);

create table api.anamnesis_answers (
  id uuid primary key default gen_random_uuid(),
  anamnesis_id uuid not null references api.anamneses(id) on delete cascade,
  question_definition_id uuid not null references api.question_definitions(id) on delete restrict,
  raw_answer_text text,
  raw_answer_locale api.locale_tag,
  canonical_answer_code api.canonical_code,
  answer_value jsonb,
  answer_state text not null default 'answered'
    check (answer_state in ('answered', 'unknown', 'refused', 'not_applicable')),
  source text not null default 'user_report',
  collected_channel text not null,
  created_at timestamptz not null default now(),
  unique (anamnesis_id, question_definition_id),
  check (
    (answer_state = 'answered' and (canonical_answer_code is not null or answer_value is not null))
    or (answer_state <> 'answered' and canonical_answer_code is null and answer_value is null)
  )
);

create table api.behavior_concerns (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  anamnesis_id uuid references api.anamneses(id) on delete set null,
  concern_code api.canonical_code not null,
  trigger_codes api.canonical_code[] not null default '{}',
  frequency_code api.canonical_code,
  intensity smallint check (intensity between 1 and 5),
  context jsonb not null default '{}'::jsonb,
  source text not null default 'user_report',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.safety_events (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  behavior_concern_id uuid references api.behavior_concerns(id) on delete set null,
  event_code api.canonical_code not null,
  occurred_at timestamptz,
  recency_code api.canonical_code,
  severity smallint check (severity between 1 and 5),
  source text not null default 'user_report',
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'needs_clarification', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.goals (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  owner_user_id uuid not null references api.users(id) on delete restrict,
  owner_goal_text text not null,
  owner_goal_locale api.locale_tag not null,
  canonical_goal_type api.canonical_code not null,
  priority integer not null default 1 check (priority > 0),
  status text not null default 'active' check (status in ('draft', 'active', 'achieved', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.goal_versions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references api.goals(id) on delete restrict,
  version integer not null check (version > 0),
  baseline_definition jsonb not null,
  target_definition jsonb not null,
  measurement_definitions api.canonical_code[] not null,
  environment_code api.canonical_code,
  difficulty_definition jsonb not null default '{}'::jsonb,
  horizon_days integer check (horizon_days > 0),
  success_criteria jsonb not null,
  stop_criteria jsonb not null,
  escalation_criteria jsonb not null,
  created_at timestamptz not null default now(),
  unique (goal_id, version)
);

create table api.goal_measurements (
  id uuid primary key default gen_random_uuid(),
  goal_version_id uuid not null references api.goal_versions(id) on delete restrict,
  metric_code api.canonical_code not null,
  value_numeric numeric,
  value_boolean boolean,
  value_text text,
  value_json jsonb,
  is_unknown boolean not null default false,
  unknown_reason api.canonical_code,
  unit_code api.canonical_code,
  source text not null,
  method_code api.canonical_code,
  environment_code api.canonical_code,
  measured_at timestamptz not null,
  quality text not null check (quality in ('unavailable', 'low', 'moderate', 'high')),
  created_at timestamptz not null default now(),
  check (
    (is_unknown and value_numeric is null and value_boolean is null and value_text is null and value_json is null and unknown_reason is not null)
    or (
      not is_unknown
      and unknown_reason is null
      and num_nonnulls(value_numeric, value_boolean, value_text, value_json) = 1
    )
  )
);

create table api.plans (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete restrict,
  goal_version_id uuid not null references api.goal_versions(id) on delete restrict,
  active_plan_version_id uuid,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references api.plans(id) on delete restrict,
  version integer not null check (version > 0),
  protocol_version_id uuid not null references private.protocol_versions(id) on delete restrict,
  rule_set_id uuid not null references private.rule_sets(id) on delete restrict,
  generation_reason_codes api.canonical_code[] not null,
  generation_mode text not null check (generation_mode in ('development', 'production')),
  status text not null default 'prepared'
    check (status in ('prepared', 'active', 'superseded', 'cancelled')),
  effective_from timestamptz,
  effective_until timestamptz,
  superseded_by_plan_version_id uuid references api.plan_versions(id),
  created_at timestamptz not null default now(),
  unique (plan_id, version),
  check (effective_until is null or effective_from is null or effective_until > effective_from)
);

alter table api.plans
  add constraint plans_active_plan_version_fk
  foreign key (active_plan_version_id) references api.plan_versions(id) on delete restrict;

create unique index plan_versions_one_active_per_plan
  on api.plan_versions(plan_id)
  where status = 'active';

create table api.plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references api.plan_versions(id) on delete restrict,
  protocol_step_code api.canonical_code not null,
  sequence_number integer not null check (sequence_number > 0),
  difficulty_parameters jsonb not null default '{}'::jsonb,
  repetitions integer check (repetitions > 0),
  duration_seconds integer check (duration_seconds > 0),
  prerequisite_step_ids uuid[] not null default '{}',
  stop_condition_codes api.canonical_code[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (plan_version_id, sequence_number)
);

create table api.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_step_id uuid not null references api.plan_steps(id) on delete restrict,
  planned_start timestamptz not null,
  planned_end timestamptz,
  duration_seconds integer not null check (duration_seconds > 0),
  purpose_code api.canonical_code not null,
  is_recovery boolean not null default false,
  is_video_requested boolean not null default false,
  is_review boolean not null default false,
  status text not null default 'planned'
    check (status in ('planned', 'rescheduled', 'completed', 'cancelled', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end is null or planned_end > planned_start)
);

create table api.calendar_exports (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references api.plan_versions(id) on delete restrict,
  schedule_version integer not null check (schedule_version > 0),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table api.sessions (
  id uuid primary key default gen_random_uuid(),
  scheduled_session_id uuid references api.scheduled_sessions(id) on delete set null,
  dog_id uuid not null references api.dogs(id) on delete restrict,
  handler_user_id uuid not null references api.users(id) on delete restrict,
  started_at timestamptz,
  ended_at timestamptz,
  completion_status text not null default 'not_started'
    check (completion_status in ('not_started', 'in_progress', 'completed', 'interrupted', 'abandoned')),
  interruption_reason_code api.canonical_code,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table api.session_context (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references api.sessions(id) on delete cascade,
  location_code api.canonical_code,
  distraction_level integer check (distraction_level between 0 and 5),
  trigger_code api.canonical_code,
  trigger_distance_meters numeric check (trigger_distance_meters >= 0),
  sleep_context jsonb,
  feeding_context jsonb,
  exercise_context jsonb,
  handler_state api.canonical_code,
  environment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table api.session_measurements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references api.sessions(id) on delete cascade,
  metric_code api.canonical_code not null,
  value_numeric numeric,
  value_boolean boolean,
  value_text text,
  value_json jsonb,
  is_unknown boolean not null default false,
  unknown_reason api.canonical_code,
  unit_code api.canonical_code,
  source text not null,
  method_code api.canonical_code,
  measured_at timestamptz not null,
  quality text not null check (quality in ('unavailable', 'low', 'moderate', 'high')),
  created_at timestamptz not null default now(),
  check (
    (is_unknown and value_numeric is null and value_boolean is null and value_text is null and value_json is null and unknown_reason is not null)
    or (
      not is_unknown
      and unknown_reason is null
      and num_nonnulls(value_numeric, value_boolean, value_text, value_json) = 1
    )
  )
);

create table api.owner_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references api.sessions(id) on delete cascade,
  user_id uuid not null references api.users(id) on delete restrict,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  confidence_rating integer check (confidence_rating between 1 and 5),
  perceived_outcome_code api.canonical_code,
  concern_codes api.canonical_code[] not null default '{}',
  notes text,
  notes_locale api.locale_tag,
  created_at timestamptz not null default now()
);

create table api.observations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  session_id uuid references api.sessions(id) on delete set null,
  observation_code api.canonical_code not null,
  observed_value jsonb not null,
  source text not null,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  observed_from timestamptz not null,
  observed_until timestamptz,
  supporting_evidence_ids uuid[] not null default '{}',
  unsupported_inference_codes api.canonical_code[] not null default '{}',
  created_at timestamptz not null default now(),
  check (observed_until is null or observed_until >= observed_from)
);

create table api.hypotheses (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  hypothesis_code api.canonical_code not null,
  supporting_observation_ids uuid[] not null default '{}',
  contradicting_observation_ids uuid[] not null default '{}',
  confidence numeric(4, 3) check (confidence between 0 and 1),
  excluded_claim_codes api.canonical_code[] not null default '{}',
  review_status text not null default 'unreviewed',
  created_at timestamptz not null default now()
);

create table api.data_quality_assessments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  session_id uuid references api.sessions(id) on delete cascade,
  completeness numeric(4, 3) check (completeness between 0 and 1),
  consistency numeric(4, 3) check (consistency between 0 and 1),
  reliability numeric(4, 3) check (reliability between 0 and 1),
  reason_codes api.canonical_code[] not null default '{}',
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table api.progress_evaluations (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references api.plan_versions(id) on delete restrict,
  status_code api.canonical_code not null,
  confidence text not null check (confidence in ('low', 'moderate', 'high')),
  evidence_ids uuid[] not null default '{}',
  missing_metric_codes api.canonical_code[] not null default '{}',
  engine_version text not null,
  rule_set_id uuid not null references private.rule_sets(id) on delete restrict,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table api.progress_dimensions (
  id uuid primary key default gen_random_uuid(),
  progress_evaluation_id uuid not null references api.progress_evaluations(id) on delete cascade,
  dimension_code api.canonical_code not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (progress_evaluation_id, dimension_code)
);

create table api.correlation_observations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete cascade,
  factor_code api.canonical_code not null,
  outcome_code api.canonical_code not null,
  window_definition jsonb not null,
  sample_size integer not null check (sample_size >= 0),
  minimum_sample_size integer not null check (minimum_sample_size > 0),
  effect_summary jsonb,
  caveat_code api.canonical_code not null default 'caveat.correlation_not_causation',
  status text not null check (status in ('insufficient_data', 'observed', 'superseded')),
  created_at timestamptz not null default now()
);

create table api.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references api.plans(id) on delete restrict,
  previous_plan_version_id uuid not null references api.plan_versions(id) on delete restrict,
  new_plan_version_id uuid references api.plan_versions(id) on delete restrict,
  decision_code api.canonical_code not null,
  reason_codes api.canonical_code[] not null,
  evidence_ids uuid[] not null default '{}',
  required_question_codes api.canonical_code[] not null default '{}',
  escalation_code api.canonical_code,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create table api.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references api.dogs(id) on delete restrict,
  goal_id uuid references api.goals(id) on delete set null,
  risk_level_code api.canonical_code not null,
  triggered_rule_codes api.canonical_code[] not null,
  disposition_code api.canonical_code not null,
  permitted_action_codes api.canonical_code[] not null default '{}',
  prohibited_action_codes api.canonical_code[] not null default '{}',
  required_question_codes api.canonical_code[] not null default '{}',
  explanation_evidence_ids uuid[] not null default '{}',
  rule_set_id uuid not null references private.rule_sets(id) on delete restrict,
  reviewer_user_id uuid references api.users(id) on delete set null,
  resolution jsonb,
  assessed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table api.trainers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references api.users(id) on delete set null,
  display_name text not null,
  service_countries api.country_code[] not null default '{}',
  supported_locales api.locale_tag[] not null default '{}',
  remote_available boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table api.trainer_credentials (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references api.trainers(id) on delete cascade,
  credential_body text not null,
  credential_identifier text,
  valid_from date,
  valid_until date,
  verification_status text not null default 'pending',
  verified_by_user_id uuid references api.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table api.trainer_specialties (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references api.trainers(id) on delete cascade,
  specialty_code api.canonical_code not null,
  risk_capability_code api.canonical_code,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (trainer_id, specialty_code)
);

create table private.trainer_reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references api.trainers(id) on delete restrict,
  target_type text not null check (target_type in (
    'anamnesis', 'observation', 'hypothesis', 'risk_assessment',
    'progress_evaluation', 'media_analysis'
  )),
  target_id uuid not null,
  outcome_code api.canonical_code not null,
  structured_correction jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table private.trainer_case_shares (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references api.trainers(id) on delete cascade,
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  purpose_code api.canonical_code not null,
  include_sensitive_anamnesis boolean not null default false,
  granted_by_user_id uuid not null references api.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > granted_at)
);

create table api.professional_referrals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete restrict,
  dog_id uuid not null references api.dogs(id) on delete restrict,
  goal_id uuid references api.goals(id) on delete set null,
  trainer_id uuid references api.trainers(id) on delete set null,
  reason_code api.canonical_code not null,
  attribution_expires_at timestamptz,
  signed_token_hash text unique,
  status text not null default 'recommended',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.referral_rank_factors (
  id uuid primary key default gen_random_uuid(),
  professional_referral_id uuid not null references api.professional_referrals(id) on delete cascade,
  trainer_id uuid not null references api.trainers(id) on delete cascade,
  factor_code api.canonical_code not null,
  factor_value numeric not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (professional_referral_id, trainer_id, factor_code)
);

create table api.bookings (
  id uuid primary key default gen_random_uuid(),
  professional_referral_id uuid not null references api.professional_referrals(id) on delete restrict,
  trainer_id uuid not null references api.trainers(id) on delete restrict,
  provider text not null,
  provider_booking_id text,
  provider_event_version text,
  canonical_status text not null,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_booking_id)
);

create table private.referral_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  professional_referral_id uuid not null references api.professional_referrals(id) on delete restrict,
  booking_id uuid references api.bookings(id) on delete restrict,
  entry_type api.canonical_code not null,
  amount_minor bigint not null,
  currency api.currency_code not null,
  status text not null,
  reverses_entry_id uuid references private.referral_ledger_entries(id) on delete restrict,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((entry_type = 'ledger.reversal') = (reverses_entry_id is not null))
);

create table api.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete restrict,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  tier_code api.canonical_code not null,
  canonical_status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table api.entitlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  subscription_id uuid references api.subscriptions(id) on delete set null,
  capability_code api.canonical_code not null,
  limits jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_until timestamptz,
  source_code api.canonical_code not null,
  status text not null,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

create table private.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_result text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received',
  bounded_payload jsonb,
  payload_reference text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check (bounded_payload is null or pg_column_size(bounded_payload) <= 65536)
);

create table api.media_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references api.households(id) on delete cascade,
  dog_id uuid not null references api.dogs(id) on delete cascade,
  session_id uuid references api.sessions(id) on delete set null,
  goal_id uuid references api.goals(id) on delete set null,
  protocol_version_id uuid references private.protocol_versions(id) on delete set null,
  consent_id uuid not null references api.consents(id) on delete restrict,
  storage_bucket text not null default 'dog-media',
  object_key text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_ms integer check (duration_ms >= 0),
  retention_until timestamptz not null,
  processing_status text not null default 'not_requested',
  created_at timestamptz not null default now(),
  unique (storage_bucket, object_key)
);

create table private.video_jobs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references api.media_assets(id) on delete restrict,
  job_type api.canonical_code not null,
  job_version integer not null check (job_version > 0),
  provider_route text,
  idempotency_key text not null unique,
  state text not null,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.video_job_events (
  id uuid primary key default gen_random_uuid(),
  video_job_id uuid not null references private.video_jobs(id) on delete cascade,
  from_state text,
  to_state text not null,
  failure_code api.canonical_code,
  failure_detail jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table private.model_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null,
  prompt_version text,
  schema_version text not null,
  input_references uuid[] not null default '{}',
  usage jsonb,
  latency_ms integer check (latency_ms >= 0),
  outcome text not null,
  raw_output_reference text,
  created_at timestamptz not null default now()
);

create table private.canonical_video_analyses (
  id uuid primary key default gen_random_uuid(),
  video_job_id uuid not null references private.video_jobs(id) on delete restrict,
  model_run_id uuid references private.model_runs(id) on delete set null,
  observation_ids uuid[] not null default '{}',
  confidence numeric(4, 3) check (confidence between 0 and 1),
  unsupported_inference_codes api.canonical_code[] not null default '{}',
  escalation_code api.canonical_code,
  trainer_review_status text not null default 'not_requested',
  created_at timestamptz not null default now()
);

create index household_members_user_active_idx
  on api.household_members(user_id, household_id)
  where status = 'active' and revoked_at is null;
create index dogs_household_idx on api.dogs(household_id);
create index anamneses_dog_idx on api.anamneses(dog_id);
create index behavior_concerns_dog_idx on api.behavior_concerns(dog_id);
create index safety_events_dog_idx on api.safety_events(dog_id);
create index goals_dog_idx on api.goals(dog_id);
create index plans_dog_idx on api.plans(dog_id);
create index sessions_dog_idx on api.sessions(dog_id);
create index trainer_case_shares_lookup_idx
  on private.trainer_case_shares(trainer_id, dog_id, expires_at)
  where revoked_at is null;
create index consents_household_active_idx
  on api.consents(household_id, consent_document_id)
  where withdrawn_at is null;
create index localized_content_resolution_idx
  on api.localized_content(canonical_content_id, canonical_version, locale, validity_state);
create index provider_events_processing_idx
  on private.provider_events(processing_status, received_at);

comment on domain api.locale_tag is
  'Structurally validates BCP 47 language tags without restricting DogOS to a fixed locale list.';
comment on domain api.canonical_code is
  'Stable language-neutral identifier such as goal.loose_leash_walking.';
comment on table api.localized_content is
  'Version-bound presentation content; never contains decision-bearing protocol logic.';
comment on table private.trainer_case_shares is
  'Purpose-bound, expiring authorization for trainer access; added to satisfy the approved RLS model.';
