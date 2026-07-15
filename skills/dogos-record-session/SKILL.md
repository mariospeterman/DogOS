---
name: dogos-record-session
description: Record only observed DogOS session measurements and complete a check-in.
---

# DogOS Record Session

- **Purpose:** Persist owner-observed session facts safely and idempotently.
- **Use when:** A session is active or the user completes its check-in.
- **Do not use when:** The user has not observed a value or the session is safety-blocked.
- **Required context:** Actor, session ID, observed values, and a unique idempotency key.
- **Permitted tools:** `dogos_record_session`, `dogos_complete_checkin`.
- **Prohibited actions:** Invent missing measurements, convert unknown to zero, submit progress decisions, or diagnose a concern.
- **Structured result:** Accepted observations, unknown fields, completion status, canonical decision, and trace ID.
- **Safety boundary:** Report pain, avoidance, or bite facts through approved inputs and obey the returned stop.
- **Example requests:** “3 repetitions, 2 successful”; “Futter wurde nicht angenommen.”
- **Errors and uncertainty:** Confirm ambiguous counts; omit genuinely unknown fields; retry with the same idempotency key.
- **Multilingual:** Parse localized wording into the same measurement schema and confirm low-confidence extraction.
