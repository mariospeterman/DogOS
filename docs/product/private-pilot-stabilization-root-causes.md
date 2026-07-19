# Private Pilot Stabilization Root Causes

Date: 2026-07-19
Branch: `codex/dogos-production-readiness`

## Scope

This note documents the Phase Zero stabilization fixes applied before continuing the private-pilot scope-freeze work.

## Root Causes Fixed

1. Formatting drift caused CI format failures across API, web, contracts, conversation, database and governance files.
   - Fix: ran `pnpm format` and kept the resulting Prettier-normalized files.

2. Several `private` foundation tables were not forced behind RLS, so the pgTAP schema invariant failed.
   - Fix: added migration `20260719192225_force_rls_on_private_foundation_tables.sql` to enable and force RLS, revoke public/anon/authenticated access, and grant service-role access for the affected internal tables.

3. Playwright web rewrites and the Next chat route could target the default local API port `4000` while E2E mutated the API server on `4200`.
   - Fix: configured `DOGOS_INTERNAL_API_URL=http://127.0.0.1:4200` for E2E web builds and made the server chat route honor configured local API URLs.

4. `/v1/local/reset` reset the local training fixture but left the in-memory Coach timeline intact, which leaked prior test messages into later scenarios.
   - Fix: added a scoped Coach conversation clear operation and call it from the local reset endpoint.

5. Management panels were rendered with the same `article` semantics as actual chat turns, making Playwright strict message locators match duplicate owner-visible text.
   - Fix: changed non-message Coach panels to `section` elements while leaving real user/assistant turns as `article`.

6. The Coach UI did not hide autonomous training when the latest deterministic decision was `reduce_difficulty`.
   - Fix: treats `reduce_difficulty` as a stopped autonomous-training state in the chat workspace.

7. Legacy PWA management URLs exposed standalone surfaces instead of redirecting into the unified Coach workspace.
   - Fix: `/app/plan`, `/app/video`, and `/app/live` now redirect into the relevant Coach workspace/action.

## Verification

The stabilization pass completed:

- `pnpm format`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm db:reset`
- `pnpm db:test`
- `pnpm db:lint`
- `pnpm db:types`
- `pnpm build`
- `pnpm test:e2e`
