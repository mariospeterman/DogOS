# Phase 1 Test and Approval Plan

- Status: awaiting approval
- Last reviewed: 2026-07-14

Phase 1 passes when the architecture is internally consistent, traceable to
sources, and decision-complete enough to scaffold Phase 2. Passing Phase 1 does
not approve training content or production launch.

## 1. Documentation acceptance

- [ ] Every requested Phase 1 output is reachable from README within one click.
- [ ] All architecture diagrams agree on system boundaries and provider roles.
- [ ] Facts, professional consensus, pending review, product assumptions, user
      reports, measurements, observations, and hypotheses are distinguishable.
- [ ] No sample protocol is labeled production-approved.
- [ ] No statement claims that breed determines behavior or training outcome.
- [ ] No LLM/VLM is allowed to create protocols, decide safety, or progress plans.
- [ ] Unknown values remain unknown in contracts and examples.
- [ ] Active plan/protocol versions cannot change silently.
- [ ] Official/primary sources include retrieval dates and intended use.
- [ ] Deferred video/live scope has contracts but no implementation promise.

## 2. Phase 2 test architecture

### Static and unit tests

- strict TypeScript, lint/format, package-boundary and circular-dependency checks;
- canonical schema parse/reject tests, including unknown/null semantics;
- deterministic engine table tests for every rule and precedence combination;
- protocol validation, approval, expiry, and immutable-version tests;
- goal/progress math with decimal/units/boundary/insufficient-data cases;
- correlation minimum-sample and no-causal-language tests;
- locale, timezone, daylight-saving, EUR/CHF minor-unit tests;
- signed-token expiry, purpose, nonce, revocation, and replay tests.

### Database and RLS tests

- migrations apply from empty and reset deterministically;
- pgTAP tests for grants, RLS, constraints, views, and helper functions;
- owner/caregiver/viewer access within and across households;
- membership revocation and role downgrade take effect;
- `UPDATE` policies include required select/using/check behavior;
- trainer shares are explicit, purpose-bound, and expire;
- consent withdrawal blocks future media processing/access;
- Storage object policies prevent cross-household and expired access;
- API/private schema boundaries and default privileges remain deny-by-default;
- no service/secret key or privileged function is browser-callable.

### Webhook and job contract tests

- valid and invalid Meta/Stripe/Cal.com signatures;
- duplicate, delayed, and out-of-order events;
- retries after partial failure without duplicate messages, subscriptions,
  bookings, referrals, ledger entries, or plan adjustments;
- dead-letter/replay path with audit evidence;
- provider timeout/circuit-open behavior and user-safe fallback;
- Trigger.dev global idempotency behavior for external business events.

### Journey tests

1. New WhatsApp user -> disclosure -> identity link -> anamnesis -> goal -> plan.
2. Unknown/mixed breed follows the same complete path.
3. Safety signal blocks protocol selection before an LLM call.
4. Three sessions produce an explainable repeat/progress/regress decision.
5. Missing measurements produce insufficient data, not a zero or failed session.
6. Expired protocol prevents new plans while preserving audited existing state.
7. Text-provider outage returns approved deterministic fallback copy.
8. German variants and currencies render correctly with shared core logic.
9. Referral selection ignores commission and booking events remain idempotent.
10. Export/deletion/consent withdrawal complete across database, storage, jobs,
    analytics, and provider records according to retention policy.

### Security and abuse tests

- prompt injection in user text/voice transcript cannot alter tools, protocols,
  rules, or safety disposition;
- malformed provider payloads and oversized media fail before domain processing;
- rate limits and enumeration resistance on linking, OTP, signed links, exports;
- CSRF/session fixation/open redirect checks on signed mobile flows;
- PII/secrets redaction in logs, traces, Sentry, PostHog, and job payloads;
- dependency/SBOM/license/secret scans in CI;
- environment validation rejects insecure production defaults.

## 3. Engine approval fixtures

Before Phase 2 finishes, reviewers must approve a fixture catalog containing:

