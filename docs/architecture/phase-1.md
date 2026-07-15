# DogOS Phase 1 Architecture

- Status: proposed for Phase 2 approval
- Last reviewed: 2026-07-15
- Product market: Switzerland first, then DACH
- Implementation status: Phase 2 foundation in progress

## 1. Product boundary

DogOS is multilingual by design, Swiss-positioned and DACH-first commercially.
German is the first reviewed launch content locale, not a technical product
boundary.

Canonical domain values and deterministic decisions are language-neutral.
BCP 47 locale, country, legal jurisdiction, timezone, and ISO currency are
independent context fields. Localized presentation is version-bound and cannot
change protocol, risk, progression, pricing, or analytics semantics.

The first release proves one complete training loop:

```text
anamnesis -> safety assessment -> prioritized problem -> measurable goal
-> baseline -> versioned plan -> daily micro-session -> measurements
-> progress evaluation -> deterministic adjustment -> escalation when required
```

It includes WhatsApp interaction, signed single-purpose web pages, personal
progress, subscriptions, and trainer referral. Automated video analysis and
live coaching are excluded. Phase 1 defines their contracts, consent, retention,
and audit boundaries so they can be added without changing the training engine.

### Evidence labels

Every content record and output carries one of these labels:

| Label                         | Meaning                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `verified_fact`               | Directly supported by an identified primary or official source.  |
| `professional_consensus`      | Supported by a named professional body or approved reviewer.     |
| `pending_professional_review` | Development content that must not drive a production plan.       |
| `product_assumption`          | A product or architecture decision requiring validation.         |
| `owner_report`                | Information supplied by an owner and not independently verified. |
| `measured_observation`        | A value captured by a defined measurement method.                |
| `hypothesis`                  | A non-diagnostic interpretation with evidence and confidence.    |

At Phase 1 completion, all sample protocols and safety thresholds are
`pending_professional_review`. No training content is production-approved.

## 2. Final stack recommendation

Versions are pinned during Phase 2 from current stable releases and committed
lockfiles. Provider model IDs are configuration, not domain constants.

| Area                  | Decision                                                 | Why                                                                                   |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Monorepo              | pnpm workspaces + Turborepo + strict TypeScript          | Shared contracts without publishing packages; fast scoped CI.                         |
| Web                   | Next.js App Router                                       | Marketing pages and signed mobile surfaces in one deployable app.                     |
| API                   | Fastify                                                  | Explicit webhook boundaries, schema validation, raw-body signature verification.      |
| Database/Auth/Storage | Supabase Postgres, Auth, Storage                         | Managed Postgres, RLS, signed private media access, local development.                |
| Background work       | Trigger.dev                                              | Durable TypeScript jobs, retries, queues, and idempotency without operating Temporal. |
| AI text gateway       | AI SDK Core behind DogOS interfaces                      | Unified Gemini/OpenAI/Anthropic text calls while retaining canonical DogOS outputs.   |
| Async video later     | Gemini stable video model behind `VideoAnalysisProvider` | Semantic context only; never the temporal measurement layer.                          |
| Realtime later        | LiveKit + local CV + a validated live model              | Deferred until provider compatibility, residency, latency, and safety gates pass.     |
| CV later              | MediaPipe/ONNX in browser; Python/ONNX workers           | High-frequency measurement remains separate from semantic interpretation.             |
| Billing               | Stripe Billing                                           | Subscription lifecycle and entitlement events through verified webhooks.              |
| Booking               | Cal.com API v2                                           | Availability and booking; DogOS retains referral attribution and commission state.    |
| Observability         | OpenTelemetry + Sentry                                   | Vendor-neutral traces plus application error reporting.                               |
| Analytics/flags       | PostHog EU, consent-gated                                | EU-hosted product analytics and feature flags; no training decision authority.        |
| CI                    | GitHub Actions                                           | Type, lint, unit, contract, RLS, integration, and documentation checks.               |

### Explicit deferrals

- No trainer portal in the first release. Trainer operations use an internal
  review workflow until demand justifies a separate application.
- No Temporal, LangGraph, or multi-agent framework. Trigger.dev plus explicit
  state machines covers current durable workflows.
