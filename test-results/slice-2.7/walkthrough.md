# DogOS Slice 2.7 walkthrough

## Start

```bash
pnpm demo:product
```

Open [Today](http://127.0.0.1:3100/app/today). The installed PWA starts on the
same training-management surface. Local review uses `x-dogos-user: owner`;
preview and production require a Supabase bearer session.

## WhatsApp handoff

1. Confirm the primary tabs are Today, Plan, Progress, and Account.
2. Open Plan and select **Plan mit Coach besprechen**.
3. Confirm WhatsApp opens with a prefilled request for the complete plan.
4. Send the request from the linked pilot phone and confirm DogOS responds in
   the user's language.
5. Confirm `/app/coach` redirects to Today and does not render another chat.

## Navigation

The primary mobile navigation is Today, Plan, Progress, and Account. Calendar is
available inside Plan. There is no web WhatsApp simulator or second chat.

## Security checks

- viewer can read the timeline but cannot send;
- unrelated household access returns `ACCESS_DENIED`;
- repeated web idempotency keys and WhatsApp provider IDs append once;
- local and configured HTTPS origins work in development; production accepts
  only the configured web origin;
- web replies are not automatically delivered as WhatsApp notifications.

The deterministic engines remain authoritative. Optional LLM presentation uses
separate chat, plan, and professional-summary profiles. Video analysis,
LiveKit, proactive templates, and production protocol approval remain outside
this slice.
