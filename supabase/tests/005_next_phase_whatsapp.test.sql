begin;
select plan(18);

select has_table('private', 'whatsapp_provider_contacts', 'provider contacts are server-only');
select has_table('private', 'whatsapp_conversation_sessions', 'conversation state is durable');
select has_table('private', 'whatsapp_inbound_events', 'inbound events are durable');
select has_table('private', 'whatsapp_outbound_messages', 'outbound messages are durable');
select has_table('private', 'whatsapp_delivery_events', 'delivery events are durable');
select has_table('private', 'whatsapp_message_commands', 'message commands are durable');
select has_table('private', 'whatsapp_processing_failures', 'retry failures are durable');
select has_table('private', 'whatsapp_identity_links', 'identity links are durable');
select col_is_unique('private', 'whatsapp_inbound_events', 'provider_event_id', 'provider events deduplicate');
select col_is_unique('private', 'whatsapp_identity_links', 'token_hash', 'only identity token hashes persist');
select col_not_null('private', 'whatsapp_inbound_events', 'expires_at', 'inbound retention is bounded');
select col_not_null('private', 'whatsapp_outbound_messages', 'expires_at', 'outbound retention is bounded');
select col_not_null('private', 'whatsapp_provider_contacts', 'external_contact_hash', 'contact hash is required');
select lives_ok($$insert into private.whatsapp_provider_contacts
  (external_contact_id, external_contact_hash, allowlisted)
  values ('41790000000', 'hash-1', true)$$);
select throws_ok($$insert into private.whatsapp_provider_contacts
  (external_contact_id, external_contact_hash, status)
  values ('41790000001', 'hash-2', 'linked')$$, '23514');
select lives_ok($$insert into private.whatsapp_inbound_events
  (provider_event_id, contact_id, message_kind, message_body, received_at, trace_id)
  select 'wamid.1', id, 'text', 'hello', now(), 'trace-1'
  from private.whatsapp_provider_contacts where external_contact_id = '41790000000'$$);
select throws_ok($$insert into private.whatsapp_inbound_events
  (provider_event_id, contact_id, message_kind, message_body, received_at, trace_id)
  select 'wamid.1', id, 'text', 'duplicate', now(), 'trace-2'
  from private.whatsapp_provider_contacts where external_contact_id = '41790000000'$$, '23505');
select policies_are('private', 'whatsapp_provider_contacts', array[]::text[], 'private contacts expose no client policies');

select * from finish();
rollback;
