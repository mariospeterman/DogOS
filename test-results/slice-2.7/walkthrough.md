# DogOS Distribution and Growth Walkthrough

## Start locally

```bash
pnpm demo:product
```

Open [DogOS start](http://127.0.0.1:3000/?ref=DOGOS26). The primary action
opens the configured WhatsApp number with a bounded invite code. The code is
acquisition context only and grants no account or household access.

## Review the first-use journey

1. Confirm the first screen has one primary action: **In WhatsApp starten**.
2. Open the WhatsApp action and verify the prefilled message contains
   `DogOS starten` and, for this URL, `Einladung DOGOS26`.
3. Return to DogOS and select **Installieren**. Chromium shows the native PWA
   prompt when its install criteria are met; iOS shows the Safari Add to Home
   Screen instruction.
4. Select **Teilen** and verify the operating-system share sheet opens. The
   shared URL contains no dog, household, contact, or health data.
5. Select **Schon verbunden? DogOS öffnen** and sign in with Supabase Auth.
6. Open [Account](http://127.0.0.1:3000/app/account) and verify install/share are
   also available after authentication.
7. Continue through [Today](http://127.0.0.1:3000/app/today), Plan, Session,
   Calendar, and Progress. WhatsApp remains the conversation surface; these
   pages remain the durable training record.

## Automated verification

Executed on 2026-07-16:

```text
158 unit tests
  2 integration tests
 28 browser E2E tests (Desktop Chrome and Pixel 7)
 90 pgTAP database tests
278 automated tests total
```

Also passed: lint, format check, typecheck, clean database reset, database lint,
generated database types, production build, dependency audit, and
`pnpm demo:product:check`.

## Review evidence

- `screenshots/start-chromium.png`
- `screenshots/start-mobile-chromium.png`
- `docs/product/distribution-growth-commerce.md`

## Current boundaries

- The PWA is the shipping distribution target. Android TWA/Play packaging and
  a native-value iOS shell are not implemented.
- Referral redemption, attribution persistence, reward policy, and fraud
  controls are specified but not yet exposed through an API.
- Affiliate catalogs, redirect resolution, conversions, billing, and payouts
  are not integrated. Commission is excluded from recommendation ranking.
- Push notifications, public events, and nearby-handler discovery are deferred.
- The Meta WhatsApp setup remains a restricted pilot. App-store, payment,
  insurance, nutrition, and professional-service releases require their own
  policy and commercial review.
