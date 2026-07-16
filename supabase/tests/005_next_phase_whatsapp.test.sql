begin;
select plan(21);

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
select lives_ok($$insert into private.whatsapp_provider_contacts
  (provider, external_contact_id, external_contact_hash, allowlisted)
  values ('twilio_sandbox', 'whatsapp:+41790000000', 'hash-twilio-1', true)$$,
  'Twilio Sandbox contacts use the same provider-neutral persistence model');
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
select lives_ok($$do $block$
  begin
    insert into private.whatsapp_outbound_messages
      (provider_message_id, contact_id, message_kind, message_body, trace_id)
    select 'SM-status-1', id, 'text', 'hello', 'trace-status-1'
    from private.whatsapp_provider_contacts where provider = 'twilio_sandbox';
    insert into private.whatsapp_delivery_events
      (provider_message_id, delivery_state)
    values ('SM-status-1', 'queued'), ('SM-status-1', 'queued')
    on conflict do nothing;
  end
$block$;$$, 'queued Twilio callbacks persist and duplicate NULL timestamps conflict');
select is((select count(*) from private.whatsapp_delivery_events
  where provider_message_id = 'SM-status-1' and delivery_state = 'queued'), 1::bigint,
  'duplicate Twilio status callbacks create one delivery event');

select * from finish();
rollback;
