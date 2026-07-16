# Slice 2.7: Omnichannel Coach

- Status: implemented foundation
- Last reviewed: 2026-07-17

## Product decision

DogOS has one Coach exposed through the authenticated web app and WhatsApp.
WhatsApp remains the low-friction acquisition, reminder, and quick-response
channel. The web Coach supports durable history, longer explanations,
contextual plan questions, future video, and sensitive authenticated actions.

The web product is still a thin training layer. Its five primary destinations
are Coach, Today, Plan, Progress, and Account. Calendar is nested under Plan.

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
- web messages remain in DogOS unless the user explicitly chooses the WhatsApp
  handoff;
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
- Playwright verifies desktop/mobile navigation, Coach exchange, contextual
  handoff, explicit WhatsApp continuation, and PWA start behavior.
