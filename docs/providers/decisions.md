# Provider Decisions and Research Register

- Status: proposed
- Research date: 2026-07-14

This document records architecture decisions, current limitations, and official
sources. Provider behavior and pricing are volatile; Phase 2 must re-check each
source before pinning SDK/API/model versions.

## 1. Decision summary

| Capability            | Phase 2 choice                         | Alternative                 | Decision                                                                                                                                   |
| --------------------- | -------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| WhatsApp              | Meta Cloud API directly                | Twilio/WATI/ManyChat        | Direct API avoids an extra data processor and abstraction; build canonical transport adapter.                                              |
| Database/Auth/Storage | Supabase managed EU project            | Separate Postgres/Auth/S3   | Faster coherent RLS/auth/storage foundation; use explicit schemas/grants and local CLI.                                                    |
| Background jobs       | Trigger.dev                            | Temporal Cloud, BullMQ      | Durable retries/queues/idempotency with low operating burden. Revisit Temporal only for workflow complexity Trigger cannot express safely. |
| Text models           | AI SDK Core plus DogOS contracts       | Direct SDKs only            | Normalize common text capabilities while keeping policy/routing and canonical outputs under DogOS control.                                 |
| Initial text provider | Gemini stable fast model, configurable | OpenAI/Anthropic            | Product assumption; benchmark extraction, German quality, latency, cost, and privacy before production.                                    |
| Async video later     | Gemini stable video model              | OpenAI frame/event packages | Native video semantics, but 1 FPS processing means it cannot measure timing. Deferred.                                                     |
| Realtime later        | LiveKit + local CV                     | Daily/direct WebRTC         | Strong media/agent ecosystem and region controls; deferred due safety and current Gemini 3.1 compatibility limits.                         |
| Billing               | Stripe Billing                         | Paddle                      | Mature subscription/webhook lifecycle. Merchant/tax structure requires business/legal confirmation.                                        |
| Booking               | Cal.com API v2                         | Calendly/SavvyCal handoff   | API-first booking and webhooks; referral accounting remains in DogOS.                                                                      |
| Observability         | OpenTelemetry + Sentry                 | Datadog                     | Portable traces plus errors; scrub sensitive training and household data.                                                                  |
| Analytics/flags       | PostHog EU                             | Plausible + Unleash         | One consent-gated product analytics/flags surface; no decision-bearing training events sent by default.                                    |

## 2. Important verified limitations

### WhatsApp pricing and windows

WhatsApp's official pricing page states that business-platform pricing is per
delivered message, varies by market/category, service messages are free in the
24-hour service window, and utility replies to users are not charged. Costs must
be modeled per country and current rate card; no price is hard-coded.

### Gemini video

Google's current video documentation states that File API video is processed at
approximately one frame per second and warns that fast actions may lose detail.
Default media resolution is approximately 300 tokens per second including audio;
low resolution is approximately 100. This validates the hybrid design: Gemini
may provide semantic context but cannot be the reward/leash/timing measurement
layer.

### Gemini Live and LiveKit

LiveKit documents known compatibility limitations for
`gemini-3.1-flash-live-preview`, including unsupported mid-session instruction or
context updates for several agent operations. Realtime is therefore research,
not a committed first-release provider path.

### Cal.com API versioning

Current Cal.com v2 booking documentation requires a dated `cal-api-version`
header. The adapter must pin it centrally and contract-test webhook/event mapping.
Cal.com is a booking provider, not DogOS's referral ledger or commission authority.

### Supabase exposure defaults

Supabase announced that new tables are moving to opt-in Data/GraphQL API exposure.
DogOS adopts explicit grants immediately. Grants and RLS are separate controls;
both are reviewed and tested. Supabase's current local stack requires a Docker-
compatible runtime and supports pgTAP RLS tests.

### Trigger.dev idempotency

Trigger.dev v4.3.1 changed raw-string idempotency keys to run scope by default.
External webhook and one-time business operations must explicitly use global
scope plus a business-key-derived value and appropriate TTL.

## 3. SDK and API pinning policy

- Pin Node, pnpm, Python, `uv`, package versions, model IDs, and API versions.
- Commit `pnpm-lock.yaml` and `uv.lock` in Phase 2.
- Use Renovate/Dependabot for proposed updates, never unattended production
  provider/model upgrades.
- Contract-test each adapter against recorded sanitized fixtures and provider
  test environments.
