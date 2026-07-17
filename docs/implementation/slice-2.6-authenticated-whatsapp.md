# Slice 2.6: Authenticated WhatsApp Training Vertical

- Status: in progress, natural onboarding increment complete
- Last reviewed: 2026-07-17

## Product boundary

WhatsApp is the primary conversational Coach. The web app remains a thin
control and evidence layer for dog
profile, plan, schedule, session capture, milestones, account, entitlement,
billing, and professional referrals. Web coaching actions hand back to the same
WhatsApp conversation instead of creating a competing owner chat.

The normal path contains one compact training block, an outcome target, a start
control, and a WhatsApp handoff. Generic equipment prerequisites and pre-emptive
stop lists are absent from low-risk sessions. Event-triggered escalation copy
appears only after the owner reports a relevant fact.

## Authentication

```text
Supabase session -> bearer access token -> Supabase Auth /user validation
-> api.users lookup -> active household membership -> actor context
```

The API does not trust user metadata, browser-submitted roles, household IDs, or
the WhatsApp contact alone. Preview and production require Supabase mode. Local
development may use hybrid mode so existing deterministic role tests coexist
with real hosted Supabase account-link tests. Production cannot enable hybrid or
development authentication.

## WhatsApp orchestration

The explicit state machine and canonical answers are persisted in
`private.whatsapp_conversation_sessions`. The orchestrator supports restart,
automatic language adaptation, Meta reply buttons, duplicate delivery
protection, and a daily entitlement counter. A schema-constrained model can
extract several explicitly stated onboarding facts from one natural message.
The state machine validates and records those facts, then asks only for the
first missing item. On model timeout, refusal, or invalid output, the
state-specific deterministic parser remains available. There is no language
selector: language follows each inbound message, while ambiguous text and
provider choice IDs preserve the active presentation locale.

The conversation stays focused on dog training, observations, plan, and
progress. Obvious prompt-injection and unrelated requests receive one short
scope reminder. This is enforced in application code rather than a long system
prompt.

Acute physical change or a child-involved bite holds the affected autonomous
exercise and progression. It does not disable chat, plan history, account
management, new observation reporting, or trainer/veterinary referral access.

## Tier capability envelope

`freemium`, `plus`, `pro`, and `ultra` are canonical product tiers. Limits are
server-side capabilities, never prompt instructions. The initial table covers
daily coaching messages, dog count, plan adjustments, asynchronous video
analysis, and future live-coaching minutes. Stripe remains deferred; no client
may claim a higher tier directly.

## LLM boundary

No LLM is authoritative. The onboarding model performs strict structured fact
extraction and writes a short, specific acknowledgement. It cannot directly
write database rows or choose risk, protocol, plan, progression, entitlement,
or referral outcomes. The state machine and domain services accept only the
supported canonical values.

The plan writer receives a compact context capsule containing only:

```text
intent + relevant persisted dog/profile facts + owner goal wording
+ current canonical plan step + milestone + bounded measurements + locale
```

It does not receive the whole account, the entire conversation, internal rule
definitions, unrelated personal data, or entitlement secrets. OpenAI requests
use `store: false`, regional routing is configurable, and purpose-specific
timeouts and token budgets prevent a routine chat limit from truncating a full
plan. Plan output may explain but cannot modify computed steps or milestones.
Generic professional-referral endings are prohibited for low-risk plans.

## Acceptance completed

- hosted Supabase owner authentication resolves the seeded app user and active
  household membership;
- explicit account-link confirmation sends a bearer token instead of
  `x-dogos-user`;
- WhatsApp state and message limits persist in PostgreSQL;
- German/English is inferred without a selector and switching preserves CH,
  CHF, Europe/Zurich, answers, and state;
- prompt-injection and unrelated topic attempts remain out of scope;
- high-risk handling remains recoverable rather than terminal;
- one natural message can capture multiple explicit dog and goal facts;
- onboarding projects the owner wording and dog profile into durable records;
- generated plans receive dog context, canonical steps, and milestone data;
- a free user sees one non-blocking Plus comparison after the first plan;
- the 390 x 844 Today, Plan, and Session views have been browser-reviewed.

## Still required

- exercise the full onboarding sequence on the real Meta test phone;
- implement professionally reviewed anamnesis content and protocol versions;
- run blind model evaluation before enabling model-generated presentation in
  production;
- obtain veterinary, trainer, privacy, and legal approval for release wording.
