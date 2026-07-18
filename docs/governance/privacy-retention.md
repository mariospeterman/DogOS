# Privacy Export, Deletion, and Retention

Status: implemented product controls, 2026-07-18.

DogOS provides an owner-only privacy export from `/v1/privacy/export`. The
export describes account scope, dog profile scope, coach conversations, plans,
sessions, video analyses, live sessions, billing projection, deletion requests,
and retention categories.

Deletion is an auditable request created through
`/v1/privacy/deletion-requests`. The request does not immediately destroy data
inside the interactive web request. A worker or operator can process the request
against legal holds, billing retention, media storage deletion, conversation
erasure or anonymization, and telemetry that does not duplicate conversation
content.

Retention categories:

- Account, dog profile, conversations, plans, sessions, videos, and live-session
  summaries: queued for erasure or anonymization after request approval.
- Billing projection and transaction records: retained for legal, tax, and
  dispute windows.
- Model run telemetry: retained without raw conversation content for safety,
  abuse, and quality monitoring.
- Storage objects: queued for object deletion after request approval.
