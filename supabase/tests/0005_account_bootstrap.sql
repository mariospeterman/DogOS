begin;
select plan(17);

select has_column('api', 'users', 'display_name', 'users store a display name');
select has_table('private', 'tier_catalog', 'tier catalog exists');
select results_eq(
  $$select count(*)::integer from private.tier_catalog where active$$,
  array[4],
  'four active tiers are defined'
);

select lives_ok(
  $$select * from private.bootstrap_account(
    '00000000-0000-0000-0000-000000000004', 'New Owner', 'en', 'ABC123'
  )$$,
  'a verified auth identity bootstraps'
);
select lives_ok(
  $$select * from private.bootstrap_account(
    '00000000-0000-0000-0000-000000000004', 'Changed Name', 'de-CH', 'OTHER1'
  )$$,
  'bootstrap is idempotent'
);
select results_eq(
  $$select count(*)::integer from api.users where auth_user_id =
    '00000000-0000-0000-0000-000000000004'$$,
  array[1],
  'one app user is created'
);
select results_eq(
  $$select count(*)::integer from api.household_members hm
    join api.users u on u.id = hm.user_id
    where u.auth_user_id = '00000000-0000-0000-0000-000000000004'
      and hm.role = 'owner' and hm.status = 'active'$$,
  array[1],
  'one owner membership is created'
);
select results_eq(
  $$select count(*)::integer from api.subscriptions s
    join api.household_members hm on hm.household_id = s.household_id
    join api.users u on u.id = hm.user_id
    where u.auth_user_id = '00000000-0000-0000-0000-000000000004'
      and hm.status = 'active'
      and s.tier_code = 'tier.freemium' and s.canonical_status = 'active'$$,
  array[1],
  'one freemium subscription is created'
);
select results_eq(
  $$select count(*)::integer from api.entitlements e
    join api.household_members hm on hm.household_id = e.household_id
    join api.users u on u.id = hm.user_id
    where u.auth_user_id = '00000000-0000-0000-0000-000000000004'
      and hm.status = 'active'
      and e.status = 'active'$$,
  array[5],
  'all freemium capabilities are materialized'
);
select has_table(
  'private',
  'account_attributions',
  'first-touch account attribution is private'
);
select results_eq(
  $$select referral_code from private.account_attributions
    where auth_user_id = '00000000-0000-0000-0000-000000000004'
      and source_code = 'source.landing_referral'$$,
  array['ABC123'::text],
  'the first valid referral code is persisted'
);
select results_eq(
  $$select count(*)::integer from private.account_attributions
    where auth_user_id = '00000000-0000-0000-0000-000000000004'
      and source_code = 'source.landing_referral'$$,
  array[1],
  'retries cannot overwrite or duplicate first-touch attribution'
);
select results_eq(
  $$select (e.limits ->> 'perDay')::integer from api.entitlements e
    join api.household_members hm on hm.household_id = e.household_id
    join api.users u on u.id = hm.user_id
    where u.auth_user_id = '00000000-0000-0000-0000-000000000004'
      and hm.status = 'active'
      and e.capability_code = 'capability.coaching_messages'$$,
  array[12],
  'the daily coach allowance comes from persisted entitlements'
);
select results_eq(
  $$select display_name from api.users where auth_user_id =
    '00000000-0000-0000-0000-000000000004'$$,
  array['New Owner'::text],
  'retries cannot overwrite the original display name'
);
select throws_ok(
  $$select * from private.bootstrap_account(
    'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Missing', 'en'
  )$$,
  'P0001',
  'AUTH_USER_NOT_FOUND',
  'an unknown auth identity is rejected'
);
select throws_ok(
  $$select * from private.bootstrap_account(
    '00000000-0000-0000-0000-000000000004', 'Owner', 'en', '../bad'
  )$$,
  'P0001',
  'REFERRAL_CODE_INVALID',
  'malformed referral attribution is rejected'
);
select results_eq(
  $$select count(*)::integer from api.subscriptions s
    join api.household_members hm on hm.household_id = s.household_id
    join api.users u on u.id = hm.user_id
    where u.auth_user_id = '00000000-0000-0000-0000-000000000004'
      and hm.status = 'active'$$,
  array[1],
  'retries do not duplicate subscriptions'
);

select * from finish();
rollback;
