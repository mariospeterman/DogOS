begin;
select plan(5);

select is(
  private.consume_capability(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'capability.coaching_messages', 'day', 2, current_date
  ), true, 'first use is accepted'
);
select is(
  private.consume_capability(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'capability.coaching_messages', 'day', 2, current_date
  ), true, 'last use within the limit is accepted'
);
select is(
  private.consume_capability(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'capability.coaching_messages', 'day', 2, current_date
  ), false, 'use above the limit is rejected atomically'
);
select is(
  (select used from private.capability_usage_buckets
   where household_id = '20000000-0000-0000-0000-000000000001'
     and actor_user_id = '10000000-0000-0000-0000-000000000001'
     and capability_code = 'capability.coaching_messages'
     and period_start = current_date),
  2, 'rejected use does not increment the bucket'
);
select throws_ok(
  $$select private.consume_capability(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    'capability.coaching_messages', 'day', 2, current_date
  )$$,
  'P0001', 'ACCESS_DENIED', 'unrelated actors cannot consume household quota'
);

select * from finish();
rollback;
