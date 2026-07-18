# Provider Readiness Runbook

Status: operational checklist for staging and production provider activation.

## Supabase

Use Supabase as the authority for Auth, Postgres, RLS, private media storage,
and generated database types.

1. Review the Supabase changelog before every provider release, especially
   breaking changes for CLI config, Auth, Storage, Data API exposure, and
   Postgres versions.
2. Keep `.env.example` as the committed variable contract. Hosted environments
   must provide `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and
   `SUPABASE_STORAGE_BUCKET`.
3. Apply migrations with a direct/session database URL, not the transaction
   pooler. Use the pooler URL only for the API runtime.
4. Run:

   ```bash
   pnpm dev:services
   pnpm db:reset
   pnpm test:integration
   pnpm db:test
   pnpm db:lint
   pnpm db:types
   git diff --exit-code -- packages/database/src/database.types.ts
   ```

5. Confirm hosted Auth redirect URLs include the deployed web origin and that
   `DOGOS_AUTH_MODE=supabase` in production.
6. Confirm the private `dog-media` bucket exists with a 250 MiB limit and these
   video MIME types: `video/mp4`, `video/quicktime`, `video/webm`.
7. Keep tables in the exposed `api` schema behind RLS and explicit grants. Keep
   provider envelopes, attribution, command responses, and usage counters in
   `private` with service-role access only.

## OpenAI

Production model activation requires:

- `DOGOS_LLM_MODE=openai`;
- `OPENAI_API_KEY`;
- approved model IDs for free, paid, and onboarding routes;
- `DOGOS_MODEL_SNAPSHOT_APPROVAL` matching the deployed model IDs;
- data residency and privacy approval for the configured OpenAI project;
- passing blind eval fixtures for extraction, coaching, citations, and safety
  boundaries.

The API must continue to send provider calls through DogOS adapters and store
model-run telemetry without exposing database tools to the model.

## LiveKit

Configure all values together:

- `LIVEKIT_URL`;
- `LIVEKIT_API_KEY`;
- `LIVEKIT_API_SECRET`.

LiveKit is media transport only. DogOS remains authoritative for identity,
household authorization, entitlements, session state, summaries, retention, and
billing minutes. Verify join tokens are short lived and scoped to one generated
room name.

## Stripe

Configure the complete catalog or leave billing disabled:

- `STRIPE_SECRET_KEY`;
- `STRIPE_WEBHOOK_SECRET`;
- `STRIPE_PRODUCT_PLUS`, `STRIPE_PRODUCT_PRO`, `STRIPE_PRODUCT_ULTRA`;
- `STRIPE_PRICE_PLUS_CHF`, `STRIPE_PRICE_PRO_CHF`,
  `STRIPE_PRICE_ULTRA_CHF`.

Run webhook signature tests before enabling production billing, and verify that
subscription projection updates entitlements before accepting paid traffic.

## Final Gate

Before declaring a real-provider environment ready to test:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:test
pnpm db:lint
pnpm build
```

Then push, wait for CI, and perform a real staging walkthrough: signup with a
referral code, bootstrap account, stream one coaching reply with citations,
upload a private video, create and complete a LiveKit session, open billing,
export privacy data, and file a deletion request.
