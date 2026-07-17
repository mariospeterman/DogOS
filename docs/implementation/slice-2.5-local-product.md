# Slice 2.5: Mobile Product and Provider Test Harness

## Status

Implemented and locally testable with `pnpm demo:product`.

## Conversation

`@dogos/whatsapp` defines the provider-neutral `WhatsAppProvider` interface and
a local simulator adapter used only by automated tests. The adapter verifies HMAC webhook signatures,
deduplicates inbound message IDs, renders text, interactive, template, and media
messages, tracks delivery states, and retains resettable local history.

Meta Cloud and Twilio Sandbox adapters implement the same boundary. Meta is the
restricted real-phone pilot; neither provider changes canonical onboarding,
training, progress, or safety decisions.

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
- `/app/trainers` and `/app/referral/[id]`: the verified-network policy and
  professional handoff without invented people, availability, or prices.
- `/app/account`: authenticated household context, automatic language
  presentation, persisted tier, distribution controls, and billing access when
  configured.

Public sign-up, email confirmation, password recovery, JWT verification, and
atomic account bootstrap are implemented through Supabase Auth and PostgreSQL.
WhatsApp onboarding projects once into the durable household, dog, anamnesis,
goal, baseline, plan, plan-version, step, and schedule graph. Product pages and
session completion read and write that graph instead of the original pilot
fixture.

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

Stripe Checkout, Customer Portal, signed webhooks, and entitlement projection
are implemented but stay unavailable until a real catalog and secrets are
configured. A bounded OpenAI coaching adapter can rewrite deterministic drafts;
it has no tools and cannot change canonical plans or safety outcomes. The local
default remains deterministic.

Cal.com is intentionally optional: DogOS owns referral ranking, booking state,
attribution, and commission disclosure; Cal.com may later supply availability
and appointment operations. Video analysis and live coaching remain absent.
DPAs/privacy controls, professional protocol approval, legal/commercial
decisions, video retention policy, provider credentials, and verified trainer
supply remain release gates.
