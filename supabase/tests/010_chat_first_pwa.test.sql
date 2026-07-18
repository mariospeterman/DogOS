begin;
select plan(10);

select has_table('private', 'owner_onboarding_sessions', 'owner onboarding sessions exist');
select has_column('private', 'owner_onboarding_sessions', 'owner_user_id', 'session is owner bound');
select has_column('private', 'owner_onboarding_sessions', 'household_id', 'session is household bound');
select has_column('private', 'owner_onboarding_sessions', 'state_version', 'session supports optimistic concurrency');
select policies_are('private', 'owner_onboarding_sessions', array[]::text[], 'sessions remain server-only');
select has_column('private', 'onboarding_projections', 'owner_user_id', 'product projection supports PWA owners');
select col_is_null('private', 'onboarding_projections', 'contact_id', 'provider contact is optional');
select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    join pg_class relation on relation.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = 'onboarding_projections'
      and constraint_record.conname = 'onboarding_projection_single_source_check'
  ),
  'projection has exactly one source'
);
select has_index('private', 'onboarding_projections', 'onboarding_projections_owner_user_unique', 'one projection exists per PWA owner');
select policies_are('private', 'onboarding_projections', array[]::text[], 'projections remain server-only');

select * from finish();
rollback;
