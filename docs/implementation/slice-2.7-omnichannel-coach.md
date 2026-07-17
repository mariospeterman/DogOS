# Slice 2.7: Omnichannel Coach

- Status: implemented foundation
- Last reviewed: 2026-07-17

## Product decision

DogOS has one conversational Coach exposed through WhatsApp. The authenticated
web app is the durable management and training workspace for Today, Plan,
Calendar, Progress, Account, billing, and future live sessions. Contextual web
actions open WhatsApp with a prefilled question instead of creating a second
chat surface.

The web product is a thin training layer. Its four primary destinations are
Today, Plan, Progress, and Account. Calendar is nested under Plan.

## Data model

- `private.coach_conversations`: one canonical thread per household and dog;
- `private.coach_messages`: ordered content, role, origin channel, context, and
  trace;
- `private.coach_channel_bindings`: provider/web routing metadata only.

Partial unique indexes deduplicate real client and provider message IDs without
colliding on absent IDs. All tables are server-only with forced RLS and no
browser Data API policy.

## API

```text
GET  /v1/coach/conversation?dogId=:dogId
POST /v1/coach/messages
```

Both routes require authenticated household membership. Owner and caregiver
may send; viewer is read-only. Mutations require an idempotency key. The API
builds the compact current training context and returns a canonical timeline.

## Channel behavior

- linked inbound/outbound WhatsApp exchanges append to the same timeline;
- legacy `/app/coach` links redirect to Today;
- contextual actions explicitly hand off to WhatsApp;
- language is inferred from normal messages and changes presentation only;
- current deterministic post-plan replies are shared across channels;
- LLM selection, streaming, video analysis, and proactive templates remain
  later provider-gated work.

## Verification

- unit tests cover inference, acute advisory continuity, mixed-channel order,
  and retry deduplication;
- API tests cover authentication, role permissions, OpenAPI, and idempotency;
- PostgreSQL integration proves one web/WhatsApp timeline and two bindings;
- pgTAP verifies the server-only schema and constraints;
- Playwright verifies desktop/mobile navigation, removal of the duplicate web
  chat, contextual WhatsApp handoff, and Today-first PWA behavior.
