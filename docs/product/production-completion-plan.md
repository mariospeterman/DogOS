# DogOS Production Completion Plan

Status: execution plan after the chat-first multimodal wiring slice, 2026-07-18.

## Locked Sequence

1. Repository and provider-contract audit.
   - Keep `pnpm demo:product` deterministic.
   - Keep production model mode behind `DOGOS_LLM_MODE=openai`, reviewed snapshots, eval gates, privacy approval, and protocol approval.
   - Maintain one provider-neutral API contract and hide provider-specific streaming details behind DogOS endpoints.

2. Supabase update, migrations, storage, and hosted environment readiness.
   - Keep local Supabase CLI/config aligned with hosted Supabase changelog changes before every provider release.
   - Apply migrations to staging with `DIRECT_URL`, run `pnpm db:reset`, `pnpm test:integration`, `pnpm db:test`, `pnpm db:lint`, and regenerate committed database types.
   - Keep exposed `api` tables protected by RLS plus explicit grants; keep private/provider tables server-only.
   - Ensure `dog-media` private storage accepts DogOS video MIME types and size limits before enabling real video uploads.
   - Verify Auth redirect URLs, publishable browser keys, server-only secret keys, JWT expiry, and production `DOGOS_AUTH_MODE=supabase`.

3. Landing page, referral attribution, signup, and account bootstrap.
   - Landing page starts a chat-first sign-up flow and preserves bounded `ref` codes.
   - Supabase auth metadata stores non-authoritative attribution at sign-up.
   - First-touch attribution is persisted in `private.account_attributions` by `private.bootstrap_account` atomically with user, household, subscription, and entitlement creation.

4. True token streaming, model evaluations, retrieval, and citations.
   - Coach UI uses Vercel AI SDK UI streaming.
   - Fastify exposes chunked DogOS text streaming while the deterministic JSON path remains available.
   - Add blind eval fixtures for chat, plan, evidence, professional summary, and safety-boundary prompts before enabling production models.
   - Retrieval should attach only approved DogOS knowledge, session evidence, and user history that survived authorization and relevance filters.
   - Citations must be visible for evidence claims, plan rationale, and professional handovers.

5. Asynchronous video upload and analysis.
   - Use Supabase signed upload URLs for private `dog-media` objects when hosted Supabase storage is configured.
   - Add malware/content checks, external video model routing, background job state, and retry/dead-letter handling.
   - Store extracted observations separately from canonical training decisions.
   - Return video findings as inline chat cards with confidence, missing data, and safety limitations.

6. LiveKit live coaching.
   - Use LiveKit only for media transport.
   - DogOS remains authoritative for auth, entitlements, retention, session state, and generated coaching.
   - Persist live session transcript, user-approved observations, minutes consumed, and post-session summary.

7. Entitlements, Stripe, trainer workflows, and chat-native upgrades.
   - Enforce video analyses, live minutes, plan adjustments, concurrent dogs, and coaching messages through shared capability usage.
   - Surface upgrade actions in chat when a capability is exhausted, with account billing pages for full plan management.
   - Trainer flows should use referrals, professional summaries, bookings, status updates, and owner-controlled sharing.

8. Privacy export, deletion, and retention.
   - Authenticated export covers account, dog profile, conversations, plans, sessions, uploads, billing projection, and audit metadata.
   - Deletion workflow records legal holds, billing retention, storage deletion requirements, and irreversible anonymization work.
   - Publish retention windows and verify them with database tests.

9. Dead-code removal, full QA, commits, push, and CI verification.
   - Remove obsolete messaging-provider runtime paths after PWA flows cover production journeys.
   - Run lint, typecheck, unit, integration, database, and Playwright product tests.
   - Commit in narrow slices, push, open PR, wait for CI, and verify deployment health before claiming production readiness.

## UI Direction

DogOS should stay chat-first. The first screen is the coach, with plan, today,
progress, history, settings, billing, trainers, video, and live sessions opened
from chat actions or compact navigation. Billing and settings belong as pages
because they need reviewable forms and provider redirects. Upgrades, video
results, live-session summaries, plan changes, citations, and trainer handoffs
belong in chat as domain-specific inline cards.
