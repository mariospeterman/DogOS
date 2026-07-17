begin;
select plan(8);

select lives_ok(
  $$select private.project_stripe_subscription(
    'evt_test_plus', 'customer.subscription.created',
    '20000000-0000-0000-0000-000000000001', 'cus_test', 'sub_test',
    'tier.plus', 'active', now(), now() + interval '1 month'
  )$$,
  'projects a verified paid subscription'
);
select is(
  (select tier_code::text from api.subscriptions
   where household_id = '20000000-0000-0000-0000-000000000001'
     and canonical_status = 'active'),
  'tier.plus', 'paid tier becomes current'
);
select is(
  (select count(*)::integer from api.entitlements
   where household_id = '20000000-0000-0000-0000-000000000001'
     and status = 'active'),
  5, 'catalog capabilities are projected once'
);
select is(
  (select limits->>'perDay' from api.entitlements
   where household_id = '20000000-0000-0000-0000-000000000001'
     and capability_code = 'capability.coaching_messages'
     and status = 'active'),
  '40', 'limits come from the database catalog'
);
select is(
  private.project_stripe_subscription(
    'evt_test_plus', 'customer.subscription.created',
    '20000000-0000-0000-0000-000000000001', 'cus_test', 'sub_test',
    'tier.plus', 'active', now(), now() + interval '1 month'
  ),
  false, 'duplicate provider events are idempotent'
);
select is(
  (select count(*)::integer from private.provider_events
   where provider = 'stripe' and provider_event_id = 'evt_test_plus'),
  1, 'provider event is recorded once'
);
select lives_ok(
  $$select private.project_stripe_subscription(
    'evt_test_cancel', 'customer.subscription.deleted',
    '20000000-0000-0000-0000-000000000001', 'cus_test', 'sub_test',
    'tier.freemium', 'active', null, null
  )$$,
  'cancellation restores the local baseline tier'
);
select is(
  (select tier_code::text from api.subscriptions
   where household_id = '20000000-0000-0000-0000-000000000001'
     and canonical_status = 'active'),
  'tier.freemium', 'freemium is active after cancellation'
);

select * from finish();
rollback;
