# DogOS Production Completion Plan

Status: execution plan after the production-readiness cleanup, 2026-07-19.

## Locked Sequence

1. Repository and provider-contract audit.
   - Keep `pnpm demo:product` deterministic.
   - Keep staging and production model mode behind `DOGOS_LLM_MODE=openai`, externally evidenced reviewed snapshots, eval gates, privacy approval, and protocol approval. In-repository synthetic fixtures cannot satisfy the approval gate.
   - Maintain one provider-neutral API contract and reveal decision-bearing model text only after DogOS validation.
   - Use the DogOS AI policy registry for task-based routing; do not collapse Luna/Terra/Sol, VOD, live, ASR, moderation, embedding, or CV into one universal model.

2. Supabase update, migrations, storage, and hosted environment readiness.
   - Keep local Supabase CLI/config aligned with hosted Supabase changelog changes before every provider release.
   - Apply migrations to staging with `DIRECT_URL`, run `pnpm db:reset`, `pnpm test:integration`, `pnpm db:test`, `pnpm db:lint`, and regenerate committed database types.
   - Keep exposed `api` tables protected by RLS plus explicit grants; keep private/provider tables server-only.
   - Ensure `dog-media` private storage accepts DogOS video MIME types and size limits before enabling real video uploads.
   - Verify Auth redirect URLs, publishable browser keys, server-only secret keys, JWT expiry, and production `DOGOS_AUTH_MODE=supabase`.
   - On 2026-07-18 the hosted Supabase database used by local `.env.local` was advanced through `20260718190000_production_readiness_contracts.sql`.

3. Landing page, referral attribution, signup, and account bootstrap.
   - Landing page starts a chat-first sign-up flow and preserves bounded `ref` codes.
   - Supabase auth metadata stores non-authoritative attribution at sign-up.
   - First-touch attribution is persisted in `private.account_attributions` by `private.bootstrap_account` atomically with user, household, subscription, and entitlement creation.

4. Validation-gated streaming, model evaluations, retrieval, and citations.
   - Coach UI uses Vercel AI SDK UI streaming.
   - Fastify exposes chunked DogOS text streaming for harmless acknowledgements and validated final text while the deterministic JSON path remains available.
   - Add blind eval fixtures for chat, plan, evidence, professional summary, and safety-boundary prompts before enabling production models.
   - The Coach route now attaches a versioned context capsule with bounded product state and confirmed memory; retrieval should next add only approved DogOS knowledge, video observations, session evidence, and user history that survived authorization and relevance filters.
   - Citations must be visible for evidence claims, plan rationale, and professional handovers.

5. Asynchronous video upload and analysis.
   - Use Supabase signed upload URLs for private `dog-media` objects when hosted Supabase storage is configured.
   - OpenAI frame-analysis adapter is available behind `DOGOS_VIDEO_ANALYSIS_PROVIDER=openai`.
   - A provider-neutral worker contract now validates private objects, media duration, frame extraction, provider findings, completion, and failure persistence. Durable media assets, analysis runs, attempts, evidence items, interpretations, reports, live events, and confidence calibrations have schema support. Supabase object reading, FFmpeg frame extraction, and a Vertex Gemini VOD adapter are implemented behind explicit env gates. Add malware scanning, queued background polling, local CV workers, retry/dead-letter handling, and real-provider E2E before marking workers ready.
   - Store extracted observations separately from canonical training decisions.
   - Return video findings as inline chat cards with confidence, missing data, and safety limitations.

6. LiveKit live coaching.
   - Use LiveKit only for media transport.
   - Web UI uses official LiveKit React room components and no longer exposes raw token/debug UI.
   - DogOS remains authoritative for auth, entitlements, retention, session state, and generated coaching.
   - Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`, then persist live transcript, user-approved observations, minutes consumed, and post-session summary.

7. Entitlements, Stripe, trainer workflows, and chat-native upgrades.
   - Enforce video analyses, live minutes, plan adjustments, concurrent dogs, and coaching messages through shared capability usage.
   - Surface upgrade actions in chat when a capability is exhausted, with account billing pages for full plan management.
   - Trainer/vet/affiliate flows now use a partner marketplace contract with suitability reasons, review status, required disclosures, server-created redirects, and a private commission ledger. Cal.com and Rewardful credentials still need real-provider E2E verification.

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
