alter table private.whatsapp_provider_contacts
  drop constraint whatsapp_provider_contacts_provider_check;

alter table private.whatsapp_provider_contacts
  add constraint whatsapp_provider_contacts_provider_check
  check (provider in ('meta_cloud', 'twilio_sandbox'));

alter table private.whatsapp_delivery_events
  drop constraint whatsapp_delivery_events_delivery_state_check;

alter table private.whatsapp_delivery_events
  add constraint whatsapp_delivery_events_delivery_state_check
  check (delivery_state in ('queued', 'sent', 'delivered', 'read', 'failed'));

alter table private.whatsapp_delivery_events
  drop constraint whatsapp_delivery_events_provider_message_id_delivery_state_key;

alter table private.whatsapp_delivery_events
  add constraint whatsapp_delivery_events_provider_message_id_delivery_state_key
  unique nulls not distinct
    (provider_message_id, delivery_state, provider_timestamp);

comment on table private.whatsapp_inbound_events is
  'Deduplicated provider events. Message bodies expire after seven days and raw webhook payloads are not retained.';
