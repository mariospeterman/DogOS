# Slice 2.6: Authenticated WhatsApp Training Vertical

- Status: in progress, first implementation increment complete
- Last reviewed: 2026-07-16

## Product boundary

WhatsApp is the coaching and explanation surface. The web app is a thin control
and evidence layer for dog profile, plan, schedule, session capture, milestones,
account, entitlement, billing, and professional referrals. It is not a second
chat product.

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

The explicit state machine is persisted in
`private.whatsapp_conversation_sessions`. The orchestrator supports restart,
language switching, bounded deterministic free text, Meta reply buttons,
duplicate delivery protection, and a daily entitlement counter.

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

No LLM is authoritative in this increment. A future model receives a compact
context capsule containing only:

```text
intent + active dog facts needed for this turn + current canonical plan step
+ recent bounded observations + allowed tools + locale + presentation style
```

It does not receive the whole account, the entire conversation, internal rule
definitions, unrelated personal data, or entitlement secrets. Candidate facts
are schema validated and confirmed where ambiguity matters. Engines compute
risk, eligibility, plan, progression, and referral disposition.

## Acceptance completed

- hosted Supabase owner authentication resolves the seeded app user and active
  household membership;
- explicit account-link confirmation sends a bearer token instead of
  `x-dogos-user`;
- WhatsApp state and message limits persist in PostgreSQL;
- German/English switching preserves CH, CHF, Europe/Zurich, answers, and state;
- prompt-injection and unrelated topic attempts remain out of scope;
- high-risk handling remains recoverable rather than terminal;
- the 390 x 844 Today, Plan, and Session views have been browser-reviewed.

## Still required

- replace the in-memory product service with the completed repository layer in
  every route;
- exercise the full onboarding sequence on the real Meta test phone;
- add real entitlement lookup instead of the default freemium capability;
- implement professionally reviewed anamnesis content and protocol versions;
- run the provider model evaluation before selecting a production LLM;
- obtain veterinary, trainer, privacy, and legal approval for release wording.
