# Restricted Meta WhatsApp pilot

## Modes

- `simulator`: local provider and deterministic identities.
- `meta_test`: direct Meta Cloud API, PostgreSQL state, explicit phone allowlist, development account-link bootstrap.
- `production`: fails closed unless Supabase authentication and privacy approval are configured. Public production is outside this phase.

The adapter verifies `X-Hub-Signature-256` against the exact raw body using the Meta app secret, echoes the verification challenge only for a matching separate verify token, parses text/button/list events, deduplicates provider message IDs, tracks delivery states, and sends directly to `/{graph-version}/{phone-number-id}/messages`. Graph version is explicit configuration so an expired API version cannot change silently.

## Owner configuration gate

1. In Meta Business Manager, create or select a development business portfolio and a development Meta app.
2. Add the WhatsApp product and use the Meta test number or a dedicated pilot number. Do not import production contacts.
3. Add only the owner's test phone as a test recipient and place the digits-only WhatsApp ID in `WHATSAPP_TEST_ALLOWLIST`.
4. Generate a development/system-user token with only the WhatsApp permissions shown by the Meta setup screen. Store it as `WHATSAPP_ACCESS_TOKEN` in an uncommitted secret environment.
5. Record the Phone Number ID, App Secret, and currently supported Graph API version from the app dashboard.
6. Generate a separate random webhook verify token. Do not reuse the app secret or access token.
7. Expose `https://<pilot-host>/webhooks/whatsapp` through an owner-controlled HTTPS host. Configure that callback and verify token, then subscribe the WhatsApp Business Account `messages` field.
8. Set `WHATSAPP_MODE=meta_test`, the five credential variables, `WHATSAPP_PUBLIC_WEBHOOK_URL`, `WHATSAPP_ACCOUNT_LINK_URL`, and `DATABASE_URL`.
9. Run `pnpm whatsapp:verify-config`, then `pnpm whatsapp:run-pilot`.

Meta's developer documentation currently requires login in some regions. Payloads and direct-send contracts were cross-checked against Meta's official [WhatsApp Cloud API Postman collection](https://www.postman.com/meta/whatsapp-business-platform/overview) and [Meta-hosted interactive-message SDK reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/).

## Supabase gate

Create a separate development project, apply migrations, configure the web origin and exact account-link redirect, and use Supabase Auth for the owner. Server-side authorization must validate the access token with `getClaims()` or `getUser()` and then resolve active household membership; never trust client `user_metadata`. The service-role/secret key must never enter the browser. See the current [Supabase server-side authentication guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

The checked-in local account-link confirmation uses a deterministic owner header only in development. It is structurally rejected for production and must be replaced by verified Supabase actor context before a production-number pilot.
