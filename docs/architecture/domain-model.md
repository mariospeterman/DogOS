# Domain Model and Canonical Contracts

- Status: proposed
- Last reviewed: 2026-07-15

This reference defines the Phase 1 logical model. It is not a migration. Phase 2
must convert it into reviewed SQL migrations, generated TypeScript types, and RLS
tests without silently changing the semantics below.

## 1. Modeling rules

- UUID primary keys; `created_at`, `updated_at`, and actor/source metadata on
  mutable records.
- Immutable versions for protocols, plans, rule sets, consent text, prompts,
  knowledge claims, evaluations, and adjustments.
- Measurements use explicit units, methods, timestamps, source, quality, and
  nullable value. Missing data is `unknown`, never zero and never inferred.
- Enumerations are versioned domain values, not provider strings.
- User reports, observations, hypotheses, and decisions are separate records.
- Every automated decision records its inputs, rule-set version, output, and
  explanation evidence.
- Country, locale, and currency are configuration/context fields; training rules
  contain no DACH-specific branches unless a cited legal/safety rule requires one.
- Domain codes, protocol logic, analytics dimensions, and persisted decisions are
  language-neutral. BCP 47 locale, country, legal jurisdiction, timezone, and ISO
  currency are modeled separately and never inferred from each other.
- Locale resolution uses explicit preference, confirmed account locale, WhatsApp
  metadata, safe conversation detection, household default, then platform
  fallback. A locale switch affects future presentation and is audited; it does
  not rewrite historical answers or decision records.
- Localizations are version-bound and move through
  `draft_machine_translation`, `human_review_pending`,
  `professionally_reviewed`, `legal_reviewed`, `approved_for_release`, or
  `superseded`. Safety-critical, protocol, and legal content fail closed unless
  the required review state exists for the requested scope.

## 2. Schema boundaries

| Schema    | Access                            | Contents                                                                                              |
| --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `api`     | Explicit Data API grants plus RLS | User/household/dog state and safe read models needed by signed pages.                                 |
| `private` | Server roles only                 | Protocol governance, knowledge claims, provider events, model runs, referrals, audits, job internals. |
| `auth`    | Supabase managed                  | Account authority; referenced by application profiles.                                                |
| `storage` | Supabase managed with policies    | Private media objects and metadata linkage.                                                           |

The frontend does not write plans, evaluations, protocol versions, entitlements,
referral financials, or audit records directly. It submits commands to Fastify.

## 3. Identity, household, and consent

| Entity                 | Required fields and constraints                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `users`                | `auth_user_id`, preferred/fallback locale, locale status, country, jurisdiction, timezone, currency, status.         |
| `user_contacts`        | normalized WhatsApp number hash/encrypted value, verification status, linked timestamp; uniqueness and relink audit. |
| `households`           | name, default/fallback locale, country, jurisdiction, currency, timezone, status.                                    |
| `household_members`    | household, user, role (`owner`, `caregiver`, `viewer`), status; unique active membership.                            |
| `consent_documents`    | canonical document, type, version, jurisdiction, legal text hash, effective dates.                                   |
| `consents`             | subject, document version, granted/withdrawn timestamp, scope, acquisition channel, evidence reference.              |
| `identity_link_tokens` | hashed one-time token, contact, intended user/household, expiry, consumed/revoked timestamps, nonce.                 |
| `audit_events`         | actor, action, target, timestamp, request/trace ID, outcome, bounded metadata; append-only.                          |

Consent types are separate for terms, privacy, AI disclosure, video analysis,
audio transcription, trainer sharing, research/debug reuse, and marketing.
Withdrawal does not erase the historical evidence that consent once existed.

### Localization and locale context

| Entity                         | Purpose                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `conversation_sessions`        | detected and active BCP 47 locale plus the winning resolution source; locale switches are audited.         |
| `localized_content`            | version-bound presentation keyed by canonical content/version, locale, method, review state, and validity. |
| `question_definitions`         | language-neutral question identity, answer schema, sensitivity, version, and validity.                     |
| `question_localizations`       | reviewed localized wording for one exact question definition.                                              |
| `protocol_localizations`       | presentation for one exact immutable protocol version; never decision-bearing protocol logic.              |
| `message_catalog_entries`      | channel-aware localized messages keyed by stable canonical message code/version.                           |
| `legal_document_localizations` | jurisdiction-bound consent document presentation linked to exact reviewed legal content.                   |
| `translation_reviews`          | append-only professional/legal review outcome and findings for one localized content record.               |

The initial development context uses `de-CH` as default, `de-DE` and `de-AT`
as additional German variants, and `en` as fallback. These are configuration
and fixture choices, not a database allowlist or a permanent product boundary.

## 4. Dog and anamnesis model