- No WhatsApp Flows in the first release. Buttons, lists, media, voice notes,
  and signed links cover the approved journey.
- No public dog ranking, universal dog score, causal analytics, automated
  diagnosis, autonomous protocol generation, or breed-based risk labels.
- No automatic video interpretation or live coaching in the first release.

## 3. System architecture

```text
                         Public marketing pages
                                  |
WhatsApp Cloud API ---> Fastify API/webhook <--- Signed Next.js mobile pages
       |                  |      |                         |
       |                  |      +--> Auth-link service ---+
       |                  |                  |
       |                  +--> Conversation state machine  |
       |                                     |             |
       +-------------------------------------+-------------+
                                             |
            +--------------------------------+----------------------+
            |                                |                      |
     Safety engine                    Goal/plan engine       Entitlement engine
     deterministic                    deterministic          deterministic
            |                                |                      |
            +--------------------+-----------+----------------------+
                                 |
                      Progress evaluation engine
                                 |
                        Correlation observation
                      descriptive, non-causal only
                                 |
                  Supabase Postgres + Auth + Storage
                      RLS + private internal schemas
                                 |
          +----------------------+----------------------+
          |                      |                      |
     Trigger.dev             Stripe Billing         Cal.com v2
   reminders/webhooks      subscriptions/events   booking/events
          |
   future media job interface -> future CV/VLM/trainer review
```

## 4. Ownership and trust boundaries

### Fastify API

Fastify is the only public webhook ingress and the authority for:

- Meta, Stripe, Cal.com, and Trigger.dev signature verification;
- webhook event idempotency and replay protection;
- WhatsApp identity-link issuance and redemption;
- server-only plan generation and adjustment commands;
- signed media and action URLs;
- canonical error responses, tracing, rate limits, and audit events.

Provider payloads are stored only in a restricted audit envelope when needed.
Application services receive validated canonical contracts, never raw provider
responses.

### Next.js web

The web application owns public marketing pages and the approved signed mobile
surfaces. Sensitive state changes call the API. A signed link proves possession
of a short-lived capability, not identity by itself; account linking still
requires a Supabase session, OTP, or an explicit verified linking ceremony.

### Supabase

- `api` is the intentionally exposed Data API schema.
- `private` contains provider events, model runs, audit data, protocol review,
  referral accounting, and other server-only records.
- Grants are explicit and RLS is enabled on every exposed table.
- Household access is resolved from `household_members`; authorization never
  trusts user-editable JWT metadata.
- Views exposed to clients use `security_invoker = true`.
- Service-role and secret keys never enter browser bundles.
- Storage buckets are private; object access is household-scoped and time-bound.

## 5. Core data flows

### 5.1 WhatsApp onboarding and identity

```text
Meta webhook -> verify signature -> deduplicate provider event
-> resolve WhatsApp contact -> create provisional conversation
-> collect non-sensitive intake -> issue one-time signed link/OTP
-> authenticate with Supabase -> explicit account link
-> invalidate token -> audit link and device/session metadata
```

Sensitive history, consent, account changes, export, and deletion require an
authenticated web session. A WhatsApp conversation alone is insufficient.

### 5.2 Plan generation

```text
validated anamnesis + active risk flags + one prioritized goal
-> filter professionally approved protocol versions
-> evaluate eligibility and exclusions
-> create baseline measurement request
-> freeze protocol version and rule-set version
-> generate plan version and scheduled micro-sessions
-> explain the approved plan in the resolved locale through reviewed content
   or a constrained text-provider presentation layer
```

If no approved protocol is eligible, the engine returns an explicit unsupported
state and an escalation path. The LLM cannot fill the gap.

### 5.3 Check-in and adjustment

```text
session measurements + user report + environment + data quality
-> validate units and unknown values
-> run stop/escalation rules first
-> evaluate success and progression thresholds
-> choose continue/repeat/regress/progress/prerequisite/rest/question/escalate
-> write immutable progress evaluation and plan adjustment
-> create a new plan version when future steps change
-> produce a user-facing explanation from canonical evidence
```

### 5.4 Booking and referral

```text
qualified escalation -> rank eligible trainers by suitability
-> create signed referral -> retrieve Cal.com availability
-> create booking with referral metadata -> receive signed webhook
-> update booking and referral ledger idempotently
-> release commission only after the configured completion/refund window
```

