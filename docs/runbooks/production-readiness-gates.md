# DogOS Production Readiness Gates

Last updated: 2026-07-18

## Required Before Real Production Activation

1. Supabase project has migrations applied, RLS checked, Storage bucket private, and service secret configured only on the API.
2. OpenAI mode is enabled only with `DOGOS_LLM_MODE=openai`, approved model snapshot, passing blind evals, and current provider data-control review.
3. LiveKit is enabled only with staging join/end smoke coverage and no token/debug UI.
4. Stripe is enabled only with verified webhooks, entitlement projection tests, and approved tax/legal setup.
5. Video analysis is enabled only with private upload verification, durable jobs, provider eval, and media/privacy approval.
6. Trainer handoff is enabled only with owner consent, signed sharing links, and audit entries.
7. Privacy export, deletion request, memory correction, and memory forgetting are available from Account.

## Local And CI Modes

- `pnpm demo:product` remains deterministic and must not call OpenAI, LiveKit, Stripe, or external video providers.
- CI without provider secrets runs deterministic unit, database, and e2e flows.
- CI with staging secrets may additionally run provider smoke tests against Supabase Storage, OpenAI streaming, LiveKit room lifecycle, and Stripe webhook fixtures.

## Health Check Interpretation

`GET /health/ready` reports configured provider boundaries separately:

- `database`: Postgres/Supabase persistence configured.
- `supabaseStorage`: signed media upload provider configured.
- `openAI`: real LLM mode configured; otherwise deterministic.
- `liveKit`: live transport configured.
- `stripe`: billing provider configured.
- `workers`: durable job processing dependencies configured.
