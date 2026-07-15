-- Deterministic development identities. Password for each account: DogOS-local-2026
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner.ch@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'caregiver.ch@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'viewer.ch@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'revoked.ch@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'outsider.de@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'trainer.ch@dogos.local', crypt('DogOS-local-2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into api.users (
  id, auth_user_id, preferred_locale, locale_status, fallback_locale,
  country, legal_jurisdiction, timezone, currency
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'de-CH', 'confirmed', 'en', 'CH', 'CH', 'Europe/Zurich', 'CHF'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'en', 'confirmed', 'de-CH', 'CH', 'CH', 'Europe/Zurich', 'CHF'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'de-CH', 'confirmed', 'en', 'CH', 'CH', 'Europe/Zurich', 'CHF'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'de-CH', 'confirmed', 'en', 'CH', 'CH', 'Europe/Zurich', 'CHF'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'en', 'confirmed', 'de-DE', 'DE', 'DE', 'Europe/Berlin', 'EUR'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006', 'en', 'confirmed', 'de-CH', 'CH', 'CH', 'Europe/Zurich', 'CHF');

insert into api.households (
  id, name, default_locale, fallback_locale, country, legal_jurisdiction,
  timezone, currency, created_by
) values
  ('20000000-0000-0000-0000-000000000001', 'Zuerich development household', 'de-CH', 'en', 'CH', 'CH', 'Europe/Zurich', 'CHF', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Berlin isolation household', 'de-DE', 'en', 'DE', 'DE', 'Europe/Berlin', 'EUR', '10000000-0000-0000-0000-000000000005');

insert into api.household_members (
  id, household_id, user_id, role, status, joined_at, revoked_at
) values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active', now(), null),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'caregiver', 'active', now(), null),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'viewer', 'active', now(), null),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'caregiver', 'revoked', now() - interval '30 days', now() - interval '1 day'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'owner', 'active', now(), null);

insert into api.conversation_sessions (
  id, user_id, household_id, channel, detected_locale, active_locale,
  detected_locale_confidence, locale_source
) values (
  '22000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'whatsapp', 'de-CH', 'en', 0.940, 'explicit_preference'
);

insert into api.localized_content (
  id, canonical_content_id, canonical_version, content_type, locale,
  source_locale, translation_status, translation_method, validity_state,
  title, body, human_reviewer_user_id, reviewed_at, valid_from
) values
  ('40000000-0000-0000-0000-000000000001', 'message.welcome', 1, 'general', 'de-CH', 'de-CH', 'approved_for_release', 'source_authored', 'valid', 'Willkommen', '{"text":"Willkommen bei DogOS."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000002', 'message.welcome', 1, 'general', 'en', 'de-CH', 'human_review_pending', 'machine_translation', 'valid', 'Welcome', '{"text":"Welcome to DogOS."}', null, null, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000003', 'safety.stop_session', 1, 'safety_critical', 'de-CH', 'de-CH', 'approved_for_release', 'source_authored', 'valid', 'Training stoppen', '{"text":"Training stoppen und Abstand schaffen."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000004', 'safety.stop_session', 1, 'safety_critical', 'en', 'de-CH', 'human_review_pending', 'machine_translation', 'valid', 'Stop training', '{"text":"Stop training and create distance."}', null, null, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000005', 'legal.terms', 1, 'legal', 'de-CH', 'de-CH', 'legal_reviewed', 'source_authored', 'valid', 'Nutzungsbedingungen', '{"text":"Entwicklungsbedingungen fuer die Schweiz."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000006', 'legal.terms', 1, 'legal', 'en', 'de-CH', 'legal_reviewed', 'human_translation', 'valid', 'Terms', '{"text":"Development terms for Switzerland."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000007', 'question.primary_trigger', 1, 'question', 'de-CH', 'de-CH', 'professionally_reviewed', 'source_authored', 'valid', null, '{"text":"Was loest das Verhalten meistens aus?"}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000008', 'question.primary_trigger', 1, 'question', 'en', 'de-CH', 'human_review_pending', 'machine_translation', 'valid', null, '{"text":"What usually triggers the behavior?"}', null, null, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000009', 'protocol.loose_leash_intro', 1, 'protocol_instruction', 'de-CH', 'de-CH', 'approved_for_release', 'source_authored', 'valid', null, '{"text":"Beginne in einer reizarmen Umgebung."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-00000000000a', 'protocol.loose_leash_intro', 1, 'protocol_instruction', 'en', 'de-CH', 'professionally_reviewed', 'human_translation', 'valid', null, '{"text":"Begin in a low-distraction environment."}', '10000000-0000-0000-0000-000000000001', now(), now() - interval '1 day'),
  ('40000000-0000-0000-0000-00000000000b', 'message.welcome', 1, 'general', 'de-DE', 'de-CH', 'draft_machine_translation', 'machine_translation', 'valid', 'Willkommen', '{"text":"Willkommen bei DogOS."}', null, null, now() - interval '1 day'),
  ('40000000-0000-0000-0000-00000000000c', 'message.welcome', 1, 'general', 'de-AT', 'de-CH', 'draft_machine_translation', 'machine_translation', 'valid', 'Willkommen', '{"text":"Willkommen bei DogOS."}', null, null, now() - interval '1 day');

insert into api.question_definitions (
  id, question_code, version, answer_schema, sensitivity, validity_state
) values (
  '41000000-0000-0000-0000-000000000001', 'question.primary_trigger', 1,
  '{"type":"string","enum":["trigger.other_dog"]}', 'normal', 'valid'
);

insert into api.question_localizations (id, question_definition_id, localized_content_id) values
  ('41100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000007'),
  ('41100000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000008');

insert into api.breed_taxonomy (
  id, canonical_breed_code, vbo_id, fci_reference, recognition_status, version, validity_state
) values
  ('42000000-0000-0000-0000-000000000001', 'breed.labrador_retriever', 'vbo:development:1', 'FCI-122', 'recognized', 1, 'valid'),
  ('42000000-0000-0000-0000-000000000002', 'breed.border_collie', 'vbo:development:2', 'FCI-297', 'recognized', 1, 'valid');

insert into api.breed_aliases (id, breed_taxonomy_id, locale, alias) values
  ('42100000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'de-CH', 'Labrador Retriever'),
  ('42100000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'en', 'Labrador Retriever'),
  ('42100000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000002', 'de-CH', 'Border Collie'),
  ('42100000-0000-0000-0000-000000000004', '42000000-0000-0000-0000-000000000002', 'en', 'Border Collie');

insert into api.training_protocols (id, protocol_code, goal_family, status) values (
  '50000000-0000-0000-0000-000000000001',
  'protocol.loose_leash_foundation', 'goal.loose_leash_walking', 'development'
);

insert into private.protocol_versions (
  id, training_protocol_id, semantic_version, canonical_definition,
  evidence_level, validity_state, development_only, created_by
) values (
  '51000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '0.1.0-dev',
  '{"steps":[{"code":"step.low_distraction_baseline"}],"localeIndependent":true}',
  'pending_professional_review', 'draft', true,
  '10000000-0000-0000-0000-000000000001'
);

insert into private.rule_sets (
  id, rule_set_code, version, canonical_definition, validity_state
) values (
  '52000000-0000-0000-0000-000000000001', 'rules.development_progression', 1,
  '{"developmentOnly":true,"stopFirst":true,"localeIndependent":true}', 'draft'
);

insert into api.protocol_localizations (id, protocol_version_id, localized_content_id) values
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000009'),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-00000000000a');

insert into api.message_catalog_entries (
  id, message_key, message_version, localized_content_id, channel
) values
  ('54000000-0000-0000-0000-000000000001', 'message.welcome', 1, '40000000-0000-0000-0000-000000000001', 'whatsapp'),
  ('54000000-0000-0000-0000-000000000002', 'message.welcome', 1, '40000000-0000-0000-0000-000000000002', 'whatsapp'),
  ('54000000-0000-0000-0000-000000000003', 'message.welcome', 1, '40000000-0000-0000-0000-00000000000b', 'whatsapp'),
  ('54000000-0000-0000-0000-000000000004', 'message.welcome', 1, '40000000-0000-0000-0000-00000000000c', 'whatsapp');

insert into api.dogs (
  id, household_id, name, sex, neuter_status, weight_kg, size_category,
  breed_status, created_by
) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Milo', 'male', 'neutered', 22.50, 'medium', 'mixed', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Milo EN', 'male', 'neutered', 22.50, 'medium', 'mixed', '10000000-0000-0000-0000-000000000005');

insert into api.dog_breed_links (
  id, dog_id, breed_taxonomy_id, source, user_certainty
) values
  ('30100000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', 'user_report', 0.600),
  ('30100000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000002', 'user_report', 0.400),
  ('30100000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', 'user_report', 0.600),
  ('30100000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000002', 'user_report', 0.400);

insert into api.dog_health_context (
  id, dog_id, reported_conditions, suspected_pain, sudden_behavior_change,
  mobility_constraints, source
) values
  ('30200000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '{}', false, false, '{}', 'user_report'),
  ('30200000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '{}', false, false, '{}', 'user_report');

insert into api.anamneses (
  id, dog_id, version, status, completeness, quality_status, completed_at, created_by
) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'completed', 1.000, 'complete', now(), '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 'completed', 1.000, 'complete', now(), '10000000-0000-0000-0000-000000000005');

insert into api.anamnesis_answers (
  id, anamnesis_id, question_definition_id, raw_answer_text, raw_answer_locale,
  canonical_answer_code, source, collected_channel
) values
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Vor allem andere Hunde', 'de-CH', 'trigger.other_dog', 'user_report', 'whatsapp'),
  ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'Mostly other dogs', 'en', 'trigger.other_dog', 'user_report', 'whatsapp');

insert into api.behavior_concerns (
  id, dog_id, anamnesis_id, concern_code, trigger_codes, frequency_code,
  intensity, context
) values
  ('62000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'behavior.leash_tension', array['trigger.other_dog']::api.canonical_code[], 'frequency.often', 3, '{"sourceLocale":"de-CH"}'),
  ('62000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'behavior.leash_tension', array['trigger.other_dog']::api.canonical_code[], 'frequency.often', 3, '{"sourceLocale":"en"}');

insert into api.goals (
  id, dog_id, owner_user_id, owner_goal_text, owner_goal_locale,
  canonical_goal_type, priority, status
) values
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Locker an anderen Hunden vorbeigehen', 'de-CH', 'goal.loose_leash_walking', 1, 'active'),
  ('70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'Walk past other dogs on a loose leash', 'en', 'goal.loose_leash_walking', 1, 'active');

insert into api.goal_versions (
  id, goal_id, version, baseline_definition, target_definition,
  measurement_definitions, environment_code, difficulty_definition,
  horizon_days, success_criteria, stop_criteria, escalation_criteria
) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 1, '{"continuousLooseSteps":4}', '{"continuousLooseSteps":12}', array['metric.continuous_loose_steps']::api.canonical_code[], 'environment.low_distraction', '{"distanceMeters":20}', 21, '{"minimum":12}', '{"codes":["stop.distress"]}', '{"codes":["escalate.safety_review"]}'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 1, '{"continuousLooseSteps":4}', '{"continuousLooseSteps":12}', array['metric.continuous_loose_steps']::api.canonical_code[], 'environment.low_distraction', '{"distanceMeters":20}', 21, '{"minimum":12}', '{"codes":["stop.distress"]}', '{"codes":["escalate.safety_review"]}');

insert into api.goal_measurements (
  id, goal_version_id, metric_code, value_numeric, is_unknown, unit_code,
  source, method_code, environment_code, measured_at, quality
) values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'metric.continuous_loose_steps', 4, false, 'unit.count', 'user_report', 'method.direct_count', 'environment.low_distraction', now(), 'moderate'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'metric.continuous_loose_steps', 4, false, 'unit.count', 'user_report', 'method.direct_count', 'environment.low_distraction', now(), 'moderate');

insert into api.plans (id, dog_id, goal_version_id, status) values
  ('73000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'active'),
  ('73000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'active');

insert into api.plan_versions (
  id, plan_id, version, protocol_version_id, rule_set_id,
  generation_reason_codes, generation_mode, status, effective_from
) values
  ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 1, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', array['generation.initial_plan']::api.canonical_code[], 'development', 'active', now()),
  ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 1, '51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', array['generation.initial_plan']::api.canonical_code[], 'development', 'active', now());

update api.plans set active_plan_version_id = '74000000-0000-0000-0000-000000000001' where id = '73000000-0000-0000-0000-000000000001';
update api.plans set active_plan_version_id = '74000000-0000-0000-0000-000000000002' where id = '73000000-0000-0000-0000-000000000002';

insert into api.plan_steps (
  id, plan_version_id, protocol_step_code, sequence_number,
  difficulty_parameters, repetitions, duration_seconds, stop_condition_codes
) values
  ('75000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'step.low_distraction_baseline', 1, '{"distanceMeters":20}', 5, 180, array['stop.distress']::api.canonical_code[]),
  ('75000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'step.low_distraction_baseline', 1, '{"distanceMeters":20}', 5, 180, array['stop.distress']::api.canonical_code[]);

insert into api.sessions (
  id, dog_id, handler_user_id, started_at, ended_at, completion_status
) values
  ('76000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '10 minutes', now() - interval '7 minutes', 'completed'),
  ('76000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', now() - interval '10 minutes', now() - interval '7 minutes', 'completed');

insert into api.session_measurements (
  id, session_id, metric_code, value_numeric, is_unknown, unit_code,
  source, method_code, measured_at, quality
) values
  ('77000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'metric.continuous_loose_steps', 8, false, 'unit.count', 'user_report', 'method.direct_count', now(), 'moderate'),
  ('77000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000002', 'metric.continuous_loose_steps', 8, false, 'unit.count', 'user_report', 'method.direct_count', now(), 'moderate');

insert into api.progress_evaluations (
  id, plan_version_id, status_code, confidence, evidence_ids,
  missing_metric_codes, engine_version, rule_set_id, evaluated_at
) values
  ('78000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'progress.improving', 'moderate', array['77000000-0000-0000-0000-000000000001']::uuid[], '{}', 'fixture-1', '52000000-0000-0000-0000-000000000001', now()),
  ('78000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'progress.improving', 'moderate', array['77000000-0000-0000-0000-000000000002']::uuid[], '{}', 'fixture-1', '52000000-0000-0000-0000-000000000001', now());

insert into api.plan_adjustments (
  id, plan_id, previous_plan_version_id, decision_code, reason_codes,
  evidence_ids, escalation_code, engine_version
) values
  ('79000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'adjustment.repeat', array['reason.partial_progress']::api.canonical_code[], array['77000000-0000-0000-0000-000000000001']::uuid[], 'escalate.none', 'fixture-1'),
  ('79000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002', 'adjustment.repeat', array['reason.partial_progress']::api.canonical_code[], array['77000000-0000-0000-0000-000000000002']::uuid[], 'escalate.none', 'fixture-1');

insert into api.risk_assessments (
  id, dog_id, goal_id, risk_level_code, triggered_rule_codes,
  disposition_code, permitted_action_codes, prohibited_action_codes,
  required_question_codes, rule_set_id, assessed_at
) values
  ('63000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'risk.low', array['rule.no_reported_injury']::api.canonical_code[], 'disposition.continue_development_only', array['action.low_distraction_training']::api.canonical_code[], '{}', '{}', '52000000-0000-0000-0000-000000000001', now()),
  ('63000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'risk.low', array['rule.no_reported_injury']::api.canonical_code[], 'disposition.continue_development_only', array['action.low_distraction_training']::api.canonical_code[], '{}', '{}', '52000000-0000-0000-0000-000000000001', now());

insert into api.trainers (
  id, user_id, display_name, service_countries, supported_locales,
  remote_available, status
) values (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000006', 'Development Trainer',
  array['CH']::api.country_code[], array['de-CH', 'en']::api.locale_tag[], true, 'active'
);

insert into private.trainer_case_shares (
  id, trainer_id, household_id, dog_id, purpose_code,
  include_sensitive_anamnesis, granted_by_user_id, granted_at, expires_at
) values (
  '81000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'share.training_review', true,
  '10000000-0000-0000-0000-000000000001',
  now() - interval '1 day', now() + interval '7 days'
), (
  '81000000-0000-0000-0000-000000000002',
  '80000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'share.training_review', true,
  '10000000-0000-0000-0000-000000000005',
  now() - interval '14 days', now() - interval '7 days'
);

insert into api.consent_documents (
  id, canonical_document_id, document_type, version, legal_jurisdiction,
  legal_text_hash, effective_from, validity_state
) values (
  '90000000-0000-0000-0000-000000000001', 'legal.terms', 'terms', 1, 'CH',
  'sha256:development-terms-ch-v1', now() - interval '1 day', 'valid'
);

insert into api.legal_document_localizations (
  id, consent_document_id, localized_content_id
) values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006');

insert into api.consents (
  id, user_id, household_id, consent_document_id,
  presented_localized_content_id, scope, acquisition_channel,
  evidence_reference, granted_at
) values (
  '92000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000006',
  '{"locale":"en","jurisdiction":"CH"}', 'signed_web',
  'development-fixture', now()
);
