alter table api.professional_referrals
  add column if not exists target_professional_type text not null default 'trainer',
  add column if not exists handoff_summary jsonb not null default '{}'::jsonb,
  add column if not exists handoff_evidence_refs jsonb not null default '[]'::jsonb,
  add column if not exists handoff_disagreements jsonb not null default '[]'::jsonb,
  add column if not exists handoff_generated_at timestamptz,
  add column if not exists share_expires_at timestamptz;

alter table api.professional_referrals
  drop constraint if exists professional_referrals_target_professional_type_check;

alter table api.professional_referrals
  add constraint professional_referrals_target_professional_type_check
  check (target_professional_type in ('trainer', 'veterinary'));

create index if not exists professional_referrals_household_dog_created_idx
  on api.professional_referrals (household_id, dog_id, created_at desc);

create index if not exists professional_referrals_target_status_idx
  on api.professional_referrals (target_professional_type, status, created_at desc);