- Record provider, SDK, API/model version, region, privacy setting, DPA status,
  and subprocessor review in the provider registry.
- Preview/experimental models cannot become the sole production path.

## 4. Privacy/provider acceptance questions

Before production credentials are enabled, verify for each provider:

1. Controller/processor roles, DPA, subprocessors, and international transfers.
2. EU/Swiss region or routing controls and what those controls do not cover.
3. Default retention, abuse monitoring, support access, and training settings.
4. Deletion/export behavior and incident notification terms.
5. Whether payloads may contain home video, voices, children, health context, or
   other sensitive personal data.
6. Contractual and technical opt-out from model training where applicable.
7. Pricing, quotas, rate limits, timeout behavior, and production support.

## 5. Official source register

All sources retrieved 2026-07-14.

| Provider/topic | Official source                                                                                          | Used for                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Next.js        | [Installation](https://nextjs.org/docs/app/getting-started/installation)                                 | App Router setup and Node requirement.                       |
| Fastify        | [Current reference](https://fastify.dev/docs/latest/Reference/)                                          | Current v5 API family and validation/server design.          |
| Supabase       | [Local development](https://supabase.com/docs/guides/local-development)                                  | CLI, Docker-compatible local stack, migrations.              |
| Supabase       | [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)                          | Explicit grants, schema exposure, RLS.                       |
| Supabase       | [Testing overview](https://supabase.com/docs/guides/local-development/testing/overview)                  | pgTAP and application-level RLS tests.                       |
| Supabase       | [Changelog](https://supabase.com/changelog)                                                              | Breaking-change review, exposure defaults, Postgres support. |
| WhatsApp       | [Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)                              | Delivered-message pricing, categories, service window.       |
| Trigger.dev    | [Tasks](https://trigger.dev/docs/tasks/overview)                                                         | Retries and queues.                                          |
| Trigger.dev    | [Idempotency](https://trigger.dev/docs/idempotency)                                                      | Scope behavior and deduplication.                            |
| Stripe         | [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)                          | Async subscription/entitlement lifecycle.                    |
| Cal.com        | [Bookings API](https://cal.com/docs/api-reference/v2/bookings/get-all-bookings)                          | API version header and canonical booking mapping.            |
| Cal.com        | [Webhooks API](https://cal.com/docs/api-reference/v2/orgs-webhooks/get-a-webhook)                        | Secret and event configuration.                              |
| AI SDK         | [Providers and models](https://ai-sdk.dev/docs/foundations/providers-and-models)                         | Multi-provider text abstraction.                             |
| AI SDK         | [Structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/output)                                | Schema-validated text output.                                |
| Gemini         | [Video understanding](https://ai.google.dev/gemini-api/docs/video-understanding)                         | FPS, token use, upload methods, limitations.                 |
| Gemini         | [Model lifecycle](https://ai.google.dev/gemini-api/docs/models)                                          | Stable/preview/latest model policy.                          |
| Gemini         | [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)                             | JSON Schema subset and semantic validation warning.          |
| LiveKit        | [Gemini integration](https://docs.livekit.io/agents/integrations/google/)                                | Future architecture and prerequisites.                       |
| LiveKit        | [Gemini Live plugin](https://docs.livekit.io/agents/models/realtime/plugins/gemini/)                     | Current 3.1 compatibility limitations.                       |
| LiveKit        | [Region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning/)                           | Future traffic residency controls.                           |
| EU             | [GDPR overview](https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en) | Personal data, minimization, storage, rights.                |
| EU             | [AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)                                                 | AI disclosure/transparency and oversight context.            |
| Switzerland    | [FADP legal basis](https://www.edoeb.admin.ch/en/legal-basis-data-protection)                            | Swiss legal framework.                                       |
| Switzerland    | [DPIA guidance](https://www.edoeb.admin.ch/en/data-protection-impact-assessment)                         | High-risk processing assessment.                             |

## 6. Open commercial decisions

- Production hosting vendor and exact EU regions.
- Stripe merchant-of-record/tax/VAT structure and EUR/CHF price catalog.
- Cal.com organization/platform plan and trainer account model.
- Provider DPAs, data controls, and paid support tiers.
- Whether PostHog is enabled at launch or deferred until consent analytics are
  fully reviewed.

## Related documents

- [Architecture](../architecture/phase-1.md)
- [Testing and approval](../testing/phase-1-approval.md)
