begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_schema('api', 'API schema exists');
select has_schema('private', 'private schema exists');
select has_table('api', 'localized_content', 'localized content registry exists');
select has_table('api', 'question_localizations', 'questions are localized separately');
select has_table('api', 'protocol_localizations', 'protocol presentation is version-bound');
select has_table('api', 'legal_document_localizations', 'legal documents have localized versions');
select has_table('private', 'translation_reviews', 'translation reviews are server-only');
select has_column('api', 'users', 'preferred_locale', 'users have an explicit locale');
select has_column('api', 'users', 'legal_jurisdiction', 'jurisdiction is separate from locale');
select has_column('api', 'users', 'currency', 'currency is separate from locale');
select has_column('api', 'households', 'default_locale', 'households have a default locale');
select has_column('api', 'conversation_sessions', 'detected_locale', 'sessions retain detected locale');
select has_column('api', 'conversation_sessions', 'active_locale', 'sessions retain active locale');
select ok(
  (select bool_and(relrowsecurity and relforcerowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('api', 'private') and c.relkind in ('r', 'p')),
  'all application tables force RLS'
);
select ok(
  not has_table_privilege('authenticated', 'private.audit_events', 'select'),
  'authenticated cannot select private audit events'
);
select ok(
  not has_table_privilege('authenticated', 'api.plan_versions', 'insert'),
  'authenticated cannot create plan versions'
);

select * from finish();
rollback;
