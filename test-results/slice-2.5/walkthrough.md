# DogOS Slice 2.5 walkthrough

## Start

`pnpm demo:product`

Open [the simulator](http://127.0.0.1:3000/simulator). Complete the German low-risk choices, open the signed development action, start the session, record only observed values, and review progress. Use the language icon to switch presentation without changing Switzerland, CHF, Europe/Zurich, prior answers, or workflow state.

## Safety review

Choose **Schmerz vermutet** during the health screen or **Biss mit Kind** during the safety screen. The flow must stop and no unsafe exercise may be shown. The referral page states that DogOS is not a diagnosis or emergency service.

## Local identities

Send `x-dogos-user: owner|caregiver|viewer|trainer|unrelated` to the API. Mutations also require `idempotency-key`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Trainers and booking are mock data. Video analysis and real WhatsApp, Stripe, Cal.com, and production deployment are not implemented.
