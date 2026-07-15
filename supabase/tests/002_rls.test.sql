begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*) from api.dogs), 1::bigint, 'owner sees only own household dog');
select lives_ok(
  $$insert into api.dogs (household_id, name, breed_status, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'Owner test dog', 'unknown', '10000000-0000-0000-0000-000000000001')$$,
  'owner can add a dog'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from api.dogs), 2::bigint, 'caregiver reads household dogs including transaction fixture');
select lives_ok(
  $$update api.dogs set name = 'Milo caregiver edit'
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'caregiver can update a household dog'
);
select throws_ok(
  $$update api.users set currency = 'EUR'
    where id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'locale self-service cannot change currency'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*) from api.dogs), 2::bigint, 'viewer can read household dogs');
select throws_ok(
  $$insert into api.dogs (household_id, name, breed_status, created_by)
    values ('20000000-0000-0000-0000-000000000001', 'Denied dog', 'unknown', '10000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'viewer cannot add a dog'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from api.dogs), 0::bigint, 'revoked household member has no access');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated"}';
select is((select count(*) from api.dogs), 1::bigint, 'other household is isolated');
select is(
  (select count(*) from api.dogs where id = '30000000-0000-0000-0000-000000000001'),
  0::bigint,
  'other household cannot address the Swiss dog by id'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated"}';
select is((select count(*) from api.dogs), 1::bigint, 'trainer sees only dog with active share');
select is((select count(*) from api.dog_health_context), 1::bigint, 'sensitive trainer share exposes health context');
select is(
  (select count(*) from api.dogs where id = '30000000-0000-0000-0000-000000000002'),
  0::bigint,
  'expired trainer share grants no access'
);
select throws_ok(
  $$insert into api.training_protocols (protocol_code, goal_family)
    values ('protocol.client_created', 'goal.client_created')$$,
  '42501',
  null,
  'client cannot create protocols'
);
select throws_ok(
  $$update api.risk_assessments set risk_level_code = 'risk.none'$$,
  '42501',
  null,
  'client cannot alter risk assessments'
);
select throws_ok(
  $$update api.professional_referrals set status = 'completed'$$,
  '42501',
  null,
  'client cannot alter canonical referrals'
);
select throws_ok(
  $$select * from private.identity_link_tokens$$,
  '42501',
  null,
  'signed identity links are never client-readable across households'
);
select throws_ok(
  $$update api.plan_versions set status = 'active'$$,
  '42501',
  null,
  'client cannot activate plan versions'
);

select * from finish();
rollback;
