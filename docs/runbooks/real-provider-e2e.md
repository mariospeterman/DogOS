# Real Provider E2E Runbook

- Status: implementation-ready; requires real provider credentials
- Last reviewed: 2026-07-19

## Scope

This runbook validates the production path:

```text
Supabase Auth sign-up
-> account bootstrap
-> Coach onboarding
-> dog profile and first plan
-> first session
-> context snapshot and AI response
-> video upload and VOD worker
-> live session
-> Stripe checkout/webhook
-> Rewardful / Cal.com / partner referral
```

## Required Configuration

Supabase:

- `DOGOS_AUTH_MODE=supabase`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `DATABASE_URL`
- `DIRECT_URL`

AI:

- `DOGOS_LLM_MODE=openai`
- `OPENAI_API_KEY`
- `OPENAI_DATA_REGION=eu` only when the OpenAI project is geography-restricted
  for EU processing; otherwise use `global` and explicitly allow cross-border
  personal data only in environments where that is legally approved
- `DOGOS_AI_RELEASE_MANIFESTS_JSON`, containing the approved manifest objects
  for the exact provider/model/task combinations being enabled
- task-level `DOGOS_AI_RELEASE_MANIFEST_*` values for every configured
  provider capability
- `DOGOS_AI_REQUIRE_RELEASE_MANIFEST=true`
- `DOGOS_AI_FAIL_CLOSED=true`

VOD:

- `DOGOS_VOD_PROVIDER=google_vertex`
- `DOGOS_VOD_MODEL=gemini-3.5-flash`
- `GOOGLE_VERTEX_PROJECT`
- `GOOGLE_VERTEX_LOCATION=europe-west4`
- `GOOGLE_VERTEX_AUTH_MODE=adc`
- `GOOGLE_APPLICATION_CREDENTIALS` for local service-account ADC, or runtime
  service-account / workload identity in staging and production
- `GOOGLE_VERTEX_ACCESS_TOKEN` only with
  `GOOGLE_VERTEX_AUTH_MODE=access_token` for short local smoke tests
- `DOGOS_VIDEO_WORKER_ENABLED=1`
- `DOGOS_VIDEO_OBJECT_READER=supabase`
- `DOGOS_VIDEO_FRAME_EXTRACTOR=ffmpeg`

Live:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `DOGOS_LIVE_PROVIDER=google_vertex` or a deliberately approved fallback

Commerce:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRODUCT_PLUS`, `STRIPE_PRODUCT_PRO`, `STRIPE_PRODUCT_ULTRA`
- `STRIPE_PRICE_PLUS_CHF`, `STRIPE_PRICE_PRO_CHF`, `STRIPE_PRICE_ULTRA_CHF`
- `NEXT_PUBLIC_REWARDFUL_SITE_ID`
- `REWARDFUL_API_SECRET`
- `CAL_API_KEY`
- `CAL_API_VERSION`
- `CAL_WEBHOOK_SECRET`

## Commands

```bash
pnpm db:reset
pnpm db:lint
pnpm test
pnpm lint
pnpm --filter @dogos/api typecheck
pnpm --filter @dogos/database typecheck
pnpm smoke:ai:required
pnpm dev
```

Use Stripe CLI to forward webhooks to `/webhooks/stripe`. Use Supabase Storage
to upload a short private video clip and then complete the upload in DogOS.

`pnpm smoke:ai` skips providers without credentials. `pnpm smoke:ai:required`
is the release check: OpenAI and Vertex must both complete when their production
paths are enabled.

## Release Manifest Shape

Every externally hosted model policy enabled in staging or production needs one
manifest in `DOGOS_AI_RELEASE_MANIFESTS_JSON` and the corresponding task-level
selector, for example `DOGOS_AI_RELEASE_MANIFEST_COACH_CHAT=manifest-coach`.

```json
[
  {
    "aggregateResult": 0.97,
    "approvalDate": "2026-07-19T00:00:00.000Z",
    "contextCompilerVersion": "dogos-context-2026-07-19.1",
    "evaluationDatasetVersion": "dogos-evals-2026-07-19.1",
    "expiry": "2026-10-19T00:00:00.000Z",
    "hardGateFailures": [],
    "id": "manifest-coach",
    "jurisdictions": ["CH", "EU"],
    "knowledgeReleaseId": "knowledge-2026-07-19.1",
    "model": "gpt-5.6-terra",
    "permittedReleaseChannels": ["staging", "production"],
    "professionalReviewerId": "reviewer-prod",
    "promptVersion": "prompts-2026-07-19.1",
    "protocolVersions": ["protocols-2026-07-19.1"],
    "provider": "openai",
    "purpose": "coach.chat",
    "rollbackTarget": null,
    "schemaVersion": "1.0",
    "toolSetVersion": "tools-2026-07-19.1"
  }
]
```

## Acceptance Checks

1. New Supabase user confirms email and lands in DogOS.
2. `/v1/me` returns a household, owner role, locale, currency, and tier.
3. Onboarding creates a dog profile, measurable goal, active plan, and first
   scheduled session.
4. Coach message persists a context snapshot and model run with task,
   policy version, and approved release manifest ID.
5. First session can be started and completed; progress updates without
   fabricating causality.
6. Video upload creates a private object, FFmpeg extracts frames, Vertex returns
   validated candidate findings, and DogOS stores the report.
7. LiveKit session creates a room token; session completion records a summary.
8. Stripe Checkout creates a subscription; webhook projection updates
   entitlements idempotently.
9. Rewardful referral ID is carried into Stripe Checkout when present.
10. Cal.com/trainer offer creates a DogOS referral record and uses a disclosed,
    allowlisted redirect.

## Official Docs Used

- OpenAI Agents and Responses docs:
  <https://developers.openai.com/api/docs/guides/agents>
- OpenAI GPT-5.6 guidance:
  <https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol.md>
- Supabase RLS:
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase migrations:
  <https://supabase.com/docs/guides/deployment/database-migrations>
- Stripe subscriptions and webhooks:
  <https://docs.stripe.com/billing/subscriptions/webhooks>
- Stripe Checkout subscriptions:
  <https://docs.stripe.com/payments/checkout/build-subscriptions>
- Rewardful Stripe Checkout guidance:
  <https://help.rewardful.com/en/articles/9014067-integration-using-stripe-server-side-checkout>
- Cal.com API v2:
  <https://cal.com/docs/api-reference/v2/introduction>
- LiveKit Agents and video:
  <https://docs.livekit.io/agents/>
  <https://docs.livekit.io/agents/multimodality/vision/video/>
- Vertex Gemini API:
  <https://cloud.google.com/vertex-ai/generative-ai/docs>
