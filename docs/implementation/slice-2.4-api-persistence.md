# Slice 2.4: API, Persistence, and Signed Actions

## Status

Implemented locally. No hosted authentication, real provider, payment, booking,
or production deployment work is included.

## Persistence encoding

- `api.canonical_code` remains lowercase dotted storage for domain concepts.
- `api.reason_code` accepts stable uppercase underscore constants using
  `^[A-Z][A-Z0-9_]*$` and preserves engine reason codes unchanged.
- `api.measurement_source` uses `owner_report`, `trainer_report`, `system`, and
  `future_video`. The pre-production `user_report` value is migrated rather than
  retained as a permanent alias.
- Exhaustive bidirectional mappers translate database formatting to canonical
  safety dispositions, progress statuses, adjustment decisions, and referral
  dispositions. Unsupported values throw; no mapper defaults.

Canonical contracts never import database code. The boundary is database row to
persistence DTO to canonical engine contract.

## Transaction boundary

`PostgresRepository` runs decision writes in serializable transactions. It
resolves evidence before persistence, reserves an idempotency key, persists the
canonical decision, writes one audit event, and records the command response.
Plan activation locks the plan, checks the expected active version, creates one
immutable version, and atomically switches activation. Failed writes roll back
the decision and audit together.

The historical Slice 2.2 seed contains UUID-like development identifiers that
are valid in PostgreSQL but do not satisfy the canonical RFC UUID validator.
New decision fixtures use canonical version/variant UUIDs. No production data
exists and no compatibility weakening was added.

## API

Fastify route schemas generate OpenAPI 3.1 at `/openapi.json`. Public commands
cover household, dog, anamnesis, answers, safety, goal, plan generation,
session start/check-in/completion, progress evaluation, adjustment, referrals,
locale, and signed actions. Queries cover identity, household, dog, current
plan, calendar, progress, session, and referral.

Local requests use `x-dogos-user` with deterministic owner, caregiver, viewer,
shared trainer, and unrelated identities. Mutations require `idempotency-key`.
This adapter is local-only; production authentication remains fail-closed and
will use validated Supabase identities.

Clients submit observations and commands, never risk outcomes, plan decisions,
progress statuses, trainer ranks, or entitlements. Stable errors are sanitized
and include the request trace ID without SQL, stack, or rule internals.

## Signed actions

HS256 tokens contain only an opaque action ID plus standard JWT timing and nonce
claims. Purpose, household, subject, optional actor, revocation, consumption,
and token hash remain server-side. Verification checks every binding, expiry,
revocation, one-time replay, and key ID. Old keys remain valid during rotation.
Issue, verify, consume, and revoke events are auditable. Sensitive identity
linking additionally requires an authenticated owner.
