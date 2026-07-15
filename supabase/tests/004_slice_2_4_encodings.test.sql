begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select has_domain('api', 'reason_code', 'uppercase reason code domain exists');
select has_domain('api', 'measurement_source', 'canonical source domain exists');
select has_table('private', 'command_idempotency', 'idempotency records are server-only');
select has_table('private', 'signed_actions', 'signed action state is server-only');
select has_column('api', 'risk_assessments', 'reason_codes', 'risk reasons are persisted');
select has_column('api', 'progress_evaluations', 'reason_codes', 'progress reasons are persisted');
select col_type_is('api', 'plan_adjustments', 'reason_codes', 'api.reason_code[]', 'adjustment reasons use reason_code');
select col_type_is('api', 'plan_versions', 'generation_reason_codes', 'api.reason_code[]', 'plan reasons use reason_code');
select col_type_is('api', 'goal_measurements', 'source', 'api.measurement_source', 'goal measurement source is canonical');
select col_type_is('api', 'session_measurements', 'source', 'api.measurement_source', 'session source is canonical');
select col_type_is('api', 'observations', 'source', 'api.measurement_source', 'observation source is canonical');
select lives_ok($$ select 'SAFETY_SUSPECTED_PAIN'::api.reason_code $$, 'uppercase reason persists');
select throws_ok($$ select 'safety.suspected_pain'::api.reason_code $$, 23514, null, 'dotted code cannot be a reason');
select lives_ok($$ select 'goal.loose_leash_walking'::api.canonical_code $$, 'dotted canonical code remains valid');
select throws_ok($$ select 'SAFETY_SUSPECTED_PAIN'::api.canonical_code $$, 23514, null, 'reason cannot enter canonical_code');

select * from finish();
rollback;