| Entity               | Purpose                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dogs`               | Individual identity, birth estimate, sex, neuter status, weight/size, breed status (`known`, `mixed`, `unknown`). |
| `dog_breed_links`    | Zero or more VBO/FCI references with source and user certainty; never required.                                   |
| `dog_history`        | Origin, household duration, life events, training history, methods, aids, and provenance.                         |
| `dog_health_context` | User-reported conditions, medication, suspected pain, sudden change, mobility constraints; not diagnoses.         |
| `household_context`  | Adults, children, animals, physical setting, routines, and management constraints.                                |
| `owner_profiles`     | Experience, available time, accessibility needs, confidence, preferred reinforcement and communication.           |
| `anamneses`          | Versioned assessment instance with status and completion/quality metadata.                                        |
| `anamnesis_answers`  | Question version, answer value, source, sensitivity, collected channel, and unknown/refused state.                |
| `behavior_concerns`  | Concrete behavior, trigger, frequency, intensity, context, history, and safety event links.                       |
| `safety_events`      | Bite/snap/injury/escape/child/animal risk report, recency, severity, source, and review status.                   |

Sensitive free text is minimized. Structured answers retain the question version
so later wording changes do not alter the meaning of old records.

## 5. Knowledge and protocol governance

| Entity               | Purpose                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `breed_taxonomy`     | Canonical breed identity, VBO ID, FCI reference, recognition status, version.             |
| `breed_aliases`      | Locale-aware names and synonyms linked to a canonical breed.                              |
| `breed_facts`        | Narrow factual claim, category, jurisdiction, evidence level, validity and review state.  |
| `breed_fact_sources` | Many-to-many link between fact and source with locator/quote hash.                        |
| `knowledge_sources`  | Citation metadata, owner/publisher, type, URL/DOI, retrieved date, license, jurisdiction. |
| `knowledge_claims`   | Atomic claim, evidence level, status, valid/review dates, supersession link.              |
| `training_protocols` | Stable protocol identity and goal family.                                                 |
| `protocol_versions`  | Immutable complete protocol definition and semantic version.                              |
| `protocol_sources`   | Claims/sources used by a protocol version.                                                |
| `protocol_reviews`   | Reviewer identity/qualification, findings, date, outcome.                                 |
| `protocol_approvals` | Explicit approval scope, jurisdiction, release channel, expiry/revocation.                |
| `rule_sets`          | Versioned deterministic safety/progression rules consumed by the engine.                  |

An approval applies to one exact version. Editing any decision-bearing protocol
field creates a new version and requires review. Active plans retain their frozen
version until an explicit migration decision is recorded.

## 6. Goals, plans, and schedules

| Entity               | Required semantics                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `goals`              | dog, owner-defined wording, canonical goal type, priority, status.                                                   |
| `goal_versions`      | baseline definition, target, measurement method, environment, difficulty, horizon, success/stop/escalation criteria. |
| `goal_measurements`  | goal version, metric, value/unknown, unit, source, method, environment, timestamp, quality.                          |
| `plans`              | dog, active goal version, status.                                                                                    |
| `plan_versions`      | immutable plan snapshot, protocol/rule versions, generation reason, effective range, superseded-by link.             |
| `plan_steps`         | plan version, protocol step, sequence, difficulty parameters, repetitions, duration, prerequisites.                  |
| `scheduled_sessions` | plan step, planned date/time window, duration, purpose, recovery/video/review flags.                                 |
| `calendar_exports`   | schedule version and revocable `.ics` token metadata; no public permanent calendar URL.                              |

Only one active plan version per goal is allowed. The engine can prepare a new
version, but activation is transactional with an audit event and notification.

## 7. Sessions, tracking, and evidence

| Entity                     | Purpose                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sessions`                 | planned step, actual start/end, completion state, interruption reason.                                               |
| `session_context`          | location category, distraction level, trigger/distance, sleep, feeding, exercise, handler state, environment.        |
| `session_measurements`     | repetitions, successes, latency, distance, duration, food acceptance, recovery, and other typed measurements.        |
| `owner_checkins`           | difficulty, confidence, perceived outcome, concerns, notes; explicitly subjective.                                   |
| `observations`             | observed fact with source, confidence, timestamp/range, support and unsupported-inference fields.                    |
| `hypotheses`               | non-diagnostic hypothesis, supporting/contradicting evidence, confidence, excluded claims, review status.            |
| `data_quality_assessments` | completeness, consistency, measurement reliability, and reasons.                                                     |
| `media_assets`             | owner/household, session/goal/protocol links, object key, MIME/size/duration, consent, retention, processing status. |
| `trainer_reviews`          | target record, reviewer, structured correction, outcome, timestamps.                                                 |

### Canonical measurement

```json
{
  "metric": "continuous_loose_steps",
  "value": 12,
  "unit": "count",
  "unknown": false,
  "method": "owner_counted",
  "source": "user_report",
  "measured_at": "2026-07-14T17:10:00Z",
  "environment": "quiet_street",
  "quality": "moderate"
}
```

Unknown example:

```json
{
  "metric": "response_latency",
  "value": null,
  "unit": "ms",
  "unknown": true,
  "unknown_reason": "not_measured",
  "method": null,
  "source": "none",
  "quality": "unavailable"
}
```

## 8. Evaluation, correlation, and adjustment

| Entity                     | Purpose                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `progress_evaluations`     | Per-dimension results, evidence IDs, missing data, confidence, engine/rule versions.                                                  |
| `progress_dimensions`      | Goal attainment, consistency, success, difficulty, latency, distance/duration, engagement, recovery, handler execution, data quality. |
| `correlation_observations` | Descriptive association, cohort/window, minimum sample rule, effect summary, caveat, status.                                          |
| `plan_adjustments`         | Decision enum, reason codes, evidence, previous/new plan versions, required questions or escalation.                                  |
| `risk_assessments`         | Triggered rules, severity, disposition, reviewer and resolution.                                                                      |

### Progress evaluation contract

```json
{
  "status": "improving",
  "confidence": "moderate",
  "dimensions": {
    "success_rate": { "value": 0.78, "trend": "up" },
    "difficulty": { "level": 1, "changed": false },
    "data_quality": { "value": "moderate" }
  },
  "evidence": [
    "success rate changed from 0.55 to 0.78",
    "three sessions were completed",
    "trigger distance was unchanged"
  ],
  "missing": ["response_latency"],
  "next_action": "repeat_same_difficulty",
  "reason_codes": ["PROGRESSION_CONSECUTIVE_SESSIONS_NOT_MET"]
}
```

The persisted canonical record uses evidence IDs and localized message keys;
human-readable strings above illustrate the user-facing projection.

### Allowed adjustment decisions

```text
continue_plan
repeat_step
reduce_difficulty
increase_difficulty
train_prerequisite
schedule_rest
ask_for_information
require_professional_review
stop_training
```

## 9. Commerce, trainers, and entitlement

| Entity                    | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `trainers`                | Profile, service region, languages, status.                                                |
| `trainer_credentials`     | Credential body, identifier, validity, verification and reviewer.                          |
| `trainer_specialties`     | Structured specialty/risk capability and approval state.                                   |
| `professional_referrals`  | User/dog/goal, reason, trainer, attribution expiry, signed-token hash, status.             |
| `referral_rank_factors`   | Suitability factors and values; excludes commission.                                       |
| `bookings`                | Canonical booking state plus Cal.com UID and event version.                                |
| `referral_ledger_entries` | Append-only amount/currency/type/status/reversal records.                                  |
| `subscriptions`           | Stripe customer/subscription references and canonical lifecycle state.                     |
| `entitlements`            | Capability, limits, effective range, source, status.                                       |
| `provider_events`         | Provider event ID, signature result, received/processed status, bounded payload reference. |

Money uses integer minor units and ISO 4217 currency (`EUR`, `CHF`). Ledger
corrections are reversal entries, never destructive edits.

## 10. Future video boundary

| Entity                     | Purpose                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `video_jobs`               | Asset, job type/version, provider route, idempotency key, state, attempts.                |
| `video_job_events`         | Append-only state transitions and failure details.                                        |
| `model_runs`               | Provider/model/prompt/schema versions, input references, usage, latency, outcome.         |
| `canonical_video_analyses` | Observation IDs, confidence, unsupported inference, escalation and trainer-review status. |

No raw model output can directly become a measurement, risk decision, or plan
adjustment. Future flow is `provider output -> adapter -> canonical schema ->
semantic validation -> observation -> deterministic engine`.

## 11. RLS access matrix

| Data                      | Owner/caregiver                            | Viewer            | Trainer                                 | Server/admin                 |
| ------------------------- | ------------------------------------------ | ----------------- | --------------------------------------- | ---------------------------- |
| Household and dog         | Read/write by membership role              | Read              | Only explicit share                     | Full audited access          |
| Plans/progress            | Read; commands through API                 | Read              | Shared cases only                       | Create/update                |
| Sensitive anamnesis       | Read/write with field restrictions         | No default access | Explicit purpose-bound share            | Audited access               |
| Media                     | Signed access when consent/retention valid | No default access | Explicit trainer share                  | Processing access            |
| Protocol/knowledge drafts | No                                         | No                | Assigned reviewer                       | Full                         |
| Referral financials       | User-visible status only                   | No                | Own booking status, not platform margin | Full                         |
| Audit/provider/model logs | No direct access                           | No                | No                                      | Restricted operational roles |

Phase 2 RLS tests must cover cross-household reads/writes, membership revocation,
role downgrade, trainer share expiry, withdrawn media consent, token replay,
view behavior, and Storage object policies.

## Related documents

- [Architecture](phase-1.md)
- [Knowledge governance](../knowledge/governance.md)
- [Safety and escalation](../safety/safety-escalation.md)
- [Worked plan](../product/worked-plan.md)