Commission never participates in trainer ranking.

## 6. Provider contracts

The domain layer defines the interfaces; adapters contain SDK-specific code.

```typescript
interface TextGenerationProvider {
  extractContext(
    input: ContextExtractionInput,
  ): Promise<StructuredContextResult>;
  explainApprovedDecision(
    input: DecisionExplanationInput,
  ): Promise<LocalizedMessage>;
  summarizeProgress(input: ProgressSummaryInput): Promise<LocalizedMessage>;
}

interface BackgroundJobProvider {
  enqueue<T>(job: CanonicalJob<T>, idempotencyKey: string): Promise<JobHandle>;
  cancel(jobId: string): Promise<void>;
}

interface VideoAnalysisProvider {
  analyze(input: VideoAnalysisInput): Promise<CanonicalVideoAnalysis>;
}

interface BookingProvider {
  listAvailability(input: AvailabilityQuery): Promise<CanonicalSlot[]>;
  createBooking(input: BookingRequest): Promise<CanonicalBooking>;
}
```

All AI outputs are schema-validated and then semantically validated. Valid JSON
is not necessarily a valid training fact. Provider errors, missing capabilities,
and unsupported schemas fail closed.

## 7. Deployment and regional policy

- Maintain separate development, staging, and production environments.
- Select EU regions for primary application, database, storage, jobs,
  observability, and analytics where providers offer them.
- Treat Switzerland as a separate jurisdiction setting for policy, currency,
  trainer coverage, and legal text, not as a branch in training logic.
- Support `de-DE`, `de-AT`, `de-CH`, and later `en` through message keys and
  locale-aware formatting. Store money as integer minor units plus ISO currency.
- Reject production startup when webhook secrets, public origins, retention,
  consent text versions, or provider privacy settings are missing/insecure.

## 8. Cost drivers

| Driver                                          | Control                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| WhatsApp delivered templates by market/category | Prefer user-initiated service windows, one useful reminder, and bundled summaries.                          |
| LLM input/output tokens                         | Send structured state summaries, not full history; cache approved explanations.                             |
| Supabase database/storage/egress                | Retention jobs, private derivatives, indexes, and bounded audit payloads.                                   |
| Trigger.dev runs and compute                    | Coalesce reminders, idempotency, concurrency limits, no polling loops.                                      |
| Stripe Billing                                  | Treat fees as commercial configuration; avoid custom payment state.                                         |
| Cal.com API/plan                                | Cache short-lived availability and avoid building scheduling.                                               |
| Sentry/PostHog event volume                     | Sampling, consent, PII scrubbing, and bounded event schemas.                                                |
| Future video                                    | Duration/size caps, preprocessing, event/keyframe selection, no reprocessing without rubric version change. |

## 9. Licensing and provider risks

- FCI standards are reference material; ingestion, redistribution, and derived
  display rights require confirmation before copying text.
- VBO is CC BY 4.0 and requires attribution and version tracking.
- Training and veterinary sources remain citations, not bulk-copied content.
- MediaPipe, ONNX Runtime, LiveKit, and all model/runtime dependencies require a
  Phase 2 software-bill-of-materials and license scan.
- Do not adopt Ultralytics in the product until its commercial licensing is
  explicitly approved.
- Gemini Live 3.1 is preview and currently has documented LiveKit compatibility
  limitations. It is not a production commitment.

## 10. Architecture decisions before Phase 2

Approve or change:

1. Trigger.dev as the initial durable job provider.
2. AI SDK Core for text-provider normalization, wrapped by DogOS contracts.
3. Separate `api` and `private` Postgres schemas with explicit grants.
4. Fastify as the only webhook and domain-command ingress.
5. Single Next.js app for marketing plus signed mobile pages.
6. Protocol approval and safety review as hard production gates.
7. Automated video and LiveKit implementation deferred beyond the first release.

## Related documents

- [Domain model](domain-model.md)
- [Knowledge governance](../knowledge/governance.md)
- [Safety and escalation](../safety/safety-escalation.md)
- [WhatsApp and referral flows](../product/whatsapp-mobile.md)
- [Testing and approval](../testing/phase-1-approval.md)
