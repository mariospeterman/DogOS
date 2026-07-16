# DogOS Slice 2.7 walkthrough

## Start

```bash
pnpm demo:product
```

Open [Coach](http://127.0.0.1:3000/app/coach). The installed PWA now starts on
the same Coach surface. Local review uses `x-dogos-user: owner`; preview and
production require a Supabase bearer session.

## Shared conversation

1. Ask **Warum dieser Block?** in the web Coach.
2. Confirm the answer uses Milo, the active loose-leash goal, and the current
   low-distraction stage.
3. Open **In WhatsApp fortsetzen**. The text is prefilled but is sent only after
   the user acts in WhatsApp.
4. Send a message from the linked pilot phone. Reload the web Coach and confirm
   the message and response appear with a WhatsApp origin label.
5. Open Today, Plan, or Progress and use the contextual Coach action. Confirm the
   relevant context chip is visible and previous messages remain unchanged.

## Navigation

The primary mobile navigation is Coach, Today, Plan, Progress, and Account.
Calendar is available as the Calendar tab inside Plan. There is no web WhatsApp
simulator and no second assistant history.

## Security checks

- viewer can read the timeline but cannot send;
- unrelated household access returns `ACCESS_DENIED`;
- repeated web idempotency keys and WhatsApp provider IDs append once;
- local and configured HTTPS origins work in development; production accepts
  only the configured web origin;
- web replies are not automatically delivered as WhatsApp notifications.

## Evidence

- `screenshots/coach-chromium.png`
- `screenshots/coach-mobile-chromium.png`

The Coach is deterministic development behavior. Production LLM selection,
streaming, video analysis, LiveKit, proactive WhatsApp templates, billing, and
production protocol approval remain outside this slice.
