# DogOS Full Environment and E2E Setup

Last reviewed: 2026-07-19

This guide configures a real DogOS test environment for:

```text
new account -> onboarding -> dog profile -> plan -> first session
-> chat memory/context -> video upload/VOD -> live session
-> checkout/webhooks -> referral/trainer/vet/affiliate flows
```

Never commit real secrets. Put local secrets in `.env.local`; put staging and
production secrets in the deployment platform secret manager.

## 1. Validate Env File Syntax

Env files must contain only blank lines, comments, or `KEY=value` lines.
Markdown separators such as `---` are invalid and will break Supabase CLI.

```bash
pnpm check:env
```

## 2. Local Supabase

Start and reset the local database:

```bash
pnpm dev:services
pnpm db:reset
pnpm db:lint
```

Local `supabase start` prints local URL and keys. Copy only local values into
`.env.local` when testing locally:

```bash
DOGOS_AUTH_MODE=supabase
SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_STORAGE_BUCKET=dogos-media
```

Use the local publishable key for:

```bash
SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use the local secret/service key only server-side:

```bash
SUPABASE_SECRET_KEY=
```

For hosted Supabase, get project URL and API keys from the dashboard Settings >
API Keys / Connect dialog. Official docs:
[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Supabase Data API](https://supabase.com/docs/guides/api), and
[Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations).

Security checks:

- `SUPABASE_SECRET_KEY` must never be `NEXT_PUBLIC_`.
- Apply migrations to staging before production.
- Keep RLS enabled on exposed `api` tables.
- Create the configured `SUPABASE_STORAGE_BUCKET` before VOD testing.

## 3. OpenAI

Create an API key in the OpenAI project settings and configure:

```bash
DOGOS_LLM_MODE=openai
DOGOS_TEXT_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_DATA_REGION=global
DOGOS_TEXT_FAST_MODEL=gpt-5.6-luna
DOGOS_TEXT_COACH_MODEL=gpt-5.6-terra
DOGOS_TEXT_ESCALATION_MODEL=gpt-5.6-sol
DOGOS_ONBOARDING_MODEL=gpt-5.6-luna
```

Use `OPENAI_DATA_REGION=eu` only with an OpenAI project that has EU geography
restrictions enabled. If `DOGOS_AI_REQUIRED_PROCESSING_REGION=eu` and
`DOGOS_AI_ALLOW_CROSS_BORDER_PERSONAL_DATA=false`, DogOS rejects global OpenAI
routing.

Official docs:
[OpenAI API keys](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key),
[OpenAI production best practices](https://developers.openai.com/api/docs/guides/production-best-practices),
[OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses),
and [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model).

## 4. AI Release Manifests

Staging and production are fail-closed. Every enabled external model task needs:

1. A manifest object in `DOGOS_AI_RELEASE_MANIFESTS_JSON`.
2. A task selector env var pointing to that manifest ID.

Minimum manifest catalog:

```bash
DOGOS_AI_REQUIRE_RELEASE_MANIFEST=true
DOGOS_AI_FAIL_CLOSED=true
DOGOS_AI_RELEASE_MANIFESTS_JSON='[{"aggregateResult":0.97,"approvalDate":"2026-07-19T00:00:00.000Z","contextCompilerVersion":"dogos-context-2026-07-19.1","evaluationDatasetVersion":"dogos-evals-2026-07-19.1","expiry":"2026-10-19T00:00:00.000Z","hardGateFailures":[],"id":"manifest-coach-chat","jurisdictions":["CH","EU"],"knowledgeReleaseId":"knowledge-2026-07-19.1","model":"gpt-5.6-terra","permittedReleaseChannels":["staging","production"],"professionalReviewerId":"reviewer-prod","promptVersion":"prompts-2026-07-19.1","protocolVersions":["protocols-2026-07-19.1"],"provider":"openai","purpose":"coach.chat","rollbackTarget":null,"schemaVersion":"1.0","toolSetVersion":"tools-2026-07-19.1"}]'
DOGOS_AI_RELEASE_MANIFEST_COACH_CHAT=manifest-coach-chat
```

Create one manifest per enabled task:

```bash
DOGOS_AI_RELEASE_MANIFEST_ONBOARDING_EXTRACT=
DOGOS_AI_RELEASE_MANIFEST_LANGUAGE_DETECT=
DOGOS_AI_RELEASE_MANIFEST_COACH_CHAT=
DOGOS_AI_RELEASE_MANIFEST_PLAN_COMPOSE=
DOGOS_AI_RELEASE_MANIFEST_PLAN_EXPLAIN=
DOGOS_AI_RELEASE_MANIFEST_PROGRESS_EXPLAIN=
DOGOS_AI_RELEASE_MANIFEST_PROFESSIONAL_HANDOFF=
DOGOS_AI_RELEASE_MANIFEST_KNOWLEDGE_RUNTIME_SEARCH=
DOGOS_AI_RELEASE_MANIFEST_KNOWLEDGE_OFFLINE_SCOUT=
DOGOS_AI_RELEASE_MANIFEST_VIDEO_GLOBAL_SEMANTICS=
DOGOS_AI_RELEASE_MANIFEST_VIDEO_REPORT=
DOGOS_AI_RELEASE_MANIFEST_LIVE_STANDARD=
DOGOS_AI_RELEASE_MANIFEST_LIVE_PREMIUM=
DOGOS_AI_RELEASE_MANIFEST_AUDIO_TRANSCRIBE=
DOGOS_AI_RELEASE_MANIFEST_EMBEDDING_GENERATE=
DOGOS_AI_RELEASE_MANIFEST_CONTENT_MODERATE=
DOGOS_AI_RELEASE_MANIFEST_EVAL_JUDGE=
```

Only fill selectors for capabilities you enable. Example: if VOD is disabled,
`DOGOS_AI_RELEASE_MANIFEST_VIDEO_GLOBAL_SEMANTICS` can stay empty.

## 5. Google Vertex / Gemini VOD

Enable Vertex AI in Google Cloud, use a project with billing enabled, and get
an OAuth access token for the service account or workload identity used by the
worker.

```bash
DOGOS_VOD_PROVIDER=google_vertex
DOGOS_VOD_MODEL=gemini-3.5-flash
GOOGLE_VERTEX_PROJECT=
GOOGLE_VERTEX_LOCATION=europe-west4
GOOGLE_VERTEX_AUTH_MODE=adc
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/dogos-vertex-service-account.json
DOGOS_VIDEO_WORKER_ENABLED=1
DOGOS_VIDEO_OBJECT_READER=supabase
DOGOS_VIDEO_FRAME_EXTRACTOR=ffmpeg
DOGOS_VOD_TIMEOUT_MS=180000
DOGOS_VOD_MAX_EVENT_WINDOWS=12
```

Install FFmpeg locally:

```bash
brew install ffmpeg
ffmpeg -version
```

Recommended auth:

- Local developer testing: `gcloud auth application-default login`, or
  `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`.
- Server/staging/production: attach a service account to the runtime, or use
  workload identity federation. Do not store long-lived service account JSON in
  the repository.
- Temporary one-off smoke test only:
  `GOOGLE_VERTEX_AUTH_MODE=access_token` and
  `GOOGLE_VERTEX_ACCESS_TOKEN="$(gcloud auth print-access-token)"`. These tokens
  expire quickly and should not be used as production config.

The service account needs permission to call Vertex AI in the configured
project and location, typically `roles/aiplatform.user` scoped as narrowly as
your environment allows.

Official docs:
[Vertex AI generateContent](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations.publishers.models/generateContent),
[Google authentication overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/authentication),
[Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials),
[Set up ADC](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc),
and [Gemini Enterprise quickstart](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start).

## 6. LiveKit

Create a LiveKit Cloud project or use a self-hosted LiveKit deployment.
Configure:

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DOGOS_LIVE_PROVIDER=google_vertex
DOGOS_LIVE_MODEL=gemini-live-2.5-flash-native-audio
DOGOS_LIVE_FALLBACK_PROVIDER=openai
DOGOS_LIVE_FALLBACK_MODEL=gpt-realtime-2.1-mini
DOGOS_LIVE_POST_SESSION_VOD=true
```

