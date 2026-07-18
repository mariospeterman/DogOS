# DogOS Chat-First PWA Walkthrough

Verified on 18 July 2026 against `main`.

## Start

```bash
cd /Users/maki/Documents/DogOS
pnpm demo:product
```

The command starts or reuses local Supabase, resets only the local DogOS
database, and starts the API and PWA with deterministic local authentication.

- Coach: <http://127.0.0.1:3100/app/coach>
- Plan: <http://127.0.0.1:3100/app/plan>
- Account: <http://127.0.0.1:3100/app/account>
- OpenAPI: <http://127.0.0.1:4100/openapi.json>

## First-Run Journey

1. Open the Coach URL at a mobile viewport.
2. Describe one dog naturally. Verified input:
   `My dog's name is Echo, an adult Belgian Malinois working on recall. Recall works half the time. Only me. No pain or sudden change. No bite or snapping. I have the complete setup.`
3. Confirm that no language selector appears and the response follows the input
   language.
4. Confirm that the active goal is `Reliable recall under low distraction`, the
   baseline is 50%, and the target is 80%.
5. Confirm that the complete onboarding transcript remains in the Coach after
   the plan is activated.
6. Confirm the inline block shows a three-minute, six-recall session and opens
   the session or calendar without leaving the PWA.
7. Open Plan, Progress, and Account from the persistent bottom navigation.

## Evidence

- `screenshots/echo-onboarding-mobile.png`: real durable first-run onboarding
  and generated recall plan at 375 x 812.
- `screenshots/coach-flow.png`: seeded Coach flow on desktop.
- `screenshots/start-chromium.png` and `start-mobile-chromium.png`: public
  direct-entry and referral-preserving account creation.
- `screenshots/safety-escalation.png`: contextual professional-review path.

## Automated Verification

- Unit: 160 passing assertions across 24 files.
- PostgreSQL integration: 6 passing assertions across 4 files.
- pgTAP: 143 passing assertions across 12 files after a clean reset.
- Playwright: 32 passing cases, 16 each on Chromium and Pixel 7 emulation.
- Formatting, ESLint, TypeScript, generated database types, database lint, demo
  check, and production build pass.

## Current Boundaries

- Deterministic local review mode does not call a billable model. Add a valid
  OpenAI key and enable the configured model mode only after blind evaluation.
- Training protocols remain development versions pending qualified professional
  review and source ingestion.
- Stripe lifecycle code and entitlement tables exist, but commercial catalog,
  tax configuration, secrets, and legal approval are required before checkout.
- Video analysis, LiveKit live coaching, verified trainer supply, privacy
  export/deletion, retention automation, and production deployment remain
  release work.
- Historical WhatsApp database migrations remain in migration history; no
  messaging-provider package, webhook, configuration, or runtime is active.
