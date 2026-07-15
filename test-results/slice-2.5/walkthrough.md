# DogOS Slice 2.5 walkthrough

## Start

`pnpm demo:product`

Open [the simulator](http://127.0.0.1:3000/simulator). The command resets and seeds local data, starts the API and web product, and prints the deterministic local identities.

## German low-risk journey

1. Choose **Los geht's**, **Verstanden**, **Deutsch**, **Keine Kinder**, **Gemischt / unbekannt**, **Keine**, **Nein**, and **Nein**.
2. Choose **Ziehen an der Leine**, **8 von 10 Abschnitten locker**, and baseline **6 von 10**.
3. Open **Plan öffnen** and then **Heutiges Training öffnen**.
4. Start the session. Record only observed repetitions and successes; leave measurements unknown when they were not observed.
5. Complete the check-in and open progress. The first decision remains **Stufe beibehalten** until enough comparable evidence exists.

## Language continuity

Reset the test account, proceed through dog identity in German, then use the language icon. Future prompts switch to English while prior German answers remain visible. Switzerland, CHF, Europe/Zurich, canonical answers, and workflow position remain unchanged.

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

Executed on 2026-07-15: 112 unit, 2 integration, 22 browser E2E (Desktop Chrome and Pixel 7), and 66 pgTAP tests passed: 202 automated tests total. Clean database reset, generated database types, application builds, and the dependency audit also passed.

## Owner-review findings

- The complete low-risk journey, check-in, progress view, language continuity, and suspected-pain stop were manually verified at a 390 x 844 mobile viewport.
- The deterministic core is language-neutral; the current German and English copy is a development fallback, not the intended long-term conversational intelligence.
- Safety gates behave correctly, but the development warning is too prominent for the final training-first product.
- The loose-leash protocol is still development-only and has not received professional protocol approval. This build must not be marketed as proven personalized dog training yet.

## Local identities

Send `x-dogos-user: owner|caregiver|viewer|trainer|unrelated` to the API. Mutations also require `idempotency-key`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Trainers and booking are mock data. Video analysis and real WhatsApp, Stripe, Cal.com, and production deployment are not implemented.
