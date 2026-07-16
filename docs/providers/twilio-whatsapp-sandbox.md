# Twilio WhatsApp Sandbox Setup

Status: development pilot only. The Twilio Sandbox must not be used as a
production WhatsApp sender.

DogOS implements Twilio behind the existing `WhatsAppProvider` boundary. Twilio
form fields and delivery states terminate in the adapter; deterministic
conversation, training, safety, plan, and progress logic is unchanged.

## Prerequisites

1. Create or use a Twilio account and open **Messaging > Try it out > Send a
   WhatsApp message** in the Twilio Console.
2. Activate the Sandbox. Each test phone must send the displayed `join <code>`
   message to `+1 415 523 8886` before it can receive Sandbox messages.
3. Expose the local API through an owner-controlled public HTTPS tunnel. Keep
   the same hostname for the full test because Twilio signs the exact callback
   URL.
4. Add only joined test contacts to `TWILIO_ALLOWED_TEST_NUMBERS` using complete
   channel addresses such as `whatsapp:+41790000000`.

## Configuration

Put secrets in `.env.local`, never in browser variables or committed files:

```env
WHATSAPP_MODE=twilio_sandbox

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

TWILIO_INBOUND_WEBHOOK_URL=https://your-host.example/webhooks/whatsapp/twilio
TWILIO_STATUS_CALLBACK_URL=https://your-host.example/webhooks/whatsapp/twilio/status
TWILIO_ALLOWED_TEST_NUMBERS=whatsapp:+41790000000

WHATSAPP_ACCOUNT_LINK_URL=https://your-web-host.example/app/account/link
DATABASE_URL=postgresql://...
```

Configure the Sandbox **When a message comes in** field as an HTTP `POST` to
`TWILIO_INBOUND_WEBHOOK_URL`. DogOS passes `TWILIO_STATUS_CALLBACK_URL` on every
outbound Message API request, so delivery, failure, and read events return to the
status route.

Validate configuration without printing credentials:

```bash
pnpm whatsapp:verify-config
```

Start the restricted pilot API:

```bash
pnpm whatsapp:run-pilot
```

## Security and behavior

- Both endpoints require `X-Twilio-Signature` and validate it with Twilio's
  official Node SDK against the configured public URL and every form field.
- Host and forwarding headers are not trusted for signature reconstruction.
- Only allowlisted Sandbox contacts are normalized or sent messages.
- Twilio `MessageSid` values are claimed atomically in the state store and
  deduplicated again by PostgreSQL constraints, so retries do not duplicate
  commands or delivery events. Parsing remains stateless so a failed transaction
  can be retried safely.
- The adapter stores normalized message content, bounded to the existing seven-
  day retention. It does not retain raw webhook payloads or media URLs.
- Sandbox interactive replies use a numbered text fallback. Production
  templates are intentionally unsupported in this adapter.
- Twilio failures are reduced to stable DogOS error codes. Provider messages,
  credentials, and stack traces are not returned to webhook callers.

## Verification

```bash
pnpm exec vitest run --config vitest.config.ts \
  packages/whatsapp/src/twilio.test.ts \
  apps/api/src/twilio-whatsapp-webhook.test.ts
pnpm db:test
```

For a real-device check, send `hello` from a joined allowlisted number. Expect a
DogOS development disclosure and one-time account-link URL. Repeat the same
webhook from Twilio's debugger and confirm no second outbound message is created.
Then send a message and confirm the status callback advances from queued/sent to
delivered or read.

## Official references

- [Twilio WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox)
- [Twilio WhatsApp quickstart](https://www.twilio.com/docs/whatsapp/quickstart)
- [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio Message resource](https://www.twilio.com/docs/messaging/api/message-resource)
- [Twilio outbound status callbacks](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status)
