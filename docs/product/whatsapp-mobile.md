# WhatsApp, Mobile, and Referral Flows

- Status: implemented foundation
- Last reviewed: 2026-07-17

WhatsApp is the conversational Coach for discovery, onboarding, instructions,
questions, reminders, and check-ins. The authenticated web app is the thin
management layer for durable plans, history, sessions, progress, billing,
professional appointments, and future live coaching. The user should
experience one product without a duplicate web chat.

Web messages are never mirrored to WhatsApp by default. The user explicitly
chooses `In WhatsApp fortsetzen`; notification delivery remains a separate,
consented concern.

## 1. Conversation state machine

```text
new_contact
-> ai_disclosure
-> provisional_profile
-> safety_screen
-> identity_link_required
-> authenticated_anamnesis
-> goal_definition
-> baseline_collection
-> plan_pending
-> daily_training
-> checkin_pending
-> progress_summary
-> next_session | paused | professional_referral
```

Transitions are explicit and persisted. Incoming messages are deduplicated by
provider message ID. Unknown or out-of-order input receives a recoverable prompt;
it never advances the plan implicitly.

## 2. Onboarding flow

1. User initiates the WhatsApp conversation.
2. DogOS identifies itself as an AI-assisted service and states its limits.
3. DogOS asks a small set of non-sensitive routing questions using buttons/lists.
4. Immediate safety answers can stop the autonomous path and offer escalation.
5. DogOS sends a short-lived signed account-link URL.
6. The web page verifies/requires a Supabase session and explicit account linking.
7. The user accepts versioned privacy/terms/AI disclosures.
8. Short questions continue in WhatsApp; sensitive or long anamnesis opens a
   signed, single-purpose page.
9. DogOS summarizes structured answers and asks the user to correct them.
10. The engine selects one measurable goal and requests a baseline.
11. If an approved protocol is eligible, the engine creates a versioned plan;
    otherwise it returns an unsupported/professional route.

### Chat versus web decision

| Input                                                      | Surface                                             |
| ---------------------------------------------------------- | --------------------------------------------------- |
| One choice, yes/no, short scale, daily check-in            | WhatsApp button/list/text                           |
| Voice note                                                 | WhatsApp, with explicit transcription state/consent |
| Medication, bite history, household/children, long history | Authenticated signed page                           |
| Consent, export, deletion, account linking                 | Authenticated signed page                           |
| Payment and subscription management                        | Stripe-hosted or authenticated signed page          |
| Full plan, progress chart, calendar, booking               | Signed mobile page; explanation remains in WhatsApp |

## 3. Shared Coach timeline

```text
private.coach_conversations (system of record)
  -> private.coach_messages (ordered user/assistant timeline)
  -> private.coach_channel_bindings (web and WhatsApp routing only)
```

Provider message IDs deduplicate WhatsApp delivery. Each message retains its
channel of origin, context kind, trace, and optional subject without making
provider state authoritative. The server-side timeline supports audit and
future professional handover; it is not rendered as another owner chat.

## 4. Daily loop

```text
optional utility reminder -> user replies "Start"
-> service window -> today's approved exercise summary
-> safety/context check -> session starts
-> user reports completion and measurements
-> deterministic evaluation and adjustment
-> concise German explanation + next scheduled action
```

Reminder frequency is user-controlled. Messages are grouped to reduce cost and
notification fatigue. The 24-hour customer-service window and current WhatsApp
message-category rules are treated as provider policy, not hard-coded forever.

## 5. Mobile pages

