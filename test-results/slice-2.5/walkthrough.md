# DogOS Slice 2.5 walkthrough

## Start

`pnpm demo:product`

Open [Today](http://127.0.0.1:3000/app/today). The command resets and seeds local data, starts the API and web product, and prints the deterministic local identities. WhatsApp conversations are exercised through provider contract and webhook tests rather than a user-facing web simulator.

## Restricted WhatsApp pilot

1. Run `pnpm whatsapp:verify-config`, start the API and web app, and expose both through HTTPS pilot tunnels.
2. Send **Hello** from the allowlisted WhatsApp number.
3. Open the newest one-time HTTPS account link and choose **Verbindung bestätigen**.
4. Return to WhatsApp and send **Today**. Open the signed Today link.
5. Use the mobile product for the plan, calendar, session execution, progress, and account management. The web product contains no chat simulator.

## Language continuity

The account locale command and WhatsApp state-machine tests prove that future presentation switches to English while Switzerland, CHF, Europe/Zurich, canonical state, and workflow position remain unchanged.

## Safety review

Choose **Schmerz vermutet** during the health screen or **Biss mit Kind** during the safety screen. The flow must stop and no unsafe exercise may be shown. The referral page states that DogOS is not a diagnosis or emergency service.

## Automated verification

Run:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:test
pnpm db:lint
pnpm db:types
pnpm build
pnpm audit
pnpm demo:product:check
```

Executed on 2026-07-16: 141 unit, 2 integration, 24 browser E2E (Desktop Chrome and Pixel 7), and 87 pgTAP tests passed: 254 automated tests total. Clean database reset, generated database types, application builds, and the dependency audit also passed.

## Owner-review findings

- Account-link hydration, explicit failure feedback, Today, check-in, progress, language continuity, and the suspected-pain stop were verified at a 390 x 844 mobile viewport.
- The deterministic core is language-neutral; the current German and English copy is a development fallback, not the intended long-term conversational intelligence.
- Safety gates behave correctly, but the development warning is too prominent for the final training-first product.
- The loose-leash protocol is still development-only and has not received professional protocol approval. This build must not be marketed as proven personalized dog training yet.

## Local identities

Send `x-dogos-user: owner|caregiver|viewer|trainer|unrelated` to the API. Mutations also require `idempotency-key`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Meta WhatsApp is a restricted pilot. Trainers and booking are mock data. Video analysis, Stripe, Cal.com, and production deployment are not implemented.
