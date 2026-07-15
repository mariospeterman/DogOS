# Restricted WhatsApp pilot walkthrough

## Automated contract mode

1. Run `pnpm demo:product`.
2. Run `pnpm demo:agent-tools` and `pnpm demo:mcp`.
3. Run `WHATSAPP_MODE=simulator pnpm whatsapp:verify-config`.
4. Run unit, integration, E2E, pgTAP, lint, types, and build gates.

The automated adapter tests cover verification, invalid signatures, text, buttons, deduplication, outbound messages, rate limits, one-time account linking, unauthorized pre-link access, unlinking, and delivery-state persistence contracts.

## Real Meta test-number gate

Complete `docs/providers/meta-whatsapp-pilot.md`, then run `pnpm whatsapp:run-pilot`. Send “hello” from the single allowlisted phone. Confirm the AI disclosure, open and confirm the one-time account link while authenticated, and send another message. Existing household data must be unavailable before linking. Retry the same webhook and confirm one inbound event. Open the signed mobile plan link, complete one check-in, request progress, trigger a pain case, and confirm training remains blocked.

This real-message section is intentionally pending until the owner supplies Meta development credentials, an HTTPS callback, and a development Supabase project.
