# DogOS Slice 2.5 walkthrough

## Start

`pnpm demo:product`

Open [Today](http://127.0.0.1:3100/app/today). The command resets and seeds only local data, starts the isolated review API on port 4100 and web product on port 3100, and prints the deterministic local identities. WhatsApp conversations are exercised through provider contract and webhook tests rather than a user-facing web simulator.

## Restricted WhatsApp pilot

1. Run `pnpm whatsapp:verify-config`, start the API and web app, and expose both through HTTPS pilot tunnels.
2. Send **Hello** from the allowlisted WhatsApp number.
3. Open the newest one-time HTTPS account link and choose **Verbindung bestätigen**.
4. Return to WhatsApp and send **Today**. Open the signed Today link.
5. Use the mobile product for the plan, calendar, session execution, progress, and account management. The web product contains no chat simulator.

## Language continuity

The account locale command and WhatsApp state-machine tests prove that future presentation switches to English while Switzerland, CHF, Europe/Zurich, canonical state, and workflow position remain unchanged.

## Safety review

Choose **Akute Veränderung** during the health screen or **Biss / Kind** during the safety screen. DogOS holds the affected autonomous exercise, explains that it cannot diagnose the report, and offers professional review. Chat, history, account access, and update reporting remain available.

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

Executed on 2026-07-17: 181 unit, 7 integration, 32 browser E2E (Desktop Chrome and Pixel 7), and 133 pgTAP tests passed: 353 automated tests total. Clean database reset, generated database types, application builds, credential scan, and dependency audit also passed.

## Owner-review findings

- Hosted Supabase authentication, account-link hydration, Today, Plan, Session, progress, language continuity, and recoverable escalation were verified.
- Today, Plan, and Session were visually reviewed at a 390 x 844 mobile viewport in the white/navy/blue/red working-dog system.
- The deterministic core is language-neutral; the current German and English copy is a development fallback, not the intended long-term conversational intelligence.
- Routine development and safety warnings were removed from low-risk training. Short limitation copy appears after a relevant report.
- The loose-leash protocol is still development-only and has not received professional protocol approval. This build must not be marketed as proven personalized dog training yet.

## Local identities

Send `x-dogos-user: owner|caregiver|viewer|trainer|unrelated` to the API. Mutations also require `idempotency-key`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Meta WhatsApp is a restricted pilot. No trainer is listed until its credentials and availability are verified. Stripe billing is implemented but requires a configured catalog. Cal.com remains an optional booking adapter; video analysis and production deployment are not implemented.
