# DogOS Production Readiness Gates

Last updated: 2026-07-19

## Required Before Real Production Activation

1. Supabase project has migrations applied, RLS checked, Storage bucket private, and service secret configured only on the API.
2. OpenAI mode is enabled only with `DOGOS_LLM_MODE=openai`, externally evidenced approved model snapshot, passing blind evals, professional protocol review, and current provider data-control review. The repository contains no production-approved model snapshot.
3. LiveKit is enabled only with staging join/end smoke coverage and no token/debug UI.
4. Stripe is enabled only with verified webhooks, entitlement projection tests, and approved tax/legal setup.
5. Video analysis is enabled only with private upload verification, durable worker dependencies, provider eval, malware/media validation, frame extraction, and media/privacy approval.
6. Professional handoff artifacts may be created by owners only. External sharing is enabled only after signed sharing links, explicit recipient consent, expiry, and audit entries are verified.
7. Privacy export, deletion request, memory correction, and memory forgetting are available from Account.

## Local And CI Modes

- `pnpm demo:product` remains deterministic and must not call OpenAI, LiveKit, Stripe, or external video providers.
- CI without provider secrets runs deterministic unit, database, and e2e flows.
- CI with staging secrets may additionally run provider smoke tests against Supabase Storage, validation-gated OpenAI responses, LiveKit room lifecycle, and Stripe webhook fixtures.

## Health Check Interpretation

`GET /health/ready` reports configured provider boundaries separately:

- `database`: Postgres/Supabase persistence configured.
- `supabaseStorage`: signed media upload provider configured.
- `openAI`: real LLM mode configured; otherwise deterministic.
- `liveKit`: live transport configured.
- `stripe`: billing provider configured.
- `workers`: durable video job dependencies configured (`DOGOS_VIDEO_WORKER_ENABLED=1`, Supabase object reader, `ffmpeg` frame extractor, storage, database, and provider).

## Handoff Gate

`POST /v1/dogs/:id/referrals` creates an owner-only trainer or veterinary case
packet from the current dashboard, confirmed memory, and completed video
analysis records. The packet must preserve unknowns and disagreements. Do not
enable public recipient links until the signed share-link lifecycle, expiry,
revocation, and professional access audit are tested against staging Supabase.

`GET /health/capabilities` reports AI capability readiness without secrets:

- `text`: OpenAI text provider and release manifest readiness.
- `vod`: recorded-video provider and worker readiness.
- `live`: realtime dialogue provider readiness.
- `cv`: local CV worker/model readiness.
- `asr`, `moderation`, `embedding`: explicitly configured auxiliary capability
  readiness.
- `knowledgeRelease`: approved knowledge release ID or `null`.
