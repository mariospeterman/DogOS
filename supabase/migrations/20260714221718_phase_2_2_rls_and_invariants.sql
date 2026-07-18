create function private.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from api.users where auth_user_id = auth.uid() and status = 'active'
$$;

create function private.has_household_role(
  target_household_id uuid,
  allowed_roles api.membership_role[] default array['owner', 'caregiver', 'viewer']::api.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from api.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = private.current_app_user_id()
      and hm.status = 'active'
      and hm.revoked_at is null
      and hm.role = any(allowed_roles)
  )
$$;

create function private.can_read_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_household_role(
    target_household_id,
    array['owner', 'caregiver', 'viewer']::api.membership_role[]
  )
$$;

create function private.can_write_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_household_role(
    target_household_id,
    array['owner', 'caregiver']::api.membership_role[]
  )
$$;

create function private.can_manage_household(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_household_role(
    target_household_id,
    array['owner']::api.membership_role[]
  )
$$;

create function private.household_id_for_dog(target_dog_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from api.dogs where id = target_dog_id
$$;

create function private.can_trainer_access_dog(
  target_dog_id uuid,
  require_sensitive boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from api.trainers t
    join private.trainer_case_shares share on share.trainer_id = t.id
    where t.user_id = private.current_app_user_id()
      and t.status = 'active'
      and share.dog_id = target_dog_id
      and share.revoked_at is null
      and share.expires_at > now()
      and (not require_sensitive or share.include_sensitive_anamnesis)
  )
$$;

create function private.can_read_dog(target_dog_id uuid, require_sensitive boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_read_household(private.household_id_for_dog(target_dog_id))
    or private.can_trainer_access_dog(target_dog_id, require_sensitive)
$$;

create function private.can_write_dog(target_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_write_household(private.household_id_for_dog(target_dog_id))
$$;

create function private.dog_id_for_goal(target_goal_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select dog_id from api.goals where id = target_goal_id $$;

create function private.dog_id_for_goal_version(target_goal_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.dog_id
  from api.goal_versions gv
  join api.goals g on g.id = gv.goal_id
  where gv.id = target_goal_version_id
$$;

create function private.dog_id_for_plan(target_plan_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select dog_id from api.plans where id = target_plan_id $$;

create function private.dog_id_for_plan_version(target_plan_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.dog_id
  from api.plan_versions pv
  join api.plans p on p.id = pv.plan_id
  where pv.id = target_plan_version_id
$$;

create function private.dog_id_for_plan_step(target_plan_step_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.dog_id_for_plan_version(ps.plan_version_id)
  from api.plan_steps ps where ps.id = target_plan_step_id
$$;

create function private.dog_id_for_scheduled_session(target_scheduled_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select private.dog_id_for_plan_step(ss.plan_step_id)
  from api.scheduled_sessions ss where ss.id = target_scheduled_session_id
$$;

create function private.dog_id_for_session(target_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select dog_id from api.sessions where id = target_session_id $$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.translation_status in (
      'professionally_reviewed', 'legal_reviewed', 'approved_for_release', 'superseded'
    ) then
      raise exception 'reviewed localization content is immutable; supersede it instead'
        using errcode = '55000';
    end if;
    return old;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only or immutable', tg_table_name
    using errcode = '55000';
end;
$$;

create function private.protect_approved_localized_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.translation_status in (
    'professionally_reviewed', 'legal_reviewed', 'approved_for_release'
  ) and (
    new.canonical_content_id is distinct from old.canonical_content_id
    or new.canonical_version is distinct from old.canonical_version
    or new.content_type is distinct from old.content_type
    or new.locale is distinct from old.locale
    or new.source_locale is distinct from old.source_locale
    or new.title is distinct from old.title
    or new.body is distinct from old.body
  ) then
    raise exception 'reviewed localization content is immutable; create a new canonical version'
      using errcode = '55000';
  end if;

  if old.translation_status = 'superseded'
     or (old.translation_status = 'approved_for_release'
         and new.translation_status not in ('approved_for_release', 'superseded')) then
    raise exception 'invalid localization status transition' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.validate_consent_localization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject_jurisdiction text;
begin
  select coalesce(h.legal_jurisdiction, u.legal_jurisdiction)
    into subject_jurisdiction
  from api.users u
  left join api.households h on h.id = new.household_id
  where u.id = new.user_id;

  if not exists (
    select 1
    from api.consent_documents d
    join api.legal_document_localizations ldl on ldl.consent_document_id = d.id
    join api.localized_content lc on lc.id = ldl.localized_content_id
    where d.id = new.consent_document_id
      and lc.id = new.presented_localized_content_id
      and d.legal_jurisdiction = subject_jurisdiction
      and lc.canonical_content_id = d.canonical_document_id
      and lc.canonical_version = d.version
      and d.validity_state = 'valid'
      and d.effective_from <= new.granted_at
      and (d.effective_until is null or d.effective_until > new.granted_at)
      and lc.content_type = 'legal'
      and lc.validity_state = 'valid'
      and lc.translation_status in ('legal_reviewed', 'approved_for_release')
      and (lc.valid_from is null or lc.valid_from <= new.granted_at)
      and (lc.valid_until is null or lc.valid_until > new.granted_at)
  ) then
    raise exception 'consent requires a valid, jurisdiction-matched, legally reviewed localization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.audit_user_locale_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.preferred_locale is distinct from old.preferred_locale
     or new.locale_status is distinct from old.locale_status then
    insert into private.audit_events (
      actor_user_id, action, target_type, target_id, metadata
    ) values (
      old.id,
      'user.locale_changed',
      'user',
      old.id,
      jsonb_build_object(
        'from_locale', old.preferred_locale,
        'to_locale', new.preferred_locale,
        'from_status', old.locale_status,
        'to_status', new.locale_status
      )
    );
  end if;
  return new;
end;
$$;

create function api.resolve_localized_content(
  requested_content_id api.canonical_code,
  requested_version integer,
  requested_locale api.locale_tag,
  fallback_locale api.locale_tag default 'en'
)
returns setof api.localized_content
language sql
stable
security invoker
set search_path = ''
as $$
  select lc.*
  from api.localized_content lc
  where lc.canonical_content_id = requested_content_id
    and lc.canonical_version = requested_version
    and lc.locale in (requested_locale, fallback_locale)
    and lc.validity_state = 'valid'
    and (lc.valid_from is null or lc.valid_from <= now())
    and (lc.valid_until is null or lc.valid_until > now())
    and case
      when lc.content_type in ('safety_critical', 'protocol_instruction')
        then lc.translation_status = 'approved_for_release'
      when lc.content_type = 'legal'
        then lc.translation_status in ('legal_reviewed', 'approved_for_release')
      else lc.translation_status <> 'superseded'
    end
  order by case when lc.locale = requested_locale then 0 else 1 end
  limit 1
$$;

create function private.activate_plan_version(
  target_plan_id uuid,
  target_plan_version_id uuid,
  actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from api.plan_versions
    where id = target_plan_version_id and plan_id = target_plan_id
  ) then
    raise exception 'plan version does not belong to plan' using errcode = '23503';
  end if;

  update api.plan_versions
  set status = 'superseded', effective_until = now(),
      superseded_by_plan_version_id = target_plan_version_id
  where plan_id = target_plan_id and status = 'active' and id <> target_plan_version_id;

  update api.plan_versions
  set status = 'active', effective_from = coalesce(effective_from, now()),
      effective_until = null, superseded_by_plan_version_id = null
  where id = target_plan_version_id;

  update api.plans set active_plan_version_id = target_plan_version_id
  where id = target_plan_id;

  insert into private.audit_events (
    actor_user_id, actor_type, action, target_type, target_id, metadata
  ) values (
    actor_user_id, 'server', 'plan.version_activated', 'plan_version',
    target_plan_version_id, jsonb_build_object('plan_id', target_plan_id)
  );
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function api.resolve_localized_content(
  api.canonical_code, integer, api.locale_tag, api.locale_tag
) from public, anon;
grant execute on function api.resolve_localized_content(
  api.canonical_code, integer, api.locale_tag, api.locale_tag
) to authenticated, service_role;
grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.has_household_role(uuid, api.membership_role[]) to authenticated;
grant execute on function private.can_read_household(uuid) to authenticated;
grant execute on function private.can_write_household(uuid) to authenticated;
grant execute on function private.can_manage_household(uuid) to authenticated;
grant execute on function private.household_id_for_dog(uuid) to authenticated;
grant execute on function private.can_trainer_access_dog(uuid, boolean) to authenticated;
grant execute on function private.can_read_dog(uuid, boolean) to authenticated;
grant execute on function private.can_write_dog(uuid) to authenticated;
grant execute on function private.dog_id_for_goal(uuid) to authenticated;
grant execute on function private.dog_id_for_goal_version(uuid) to authenticated;
grant execute on function private.dog_id_for_plan(uuid) to authenticated;
grant execute on function private.dog_id_for_plan_version(uuid) to authenticated;
grant execute on function private.dog_id_for_plan_step(uuid) to authenticated;
grant execute on function private.dog_id_for_scheduled_session(uuid) to authenticated;
grant execute on function private.dog_id_for_session(uuid) to authenticated;
grant execute on function private.activate_plan_version(uuid, uuid, uuid) to service_role;

create trigger users_set_updated_at before update on api.users
for each row execute function private.set_updated_at();
create trigger users_audit_locale after update on api.users
for each row execute function private.audit_user_locale_change();
create trigger households_set_updated_at before update on api.households
for each row execute function private.set_updated_at();
create trigger household_members_set_updated_at before update on api.household_members
for each row execute function private.set_updated_at();
create trigger user_contacts_set_updated_at before update on api.user_contacts
for each row execute function private.set_updated_at();
create trigger conversation_sessions_set_updated_at before update on api.conversation_sessions
for each row execute function private.set_updated_at();
create trigger dogs_set_updated_at before update on api.dogs
for each row execute function private.set_updated_at();
create trigger goals_set_updated_at before update on api.goals
for each row execute function private.set_updated_at();
create trigger plans_set_updated_at before update on api.plans
for each row execute function private.set_updated_at();
create trigger scheduled_sessions_set_updated_at before update on api.scheduled_sessions
for each row execute function private.set_updated_at();
create trigger trainers_set_updated_at before update on api.trainers
for each row execute function private.set_updated_at();
create trigger referrals_set_updated_at before update on api.professional_referrals
for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on api.bookings
for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at before update on api.subscriptions
for each row execute function private.set_updated_at();
create trigger video_jobs_set_updated_at before update on private.video_jobs
for each row execute function private.set_updated_at();

create trigger protect_reviewed_localization before update or delete on api.localized_content
for each row execute function private.protect_approved_localized_content();
create trigger validate_consent_localization before insert on api.consents
for each row execute function private.validate_consent_localization();

create trigger audit_events_append_only before update or delete on private.audit_events
for each row execute function private.reject_mutation();
create trigger referral_ledger_append_only before update or delete on private.referral_ledger_entries
for each row execute function private.reject_mutation();
create trigger translation_reviews_append_only before update or delete on private.translation_reviews
for each row execute function private.reject_mutation();
create trigger goal_versions_immutable before update or delete on api.goal_versions
for each row execute function private.reject_mutation();
create trigger plan_steps_immutable before update or delete on api.plan_steps
for each row execute function private.reject_mutation();
create trigger progress_evaluations_immutable before update or delete on api.progress_evaluations
for each row execute function private.reject_mutation();
create trigger progress_dimensions_immutable before update or delete on api.progress_dimensions
for each row execute function private.reject_mutation();
create trigger correlation_observations_immutable before update or delete on api.correlation_observations
for each row execute function private.reject_mutation();
create trigger plan_adjustments_immutable before update or delete on api.plan_adjustments
for each row execute function private.reject_mutation();
create trigger risk_assessments_immutable before update or delete on api.risk_assessments
for each row execute function private.reject_mutation();
create trigger protocol_versions_immutable before update or delete on private.protocol_versions
for each row execute function private.reject_mutation();
create trigger rule_sets_immutable before update or delete on private.rule_sets
for each row execute function private.reject_mutation();

do $$
declare relation regclass;
begin
  for relation in
    select c.oid::regclass
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('api', 'private') and c.relkind in ('r', 'p')
  loop
    execute format('alter table %s enable row level security', relation);
    execute format('alter table %s force row level security', relation);
  end loop;
end;
$$;

grant usage on schema api to authenticated, service_role;
grant usage on schema private to service_role;
grant all on all tables in schema api, private to service_role;
grant all on all sequences in schema api, private to service_role;
grant execute on all functions in schema api, private to service_role;

grant select on all tables in schema api to authenticated;
revoke all on api.user_contacts from authenticated;
grant select (id, user_id, provider, contact_hash, verification_status, verified_at, linked_at, created_at, updated_at)
  on api.user_contacts to authenticated;

grant update (preferred_locale, locale_status, fallback_locale, timezone)
  on api.users to authenticated;
grant insert, update, delete on api.dogs, api.dog_breed_links, api.dog_history,
  api.dog_health_context, api.household_context, api.owner_profiles,
  api.anamneses, api.anamnesis_answers, api.behavior_concerns, api.safety_events,
  api.goals, api.goal_measurements, api.sessions, api.session_context,
  api.session_measurements, api.owner_checkins to authenticated;

create policy users_select_self on api.users for select to authenticated
using (id = private.current_app_user_id());
create policy users_update_self on api.users for update to authenticated
using (id = private.current_app_user_id())
with check (id = private.current_app_user_id() and auth_user_id = (select auth.uid()));
create policy contacts_select_self on api.user_contacts for select to authenticated
using (user_id = private.current_app_user_id());

create policy households_select_member on api.households for select to authenticated
using (private.can_read_household(id));
create policy members_select_member on api.household_members for select to authenticated
using (private.can_read_household(household_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'conversation_sessions', 'consents', 'household_context', 'owner_profiles',
    'subscriptions', 'entitlements', 'media_assets'
  ] loop
    execute format(
      'create policy %I on api.%I for select to authenticated using (private.can_read_household(household_id))',
      table_name || '_select_household', table_name
    );
  end loop;
end;
$$;

create policy dog_select_access on api.dogs for select to authenticated
using (private.can_read_dog(id, false));
create policy dog_insert_household on api.dogs for insert to authenticated
with check (private.can_write_household(household_id));
create policy dog_update_household on api.dogs for update to authenticated
using (private.can_write_household(household_id))
with check (private.can_write_household(household_id));
create policy dog_delete_owner on api.dogs for delete to authenticated
using (private.can_manage_household(household_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['dog_breed_links', 'dog_history', 'behavior_concerns'] loop
    execute format(
      'create policy %I on api.%I for select to authenticated using (private.can_read_dog(dog_id, false))',
      table_name || '_select_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for insert to authenticated with check (private.can_write_dog(dog_id))',
      table_name || '_insert_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for update to authenticated using (private.can_write_dog(dog_id)) with check (private.can_write_dog(dog_id))',
      table_name || '_update_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for delete to authenticated using (private.can_write_dog(dog_id))',
      table_name || '_delete_dog', table_name
    );
  end loop;

  foreach table_name in array array['dog_health_context', 'anamneses', 'safety_events'] loop
    execute format(
      'create policy %I on api.%I for select to authenticated using (private.can_read_dog(dog_id, true))',
      table_name || '_select_sensitive_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for insert to authenticated with check (private.can_write_dog(dog_id))',
      table_name || '_insert_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for update to authenticated using (private.can_write_dog(dog_id)) with check (private.can_write_dog(dog_id))',
      table_name || '_update_dog', table_name
    );
    execute format(
      'create policy %I on api.%I for delete to authenticated using (private.can_write_dog(dog_id))',
      table_name || '_delete_dog', table_name
    );
  end loop;
end;
$$;

create policy household_context_insert on api.household_context for insert to authenticated
with check (private.can_write_household(household_id));
create policy household_context_update on api.household_context for update to authenticated
using (private.can_write_household(household_id)) with check (private.can_write_household(household_id));
create policy household_context_delete on api.household_context for delete to authenticated
using (private.can_write_household(household_id));
create policy owner_profiles_insert on api.owner_profiles for insert to authenticated
with check (private.can_write_household(household_id) and user_id = private.current_app_user_id());
create policy owner_profiles_update on api.owner_profiles for update to authenticated
using (private.can_write_household(household_id) and user_id = private.current_app_user_id())
with check (private.can_write_household(household_id) and user_id = private.current_app_user_id());
create policy owner_profiles_delete on api.owner_profiles for delete to authenticated
using (private.can_write_household(household_id) and user_id = private.current_app_user_id());

create policy goals_select_dog on api.goals for select to authenticated
using (private.can_read_dog(dog_id, false));
create policy goals_insert_dog on api.goals for insert to authenticated
with check (private.can_write_dog(dog_id));
create policy goals_update_dog on api.goals for update to authenticated
using (private.can_write_dog(dog_id)) with check (private.can_write_dog(dog_id));
create policy goals_delete_dog on api.goals for delete to authenticated
using (private.can_write_dog(dog_id));

create policy goal_versions_select on api.goal_versions for select to authenticated
using (private.can_read_dog(private.dog_id_for_goal(goal_id), false));
create policy goal_measurements_select on api.goal_measurements for select to authenticated
using (private.can_read_dog(private.dog_id_for_goal_version(goal_version_id), false));
create policy goal_measurements_insert on api.goal_measurements for insert to authenticated
with check (private.can_write_dog(private.dog_id_for_goal_version(goal_version_id)));
create policy goal_measurements_update on api.goal_measurements for update to authenticated
using (private.can_write_dog(private.dog_id_for_goal_version(goal_version_id)))
with check (private.can_write_dog(private.dog_id_for_goal_version(goal_version_id)));
create policy goal_measurements_delete on api.goal_measurements for delete to authenticated
using (private.can_write_dog(private.dog_id_for_goal_version(goal_version_id)));

create policy plans_select on api.plans for select to authenticated
using (private.can_read_dog(dog_id, false));
create policy plan_versions_select on api.plan_versions for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan(plan_id), false));
create policy plan_steps_select on api.plan_steps for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan_version(plan_version_id), false));
create policy scheduled_sessions_select on api.scheduled_sessions for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan_step(plan_step_id), false));
create policy calendar_exports_select on api.calendar_exports for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan_version(plan_version_id), false));

create policy sessions_select on api.sessions for select to authenticated
using (private.can_read_dog(dog_id, false));
create policy sessions_insert on api.sessions for insert to authenticated
with check (private.can_write_dog(dog_id));
create policy sessions_update on api.sessions for update to authenticated
using (private.can_write_dog(dog_id)) with check (private.can_write_dog(dog_id));
create policy sessions_delete on api.sessions for delete to authenticated
using (private.can_write_dog(dog_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['session_context', 'session_measurements', 'owner_checkins'] loop
    execute format(
      'create policy %I on api.%I for select to authenticated using (private.can_read_dog(private.dog_id_for_session(session_id), false))',
      table_name || '_select_session', table_name
    );
    execute format(
      'create policy %I on api.%I for insert to authenticated with check (private.can_write_dog(private.dog_id_for_session(session_id)))',
      table_name || '_insert_session', table_name
    );
    execute format(
      'create policy %I on api.%I for update to authenticated using (private.can_write_dog(private.dog_id_for_session(session_id))) with check (private.can_write_dog(private.dog_id_for_session(session_id)))',
      table_name || '_update_session', table_name
    );
    execute format(
      'create policy %I on api.%I for delete to authenticated using (private.can_write_dog(private.dog_id_for_session(session_id)))',
      table_name || '_delete_session', table_name
    );
  end loop;
end;
$$;

create policy anamnesis_answers_select on api.anamnesis_answers for select to authenticated
using (exists (
  select 1 from api.anamneses a
  where a.id = anamnesis_id and private.can_read_dog(a.dog_id, true)
));
create policy anamnesis_answers_insert on api.anamnesis_answers for insert to authenticated
with check (exists (
  select 1 from api.anamneses a
  where a.id = anamnesis_id and private.can_write_dog(a.dog_id)
));
create policy anamnesis_answers_update on api.anamnesis_answers for update to authenticated
using (exists (
  select 1 from api.anamneses a
  where a.id = anamnesis_id and private.can_write_dog(a.dog_id)
));
create policy anamnesis_answers_delete on api.anamnesis_answers for delete to authenticated
using (exists (
  select 1 from api.anamneses a
  where a.id = anamnesis_id and private.can_write_dog(a.dog_id)
));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'observations', 'hypotheses', 'data_quality_assessments',
    'correlation_observations', 'risk_assessments'
  ] loop
    execute format(
      'create policy %I on api.%I for select to authenticated using (private.can_read_dog(dog_id, true))',
      table_name || '_select_dog', table_name
    );
  end loop;
end;
$$;

create policy progress_evaluations_select on api.progress_evaluations for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan_version(plan_version_id), true));
create policy plan_adjustments_select on api.plan_adjustments for select to authenticated
using (private.can_read_dog(private.dog_id_for_plan(plan_id), true));

create policy progress_dimensions_select on api.progress_dimensions for select to authenticated
using (exists (
  select 1 from api.progress_evaluations pe
  where pe.id = progress_evaluation_id
    and private.can_read_dog(private.dog_id_for_plan_version(pe.plan_version_id), true)
));

create policy breed_taxonomy_read on api.breed_taxonomy for select to authenticated
using (validity_state = 'valid');
create policy breed_aliases_read on api.breed_aliases for select to authenticated
using (exists (
  select 1 from api.breed_taxonomy bt
  where bt.id = breed_taxonomy_id and bt.validity_state = 'valid'
));
create policy question_definitions_read on api.question_definitions for select to authenticated
using (validity_state = 'valid');
create policy question_localizations_read on api.question_localizations for select to authenticated
using (exists (
  select 1 from api.localized_content lc
  where lc.id = localized_content_id and lc.validity_state = 'valid'
));
create policy training_protocols_read on api.training_protocols for select to authenticated
using (status = 'active');
create policy protocol_localizations_read on api.protocol_localizations for select to authenticated
using (exists (
  select 1 from api.localized_content lc
  where lc.id = localized_content_id
    and lc.validity_state = 'valid'
    and lc.translation_status = 'approved_for_release'
));
create policy localized_content_read on api.localized_content for select to authenticated
using (
  validity_state = 'valid'
  and translation_status <> 'superseded'
  and case
    when content_type in ('safety_critical', 'protocol_instruction')
      then translation_status = 'approved_for_release'
    when content_type = 'legal'
      then translation_status in ('legal_reviewed', 'approved_for_release')
    else true
  end
);
create policy message_catalog_read on api.message_catalog_entries for select to authenticated
using (exists (
  select 1 from api.localized_content lc
  where lc.id = localized_content_id and lc.validity_state = 'valid'
));
create policy consent_documents_read on api.consent_documents for select to authenticated
using (validity_state = 'valid');
create policy legal_document_localizations_read on api.legal_document_localizations for select to authenticated
using (exists (
  select 1 from api.localized_content lc
  where lc.id = localized_content_id
    and lc.validity_state = 'valid'
    and lc.translation_status in ('legal_reviewed', 'approved_for_release')
));

create policy trainers_read_active_or_self on api.trainers for select to authenticated
using (status = 'active' or user_id = private.current_app_user_id());
create policy trainer_credentials_read on api.trainer_credentials for select to authenticated
using (exists (select 1 from api.trainers t where t.id = trainer_id and t.status = 'active'));
create policy trainer_specialties_read on api.trainer_specialties for select to authenticated
using (exists (select 1 from api.trainers t where t.id = trainer_id and t.status = 'active'));
create policy referrals_trainer_read on api.professional_referrals for select to authenticated
using (private.can_read_household(household_id) or exists (
  select 1 from api.trainers t
  where t.id = trainer_id and t.user_id = private.current_app_user_id()
));
create policy bookings_household_or_trainer_read on api.bookings for select to authenticated
using (exists (
  select 1 from api.professional_referrals r
  where r.id = professional_referral_id
    and (private.can_read_household(r.household_id) or exists (
      select 1 from api.trainers t
      where t.id = bookings.trainer_id and t.user_id = private.current_app_user_id()
    ))
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dog-media', 'dog-media', false, 262144000,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy dog_media_select on storage.objects for select to authenticated
using (
  bucket_id = 'dog-media'
  and private.can_read_household((storage.foldername(name))[1]::uuid)
  and exists (
    select 1 from api.media_assets ma
    where ma.storage_bucket = bucket_id and ma.object_key = name
      and ma.retention_until > now()
  )
);

create policy dog_media_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'dog-media'
  and private.can_write_household((storage.foldername(name))[1]::uuid)
);

alter default privileges in schema api revoke all on tables from public, anon;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema api grant all on tables to service_role;
alter default privileges in schema private grant all on tables to service_role;

create view api.current_plan_summary
with (security_invoker = true)
as
select
  p.id as plan_id,
  d.household_id,
  p.dog_id,
  p.goal_version_id,
  p.active_plan_version_id,
  pv.status as plan_version_status,
  pv.effective_from,
  pv.effective_until
from api.plans p
join api.dogs d on d.id = p.dog_id
left join api.plan_versions pv on pv.id = p.active_plan_version_id;

grant select on api.current_plan_summary to authenticated, service_role;
