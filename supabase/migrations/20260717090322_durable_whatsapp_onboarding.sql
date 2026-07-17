insert into api.question_definitions (
  id, question_code, version, answer_schema, sensitivity, validity_state
)
values
  ('41000000-0000-4000-8000-000000000010', 'question.household_composition', 1, '{"type":"string"}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000011', 'question.dog_name', 1, '{"type":"string","maxLength":40}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000012', 'question.dog_age_band', 1, '{"type":"string"}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000013', 'question.health_change', 1, '{"type":"string"}', 'highly_sensitive', 'valid'),
  ('41000000-0000-4000-8000-000000000014', 'question.recent_safety_event', 1, '{"type":"string"}', 'highly_sensitive', 'valid'),
  ('41000000-0000-4000-8000-000000000015', 'question.behavior_concern', 1, '{"type":"string"}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000016', 'question.training_goal', 1, '{"type":"string"}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000017', 'question.training_setup', 1, '{"type":"string"}', 'normal', 'valid'),
  ('41000000-0000-4000-8000-000000000018', 'question.baseline_success', 1, '{"type":"number","minimum":0,"maximum":100}', 'normal', 'valid')
on conflict (question_code, version) do nothing;

insert into api.training_protocols (id, protocol_code, goal_family, status)
values
  ('50000000-0000-4000-8000-000000000004', 'protocol.loose_leash_foundation', 'goal.loose_leash_walking', 'development'),
  ('50000000-0000-4000-8000-000000000005', 'protocol.calm_engagement_foundation', 'goal.calm_engagement', 'development'),
  ('50000000-0000-4000-8000-000000000006', 'protocol.recall_low_distraction', 'goal.recall', 'development')
on conflict (protocol_code) do nothing;

insert into private.protocol_versions (
  id, training_protocol_id, semantic_version, canonical_definition,
  evidence_level, validity_state, development_only
)
select
  source.id,
  protocol.id,
  '0.1.0-development',
  '{"source":"@dogos/knowledge","reviewRequired":true}',
  'pending_professional_review',
  'draft',
  true
from (values
  ('51000000-0000-4000-8000-000000000004'::uuid, 'protocol.loose_leash_foundation'::api.canonical_code),
  ('51000000-0000-4000-8000-000000000005'::uuid, 'protocol.calm_engagement_foundation'::api.canonical_code),
  ('51000000-0000-4000-8000-000000000006'::uuid, 'protocol.recall_low_distraction'::api.canonical_code)
) as source(id, protocol_code)
join api.training_protocols protocol on protocol.protocol_code = source.protocol_code
on conflict (training_protocol_id, semantic_version) do nothing;

insert into private.rule_sets (
  id, rule_set_code, version, canonical_definition, validity_state
)
values (
  '52000000-0000-4000-8000-000000000101',
  'rules.safety_development',
  1,
  '{"source":"@dogos/safety-engine","semanticVersion":"1.0.0","developmentOnly":true}',
  'draft'
)
on conflict (rule_set_code, version) do nothing;

create table private.onboarding_projections (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references private.whatsapp_provider_contacts(id) on delete cascade,
  snapshot_hash text not null,
  dog_id uuid not null unique references api.dogs(id) on delete restrict,
  anamnesis_id uuid not null unique references api.anamneses(id) on delete restrict,
  goal_id uuid not null unique references api.goals(id) on delete restrict,
  plan_id uuid unique references api.plans(id) on delete restrict,
  risk_assessment_id uuid not null unique references api.risk_assessments(id) on delete restrict,
  projected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.onboarding_projections enable row level security;
alter table private.onboarding_projections force row level security;
revoke all on private.onboarding_projections from public, anon, authenticated;
grant all on private.onboarding_projections to service_role;

create index dog_health_context_dog_idx on api.dog_health_context(dog_id);
create index anamnesis_answers_anamnesis_idx on api.anamnesis_answers(anamnesis_id);
create index goal_versions_goal_idx on api.goal_versions(goal_id);
create index goal_measurements_goal_version_idx on api.goal_measurements(goal_version_id);
create index plan_versions_plan_idx on api.plan_versions(plan_id);
create index plan_steps_plan_version_idx on api.plan_steps(plan_version_id);
create index scheduled_sessions_plan_step_idx on api.scheduled_sessions(plan_step_id);
