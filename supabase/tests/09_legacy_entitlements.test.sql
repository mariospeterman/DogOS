begin;
select plan(6);

insert into api.households (id, name, created_by)
values (
  '20000000-0000-0000-0000-000000000009',
  'Legacy household without billing rows',
  '10000000-0000-0000-0000-000000000001'
);

select is(
  (select count(*)::integer from api.subscriptions
   where household_id = '20000000-0000-0000-0000-000000000009'),
  0,
  'the fixture reproduces a household created before billing projection'
);
select lives_ok(
  $$select private.ensure_household_entitlements(
    '20000000-0000-0000-0000-000000000009'
  )$$,
  'legacy household reconciliation succeeds'
);
select is(
  (select count(*)::integer from api.subscriptions
   where household_id = '20000000-0000-0000-0000-000000000009'
     and tier_code = 'tier.freemium'
     and canonical_status = 'active'),
  1,
  'one current freemium subscription is created'
);
select is(
  (select count(*)::integer from api.entitlements
   where household_id = '20000000-0000-0000-0000-000000000009'
     and status = 'active'),
  5,
  'all catalog entitlements are materialized'
);
select lives_ok(
  $$select private.ensure_household_entitlements(
    '20000000-0000-0000-0000-000000000009'
  )$$,
  'reconciliation is idempotent'
);
select is(
  (select count(*)::integer from api.entitlements
   where household_id = '20000000-0000-0000-0000-000000000009'
     and status = 'active'),
  5,
  'retries do not duplicate entitlements'
);

select * from finish();
rollback;
