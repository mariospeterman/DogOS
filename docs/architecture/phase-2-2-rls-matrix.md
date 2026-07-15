# Slice 2.2 RLS Matrix

- Status: implemented
- Reviewed: 2026-07-15

All `api` and `private` tables enable and force RLS. The `anon` role has no
application schema access. Authorization resolves from `auth.uid()` to
`api.users` and active `household_members`; editable JWT metadata is never an
authority. `private` has no authenticated table policies or grants.

| Surface                                              | Owner                           | Caregiver      | Viewer         | Explicit trainer                       | Server                       |
| ---------------------------------------------------- | ------------------------------- | -------------- | -------------- | -------------------------------------- | ---------------------------- |
| Own profile locale/context                           | read/update allowlisted columns | same           | same           | same                                   | full                         |
| Household and members                                | read                            | read           | read           | none                                   | full                         |
| Dog identity and non-sensitive history               | read/write                      | read/write     | read           | active dog share: read                 | full                         |
| Health, anamnesis, safety                            | read/write                      | read/write     | read           | active share with sensitive flag: read | full                         |
| Goals and owner measurements                         | read/write                      | read/write     | read           | active dog share: read                 | full                         |
| Plans, versions, schedules                           | read                            | read           | read           | active dog share: read                 | create/activate/update       |
| Sessions, context, measurements, check-ins           | read/write                      | read/write     | read           | active dog share: read                 | full                         |
| Progress, hypotheses, risk, adjustments              | read                            | read           | read           | active sensitive share: read           | create only through services |
| Approved reference/localized content                 | read                            | read           | read           | read                                   | govern/publish               |
| Consent evidence                                     | household read                  | household read | household read | none                                   | create/withdraw through API  |
| Referrals and bookings                               | household read                  | household read | household read | assigned trainer read                  | canonical writes             |
| Subscription and entitlements                        | household read                  | household read | household read | none                                   | canonical writes             |
| Media metadata/storage                               | household read; scoped upload   | same           | read           | metadata through share                 | full                         |
| Protocols, reviews, finance, provider events, audits | none                            | none           | none           | none                                   | full                         |

Trainer access is purpose-bound, dog-bound, expiring, revocable, and optionally
permits sensitive anamnesis. A signed identity-link token is not an RLS identity
and is never client-readable. Storage objects use `<household UUID>/...` keys,
private buckets, household policies, a matching `media_assets` record for reads,
and retention checks.

The `api.current_plan_summary` view uses `security_invoker = true`. Server-only
plan activation is transactional through `private.activate_plan_version`, which
supersedes the old active version, updates the plan pointer, and appends an audit
event.