| Route                   | Purpose                                               | Key states                                             |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `/app/coach`            | Legacy redirect to Today                              | redirect                                               |
| `/app/today`            | Current step, timer, instructions, start/stop         | loading, unavailable, safety stop, active, completed   |
| `/app/plan`             | Frozen plan version and rationale                     | active, superseded, paused, pending review             |
| `/app/calendar`         | Sessions, recovery, reviews, reschedule, `.ics`       | empty, scheduled, changed, export revoked              |
| `/app/progress`         | Per-dimension progress and confidence                 | insufficient data, stable, improving, regressing       |
| `/app/session/:id`      | Session evidence and correction                       | planned, in progress, submitted, evaluated             |
| `/app/video/:id`        | Future media status/manual review                     | consent missing, uploaded, retained, deleted, reviewed |
| `/app/trainers`         | Suitability-ranked professional options               | no coverage, remote only, available                    |
| `/app/book/:referralId` | Referral context and slots                            | invalid/expired, available, booked                     |
| `/app/account`          | Profile, locale, subscription, consent, export/delete | authenticated only                                     |

Links contain opaque, hashed-on-server, short-lived, purpose-bound tokens with a
nonce. They are single-use for sensitive mutations, revocable, and never include
dog, health, referral, or account data in the URL.

Calendar is a subview of Plan in primary navigation, not a separate product
area.

## 6. Calendar behavior

- Show planned sessions, duration, focus, recovery days, future video review
  placeholders, weekly review, and changed/cancelled states.
- Rescheduling updates a schedule version and preserves the old audit record.
- `.ics` exports use revocable tokenized feeds or one-time files. Calendar text
  contains minimal sensitive detail.
- Timezone comes from household preference and is stored with each scheduled
  occurrence to make daylight-saving changes explicit.

## 7. Progress presentation

Do not show one universal score. Show separate cards/rows for:

- goal attainment and current difficulty;
- consistency and completed sessions;
- success rate where measurement quality permits;
- distance, duration, or response-time trends relevant to the goal;
- engagement/recovery indicators;
- handler confidence/implementation;
- missing data and overall evaluation confidence.

Every adjustment links to the evidence used and states what was missing.

## 8. Trainer referral and booking

### Ranking policy

```text
eligibility and specialization
-> risk competence
-> local/remote coverage
-> automatic language adaptation from the conversation
-> availability
-> user price range
-> quality/outcome data when valid
```

Commission is absent from ranking inputs. The ranking result stores factor values
and exclusion reasons for auditability.

### Booking flow

```text
engine creates referral reason
-> user sees disclosure and suitable trainers
-> server creates signed referral token
-> API requests Cal.com v2 availability
-> user selects slot
-> API creates booking with opaque referral metadata
-> Cal.com webhook is signature-verified and deduplicated
-> canonical booking/referral state updates
-> completion/cancellation/no-show/refund events append ledger entries
```

The current Cal.com API requires an explicit `cal-api-version` header. The Phase
2 adapter pins and contract-tests that version rather than scattering it through
the application.

### Referral state

```text
recommended -> viewed -> booking_started -> booked -> completed
                                  |             |-> cancelled
                                  |             |-> no_show
                                  |             |-> refunded
                                  |-> expired
```

## 9. Marketing-ready public surface

The same Next.js app includes public, indexable German pages for product value,
how the deterministic process works, safety/limitations, trainer collaboration,
pricing, FAQ, contact, legal notice, privacy, and consent explanations. Marketing
claims must match approved capabilities. Video and live coaching are described
as future/beta only after evidence supports them.

## 10. Acceptance scenarios

- A new German user completes intake using buttons plus one sensitive signed page.
- An expired/replayed link fails safely and offers a fresh link without data loss.
- A user with an unknown/mixed breed completes the full flow.
- A high-risk answer stops plan generation before any LLM explanation.
- A user completes three sessions and sees evidence-based progress dimensions.
- A user with insufficient data sees `not enough data`, not a fabricated score.
- A Swiss household sees CHF and `de-CH` formatting without different training logic.
- A referral survives duplicate/out-of-order Cal.com webhooks without duplicate
  commission entries.

## Related documents

- [Architecture](../architecture/phase-1.md)
- [Worked plan](worked-plan.md)
- [Safety](../safety/safety-escalation.md)
