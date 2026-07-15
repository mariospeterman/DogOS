begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select is(
  (select canonical_answer_code from api.anamnesis_answers where id = '61000000-0000-0000-0000-000000000001'),
  (select canonical_answer_code from api.anamnesis_answers where id = '61000000-0000-0000-0000-000000000002'),
  'German and English anamnesis map to the same canonical answer'
);
select is(
  (select risk_level_code || ':' || disposition_code from api.risk_assessments where id = '63000000-0000-0000-0000-000000000001'),
  (select risk_level_code || ':' || disposition_code from api.risk_assessments where id = '63000000-0000-0000-0000-000000000002'),
  'German and English cases produce the same canonical risk result'
);
select is(
  (select canonical_goal_type from api.goals where id = '70000000-0000-0000-0000-000000000001'),
  (select canonical_goal_type from api.goals where id = '70000000-0000-0000-0000-000000000002'),
  'German and English goals share one canonical goal type'
);
select is(
  (select protocol_step_code from api.plan_steps where id = '75000000-0000-0000-0000-000000000001'),
  (select protocol_step_code from api.plan_steps where id = '75000000-0000-0000-0000-000000000002'),
  'German and English plans share canonical protocol steps'
);
select is(
  (select metric_code || ':' || value_numeric::text from api.session_measurements where id = '77000000-0000-0000-0000-000000000001'),
  (select metric_code || ':' || value_numeric::text from api.session_measurements where id = '77000000-0000-0000-0000-000000000002'),
  'measurements are locale-independent'
);
select is(
  (select status_code from api.progress_evaluations where id = '78000000-0000-0000-0000-000000000001'),
  (select status_code from api.progress_evaluations where id = '78000000-0000-0000-0000-000000000002'),
  'progression result is locale-independent'
);
select is(
  (select decision_code || ':' || escalation_code from api.plan_adjustments where id = '79000000-0000-0000-0000-000000000001'),
  (select decision_code || ':' || escalation_code from api.plan_adjustments where id = '79000000-0000-0000-0000-000000000002'),
  'adjustment and escalation are locale-independent'
);
select results_eq(
  $$select country::text, legal_jurisdiction, timezone, currency::text
    from api.users where id = '10000000-0000-0000-0000-000000000002'$$,
  $$values ('CH'::text, 'CH'::text, 'Europe/Zurich'::text, 'CHF'::text)$$,
  'Swiss English user remains CH, Swiss jurisdiction, Zurich, and CHF'
);
select is(
  (select locale::text from api.resolve_localized_content('message.welcome', 1, 'fr-CH', 'en') limit 1),
  'en'::text,
  'unsupported locale safely falls back to English development content'
);
select is(
  (select count(*) from api.resolve_localized_content('safety.stop_session', 1, 'en', 'en')),
  0::bigint,
  'unapproved safety translation fails closed'
);
select is(
  (select count(*) from api.resolve_localized_content('protocol.loose_leash_intro', 1, 'en', 'en')),
  0::bigint,
  'protocol translation requires release approval'
);

insert into api.localized_content (
  id, canonical_content_id, canonical_version, content_type, locale,
  source_locale, translation_status, translation_method, validity_state,
  body, human_reviewer_user_id, reviewed_at, valid_from
) values (
  '40000000-0000-0000-0000-0000000000ff', 'legal.privacy', 1, 'legal', 'en',
  'en', 'legal_reviewed', 'source_authored', 'valid', '{"text":"Test only"}',
  '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'
);
insert into api.legal_document_localizations (
  id, consent_document_id, localized_content_id
) values (
  '91000000-0000-0000-0000-0000000000ff',
  '90000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-0000000000ff'
);

select throws_ok(
  $$insert into api.consents (
      user_id, household_id, consent_document_id, presented_localized_content_id,
      acquisition_channel, granted_at
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-0000000000ff', 'test', now()
    )$$,
  '23514',
  null,
  'legal consent rejects content from a different canonical document'
);

select throws_ok(
  $$insert into api.consents (
      user_id, household_id, consent_document_id, presented_localized_content_id,
      acquisition_channel, granted_at
    ) values (
      '10000000-0000-0000-0000-000000000005',
      '20000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000006', 'test', now()
    )$$,
  '23514',
  null,
  'legal consent rejects the wrong jurisdiction'
);
select is(
  (select count(distinct canonical_goal_type) from api.goals),
  1::bigint,
  'analytics dimensions do not fragment by language'
);
select is(
  (select count(distinct breed_taxonomy_id) from api.dog_breed_links
   where dog_id = '30000000-0000-0000-0000-000000000001'),
  2::bigint,
  'mixed-breed profile retains multiple canonical breeds independent of locale'
);

update api.users
set preferred_locale = 'de-DE', locale_status = 'confirmed'
where id = '10000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from private.audit_events
   where action = 'user.locale_changed'
     and target_id = '10000000-0000-0000-0000-000000000002'),
  1::bigint,
  'locale switch is audited without rewriting historical answers'
);
select results_eq(
  $$select country::text, legal_jurisdiction, timezone, currency::text
    from api.users where id = '10000000-0000-0000-0000-000000000002'$$,
  $$values ('CH'::text, 'CH'::text, 'Europe/Zurich'::text, 'CHF'::text)$$,
  'locale switch does not change country, jurisdiction, timezone, or currency'
);

select * from finish();
rollback;