- eligible low-risk baseline;
- every exclusion and stop condition;
- conflicting rules and precedence;
- progression boundary just below/at/above threshold;
- regression and rest-day decisions;
- missing/contradictory/low-quality data;
- protocol expired/suspended/superseded;
- changed health/safety context during an active plan;
- no eligible protocol and no trainer coverage;
- DACH locale differences without training-logic differences.

Each fixture specifies exact canonical input, expected rule IDs, disposition,
plan version effect, evidence list, missing fields, confidence, and German
message meaning. Snapshotting only prose is insufficient.

## 4. Professional and legal approval gates

### Required before any production training plan

- [ ] Two or more qualified training/behavior reviewers are recruited and
      credential/independence criteria are documented.
- [ ] Launch goal set and every protocol version are approved.
- [ ] Safety/escalation matrix and German wording are approved.
- [ ] Veterinary reviewer approves pain, illness, sudden-change boundaries.
- [ ] Reviewer disagreement and suspension procedure is tested.

### Required before DACH public launch

- [ ] GDPR/Swiss FADP DPIA and records of processing are reviewed.
- [ ] AI disclosure, consent, privacy, retention, export/deletion, child/bystander,
      incident response, and subprocessor documentation are approved.
- [ ] Germany/Austria/Switzerland animal-welfare and consumer-claim review is
      complete, including any restricted training devices/methods.
- [ ] DACH trainer coverage and urgent fallback wording are operational.
- [ ] EUR/CHF billing, VAT/tax, refunds, and referral disclosures are approved.

Legal review must be performed by qualified counsel; these documents are
engineering preparation, not legal advice.

## 5. Product validation gates

Before expanding to automated video:

- users can complete onboarding and baseline without staff correction;
- plan adherence and check-in completion are measurable;
- users understand why plans progress/regress and can correct wrong inputs;
- safety escalation recall is measured against professionally labeled fixtures;
- protocol reviewer and support workflows are operational;
- false confidence/causal language audits pass;
- retention/export/deletion is proven end to end.

Before live coaching, require a separate approved architecture and benchmark for
latency, local CV event accuracy, unsafe cue rate, interruptions, region/data
handling, trainer handoff, and provider compatibility.

## 6. Phase 2 implementation sequence

1. Repository/toolchain and CI with pinned versions, lockfiles, secret scanning.
2. Canonical contracts and error model.
3. Supabase local project, schemas, migrations, generated types, RLS/pgTAP tests.
4. Protocol/knowledge fixtures clearly labeled development-only.
5. Deterministic safety, goal, plan, progress, and adjustment engines.
6. Provider interfaces and local mocks; no credentials required for tests.
7. Fastify webhook/auth-link shell with replay/idempotency tests.
8. Next.js marketing and signed mobile surface shell with German localization.
9. WhatsApp vertical slice, then Stripe and Cal.com skeletons.
10. Observability, privacy operations, full journey tests, and approval report.

Each unit is independently reviewable. Provider credentials are introduced only
after mocks and contract tests pass.

## 7. Decisions required to start Phase 2

The product owner must approve:

1. Architecture decisions listed in the architecture document.
2. Initial launch goals to support (recommend one goal family first).
3. Which sample protocols may exist as development fixtures.
4. Reviewer qualification and approval-count policy.
5. Initial retention defaults and country rollout order.
6. Hosting regions/vendors and provider accounts.
7. Public claims allowed before professional protocol approval.

## 8. Phase 1 result

Phase 1 is complete when this package is approved. Current status:

- Architecture and interfaces: proposed.
- Product scope: approved by product owner.
- Provider choices: proposed and source-checked on 2026-07-14.
- Training content: not professionally reviewed; production blocked.
- Safety thresholds/messages: not professionally reviewed; production blocked.
- Legal/privacy design: engineering proposal; counsel/DPIA review pending.
- Product assumptions: worked examples, thresholds, correlation display rules,
  hosting, pricing, and commercial provider plans require confirmation.

## Related documents

- [Architecture](../architecture/phase-1.md)
- [Provider decisions](../providers/decisions.md)
- [Safety](../safety/safety-escalation.md)
- [Worked plan](../product/worked-plan.md)
