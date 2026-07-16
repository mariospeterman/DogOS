begin;
select plan(11);

select has_table('private', 'coach_conversations', 'canonical coach conversations exist');
select has_table('private', 'coach_channel_bindings', 'channel bindings exist');
select has_table('private', 'coach_messages', 'canonical coach messages exist');
select has_column('private', 'coach_messages', 'channel', 'message origin is retained');
select has_column('private', 'coach_messages', 'client_message_id', 'web idempotency key is retained');
select has_column('private', 'coach_messages', 'provider_message_id', 'provider deduplication key is retained');
select has_column('private', 'coach_messages', 'context_kind', 'contextual handoff is retained');
select policies_are('private', 'coach_conversations', array[]::text[], 'conversations remain server-only');
select policies_are('private', 'coach_channel_bindings', array[]::text[], 'bindings remain server-only');
select policies_are('private', 'coach_messages', array[]::text[], 'messages remain server-only');
select col_is_unique('private', 'coach_conversations', array['household_id', 'dog_id'], 'one active thread per dog and household');

select * from finish();
rollback;