Official docs:
[LiveKit project commands](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/),
[LiveKit Cloud](https://docs.livekit.io/intro/cloud/),
[LiveKit authentication](https://docs.livekit.io/frontends/build/authentication/),
and [LiveKit Agents video](https://docs.livekit.io/agents/multimodality/vision/video/).

## 7. Stripe Billing

Create Stripe products and recurring prices for Plus, Pro, and Ultra. Configure:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRODUCT_PLUS=
STRIPE_PRODUCT_PRO=
STRIPE_PRODUCT_ULTRA=
STRIPE_PRICE_PLUS_CHF=
STRIPE_PRICE_PRO_CHF=
STRIPE_PRICE_ULTRA_CHF=
```

For local webhook testing:

```bash
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

Official docs:
[Stripe API keys](https://docs.stripe.com/keys),
[Stripe webhooks](https://docs.stripe.com/webhooks),
[Stripe Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions),
and [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks).

## 8. Rewardful

Connect Rewardful to Stripe and install the browser script for the configured
site. Configure:

```bash
NEXT_PUBLIC_REWARDFUL_SITE_ID=
REWARDFUL_API_SECRET=
DOGOS_REWARDFUL_ENABLED=true
DOGOS_REWARDFUL_CLIENT_REFERENCE=true
```

DogOS sends the Rewardful referral ID into Stripe Checkout as
`client_reference_id` only when a referral exists.

Official docs:
[Rewardful Stripe server-side Checkout](https://help.rewardful.com/en/articles/9014067-integration-using-stripe-server-side-checkout),
[Rewardful JavaScript API](https://developers.rewardful.com/javascript-api/overview),
[Rewardful REST API](https://developers.rewardful.com/rest-api/overview),
and [Rewardful signed webhooks](https://developers.rewardful.com/webhooks/signed-webhooks).

## 9. Cal.com, Trainer, Vet, Affiliate Offers

Create a Cal.com API key or OAuth app. For this DogOS backend, configure:

```bash
CAL_API_KEY=
CAL_API_VERSION=2024-08-13
CAL_BASE_URL=https://api.cal.com/v2
CAL_WEBHOOK_SECRET=
CAL_DEFAULT_EVENT_TYPE_ID=
DOGOS_PARTNER_MARKETPLACE_ENABLED=true
DOGOS_PARTNER_REDIRECT_BASE_URL=http://localhost:3000/app/referral
DOGOS_AFFILIATE_DISCLOSURE_REQUIRED=true
DOGOS_AFFILIATE_ALLOW_FOOD=false
DOGOS_AFFILIATE_ALLOW_EQUIPMENT=true
DOGOS_TRAINER_MARKETPLACE_ENABLED=true
DOGOS_VETERINARY_ESCALATION_ENABLED=true
```

Use trainer/vet escalation only for disclosed, reviewed offers. Affiliate
offers must include clear disclosure and must not outrank safer or more relevant
non-commercial recommendations.

Official docs:
[Cal.com API v2](https://cal.com/docs/api-reference/v2/introduction),
[Cal.com create booking](https://cal.com/docs/api-reference/v2/bookings/create-a-booking),
and [Cal.com v1 to v2 migration](https://cal.com/docs/api-reference/v2/v1-v2-differences).

## 10. Local Validation Commands

Run this set before manual E2E:

```bash
pnpm check:env
pnpm dev:services
pnpm db:reset
pnpm db:lint
pnpm test
pnpm lint
pnpm smoke:ai
```

Use `pnpm smoke:ai:required` only when both OpenAI and Vertex credentials are
configured and expected to work.

If OpenAI smoke fails with an EU geography error, either:

- set `OPENAI_DATA_REGION=global` for a global OpenAI project, or
- use an EU geography-restricted OpenAI project and keep `OPENAI_DATA_REGION=eu`.

## 11. Manual E2E Script

Before testing email confirmation, make sure the web and API agree on the auth
mode:

```bash
# Real Supabase Auth E2E
DOGOS_AUTH_MODE=supabase
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=

# Local deterministic demo mode only
DOGOS_AUTH_MODE=local
NEXT_PUBLIC_DOGOS_ENV=local
NEXT_PUBLIC_DOGOS_LOCAL_IDENTITY=owner
```

If `DOGOS_AUTH_MODE=local`, the app uses a deterministic local actor. Supabase
email confirmation may still create a browser session, but it is not the source
of backend identity. For real auth testing, switch `DOGOS_AUTH_MODE=supabase`
and restart both web and API dev servers.

For local Supabase, `supabase/config.toml` is configured for auto-confirmed
email and allows `http://localhost:3000/auth/confirm`. If `.env.local` points
at a hosted Supabase project instead, signup uses that hosted project's Auth
settings. A browser error such as `Das Konto konnte nicht erstellt werden:
email rate limit exceeded` means Supabase Auth returned 429; wait for the
hosted rate window to reset or raise the hosted Auth email/sign-up limits in
the Supabase dashboard before repeating E2E signup tests.

1. Open the app and create a new Supabase Auth user.
2. Confirm email if email confirmation is enabled.
3. Verify `/v1/me` returns household, owner role, tier, locale, timezone, and currency.
4. Complete onboarding with dog name, breed/mix, age band, health screen, safety screen, goal, baseline, and household context.
5. Confirm DogOS creates the dog profile, active plan, and first scheduled session.
6. Send a coach message and verify it uses current dog context, plan state, memory, history, and context snapshot.
7. Open Plan, Progress, History, Video, Live, and Trainers tabs and confirm the same dog/account state is shown consistently.
8. Start and complete the first session; verify progress updates and history shows the event.
9. Upload a short private video; verify upload status, VOD worker, FFmpeg frame extraction, Vertex analysis, candidate findings, and post-session report.
10. Start a LiveKit session; verify room token creation, camera/microphone UX, event capture, summary, and optional post-session VOD.
11. Create a professional handoff from the coach or API; verify only owners can create it, the packet contains confirmed memory/video evidence refs, and unresolved disagreements remain visible.
12. Start Stripe Checkout for each tier; complete a test subscription and verify webhook-projected entitlement changes.
13. Visit with a Rewardful referral ID; verify it is carried into Stripe Checkout.
14. Open trainer/vet/affiliate offers; verify disclosure text, Cal.com booking link, referral record, redirect URL, and commission ledger behavior.
15. Export privacy data and submit deletion request to confirm account/media privacy flows still work.

## 12. Production Gate

Do not deploy production until all of these are true:

- `pnpm check:env`, `pnpm db:reset`, `pnpm db:lint`, `pnpm test`, and `pnpm lint` pass.
- `pnpm smoke:ai:required` passes with production/staging provider credentials.
- Stripe CLI or dashboard webhooks prove subscription lifecycle projection.
- Supabase Auth/Storage are tested against the target hosted project.
- All enabled external model tasks have approved, unexpired release manifests.
- Trainer, vet, Rewardful, Cal.com, and affiliate flows have disclosure and webhook verification.
