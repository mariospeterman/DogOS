# Slice 2.2: Multilingual Database Foundation

- Status: implemented
- Date: 2026-07-15
- Scope: migrations, localization model, RLS, generated types, seed, database tests

## Delivered

- Local Supabase configuration with Postgres 17, `api` Data API exposure, Auth,
  deterministic migrations, and seed loading. Deferred local service processes,
  including Storage API, are disabled while their schema contracts remain.
- Canonical identity, household, dog, knowledge/protocol, goals/plans, evidence,
  evaluation, trainer/commerce, and future-media entities.
- BCP 47-shaped locale tags without a fixed allowlist. Locale, country, legal
  jurisdiction, timezone, and ISO currency remain separate columns.
- Version-bound localized content, question/protocol/legal localization links,
  message catalog entries, review records, and required translation states.
- Fail-closed release rules for safety, protocol, and legal presentation plus
  jurisdiction-matched consent validation.
- Forced RLS, explicit grants, expiring trainer case shares, private storage
  policies, immutable decision/version records, append-only audit/ledger data,
  and audited locale changes.
- German and English development fixtures, including paired canonical cases and
  a Swiss English user retaining `CH`, `CHF`, `Europe/Zurich`, and Swiss law.
- Generated TypeScript database types in `@dogos/database` and pgTAP schema,
  RLS, and multilingual tests.

## Schema deviations

The approved direction adds `conversation_sessions`, localization/review tables,
and locale fields that were absent from the Phase 1 logical table inventory.
`trainer_case_shares` is explicit because trainer RLS cannot be implemented from
bookings or referrals. `trainer_reviews` and `calendar_exports` retain entities
already required by the Phase 1 domain model. Protocol localizations point to an
exact protocol version, not the stable protocol identity, so presentation cannot
silently drift from reviewed canonical logic.

No locale allowlist was added. Initial fixtures cover `de-CH` and `en`; the
schema accepts future BCP 47 tags, including `de-DE` and `de-AT`, without a
migration. Development protocol and rule-set fixtures remain draft and
development-only.

## Test boundary

The paired German/English fixtures prove that persisted canonical anamnesis,
risk, goals, plans, measurements, progression, adjustments, escalation, and
analytics dimensions are language-independent. Slice 2.2 does not implement or
execute the deterministic engines; end-to-end engine equivalence belongs to the
next authorized implementation slice.

## Commands

```bash
pnpm dev:services
pnpm db:reset
pnpm seed
pnpm db:test
pnpm db:lint
pnpm db:types
pnpm typecheck
```

## Unresolved release gates

- Professional approval of all protocol and deterministic safety content.
- Legal approval for each launch jurisdiction and legal document version.
- Professional/legal release approval for safety-critical and protocol
  localizations in each launch locale.
- Production provider, backup, retention, residency, secret, and operational
  incident configuration. Local fixture credentials and content are not
  production assets.

Implementation follows the official Supabase guidance for
[local development](https://supabase.com/docs/guides/local-development/overview),
[migrations](https://supabase.com/docs/guides/local-development/declarative-database-schemas),
[seeding](https://supabase.com/docs/guides/local-development/seeding-your-database),
[database tests](https://supabase.com/docs/guides/local-development/testing/overview),
and [generated TypeScript types](https://supabase.com/docs/guides/api/rest/generating-types).
