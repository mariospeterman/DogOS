begin;
select plan(3);
select has_table('private', 'whatsapp_usage_windows', 'WhatsApp usage is durable');
select col_is_pk('private', 'whatsapp_usage_windows', array['contact_id', 'bucket_start'], 'one counter per contact and day');
select policies_are('private', 'whatsapp_usage_windows', array[]::text[], 'usage counters remain server-only');
select * from finish();
rollback;
