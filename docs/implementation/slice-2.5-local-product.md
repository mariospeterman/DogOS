# Slice 2.5: Mobile Product and Provider Test Harness

## Status

Implemented and locally testable with `pnpm demo:product`.

## Conversation

`@dogos/whatsapp` defines the provider-neutral `WhatsAppProvider` interface and
a local simulator adapter used only by automated tests. The adapter verifies HMAC webhook signatures,
deduplicates inbound message IDs, renders text, interactive, template, and media
messages, tracks delivery states, and retains resettable local history.

Structured onboarding is an explicit deterministic state machine from welcome
through plan, daily session, progress, adjustment, and professional escalation.
German Swiss and English prompts map to the same canonical facts. A locale
switch changes future presentation only; answers, workflow position, country
CH, currency CHF, and timezone Europe/Zurich remain unchanged. Free text and
simulated voice transcripts are notes, not authoritative extracted facts.

## Mobile surfaces

- `/app/today`: today's bounded exercise, setup, criteria, caps, and stop rules.
- `/app/plan`: owner and canonical goal, baseline, target, stage, prerequisites,
  schedule, evidence, latest adjustment, and explanation.
- `/app/calendar`: micro-sessions, rest, observation, review, completion, and
  bounded schedule interaction. The ICS control is visibly development-only.
- `/app/session/[id]`: timer and explicit observed measurements. Missing values
  remain unknown.
- `/app/progress`: separate progress dimensions, evidence, missing data,
  confidence context, decision reason, and non-causal correlation warning.
- `/app/trainers` and `/app/referral/[id]`: explainable mock ranking, mock
  booking, veterinary/trainer escalation, and safety limitations.
- `/app/account`: presentation locale and fixed Swiss account context.

## Safety and product honesty

Every owner flow identifies development-only protocols and professional review.
The product does not diagnose, claim emergency coverage, fabricate measurements,
rank dogs, or suggest that mock trainer availability is real. Suspected pain
blocks session start and recommends veterinary review. A child-involved bite
blocks plan generation and shows no exercise.

## Verification evidence

`test-results/slice-2.5` contains the walkthrough, German/English/safety HTML
reports, screenshots, API requests, and test summary. Ten product scenarios run
on Desktop Chrome and Pixel 7. Unit tests separately cover every signed-action
security branch and provider simulator behavior.

## Deferred release work

Stripe, Cal.com, LLM extraction, video analysis, and production deployment are
intentionally absent. Meta WhatsApp is available only as a restricted pilot.
DPAs/privacy controls, professional protocol approval, legal/commercial
decisions, production authentication, durable signed-action storage, and real
trainer supply must be approved before public release.
