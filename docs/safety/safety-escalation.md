# Safety and Escalation

- Status: proposed, professional review required
- Last reviewed: 2026-07-14

This document defines product behavior, not veterinary advice. Every threshold
and user-facing message must be reviewed by qualified DACH professionals before
production. Until then the entire matrix is `pending_professional_review`.

## 1. Safety invariants

1. Safety rules run before protocol selection and after every check-in.
2. A high-risk or unsupported case cannot be rescued by an LLM response.
3. The system distinguishes observation, user report, hypothesis, and diagnosis.
4. Medical diagnosis is always excluded; suspected pain/illness routes to a vet.
5. Missing safety information blocks progression when that information is
   required by the protocol.
6. A stop or escalation decision is never weakened by subscription entitlement.
7. Trainer ranking uses suitability before availability, price, or commission.
8. Every decision is explainable from rule IDs and evidence IDs.
9. A hold applies to the affected autonomous exercise or progression, not to
   account access, conversation, records, referrals, or reporting a new fact.
10. A disclaimer explains limits but never substitutes for a safe product
    action.

## 2. Dispositions

| Disposition          | Product action                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `continue_low_risk`  | Continue the approved step at unchanged difficulty.                                            |
| `pause_and_question` | Pause and collect specific missing safety/context data.                                        |
| `regress_or_manage`  | Reduce difficulty or use an approved management step.                                          |
| `trainer_review`     | Hold autonomous progression; keep chat and records available and offer a qualified trainer.    |
| `veterinary_review`  | Hold the affected exercise; keep chat and records available and suggest veterinary assessment. |
| `urgent_local_help`  | Show a jurisdiction-reviewed urgent safety message; do not provide remote treatment.           |
| `unsupported`        | Explain that DogOS has no approved protocol for the case.                                      |

## 3. Draft escalation matrix

| Signal                                                                                               | Draft severity | Immediate engine action                                                   | Route                                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Suspected pain, illness, medication concern, sudden unexplained behavior change                      | High           | Stop affected exercise; do not interpret cause                            | Veterinary review                                                             |
| Bite with injury, repeated bites, escalating snaps, uncontrolled aggression risk                     | High           | Stop training instructions; apply only approved immediate management copy | Qualified behavior professional; urgent local help when current danger exists |
| Child or vulnerable-person safety risk                                                               | High           | Stop exercise; prevent exposure through approved safety copy              | Professional review; urgent local help if immediate                           |
| Owner cannot create distance/control environment                                                     | High           | Stop current exercise                                                     | Trainer review                                                                |
| Dog cannot recover, repeatedly attempts escape, or stops accepting food under protocol stop criteria | Medium/high    | End session; regress only if protocol explicitly permits                  | Trainer review when repeated or severe                                        |
| Owner reports fear, frustration, or loss of control                                                  | Medium         | Pause; offer rest and simpler approved step                               | Trainer review if persistent                                                  |
| Missing bite/pain/safety history                                                                     | Unknown        | Do not generate eligible plan                                             | Ask required questions                                                        |
| No approved protocol matches                                                                         | Unsupported    | No autonomous plan                                                        | Professional referral                                                         |
| Low data quality without safety signal                                                               | Low/unknown    | Repeat measurement; no progression                                        | Continue data collection                                                      |

The matrix intentionally avoids exact injury/severity thresholds until reviewers
define jurisdiction-appropriate language and triage procedures.

## 4. Rule execution order

```text
hard stop -> veterinary exclusion -> human/animal safety exclusion
-> protocol exclusion -> missing required information -> session stop/regression
-> success/progression -> entitlement/display decisions
```

A later rule cannot override an earlier disposition. Conflicting rules choose the
safer outcome and create a review event.

## 5. Explainable risk assessment

```json
{
  "risk_level": "high",
  "disposition": "veterinary_review",
  "triggered_rules": ["SUDDEN_CHANGE_001", "SUSPECTED_PAIN_001"],
  "evidence": [
    {
      "type": "owner_report",
      "field": "sudden_behavior_change",
      "value": true
    },
    { "type": "owner_report", "field": "pain_suspected", "value": true }
  ],
  "excluded_actions": ["generate_training_plan", "increase_difficulty"],
  "content_status": "pending_professional_review"
}
```

The German explanation must say what DogOS observed/reported, what it cannot
determine, what action was stopped, and what kind of professional help is
appropriate. It must not name a condition.

The explanation is event-triggered and concise. Routine low-risk sessions do
not repeat generic injury, equipment, or emergency warnings. After escalation,
the user can still open history, report an update, manage the account, and
request a trainer. A new autonomous exercise requires a new qualifying
assessment; the workflow must never become a terminal chat state.

## 6. Privacy and AI safety

- Disclose AI interaction clearly before AI-generated conversational text.
- Keep safety and plan decisions deterministic even when AI extracts intake.
- Validate extracted values against the user's original answer and ask for
  confirmation when a safety-sensitive value is ambiguous.
- Record model, prompt, schema, input references, output, and whether it was used.
- Do not send raw full histories or media to providers unless needed, consented,
  and allowed by current provider data controls/DPA.
- Do not use customer media for model training or debugging without separate,
  specific opt-in.
- Children and bystanders trigger capture guidance, minimization, and deletion
  controls; no facial recognition or identity inference.

## 7. Launch gates

Production remains blocked until:

- named qualified trainer/behavior reviewers approve each production protocol;
- a veterinary reviewer approves medical/pain boundaries and wording;
- DACH legal review covers consumer claims, animal-welfare restrictions, GDPR,
  Swiss FADP, AI disclosure, consent, and emergency language;
- safety-rule tests demonstrate no prohibited autonomous progression;
- red-team scenarios cover prompt injection, ambiguous user input, missing data,
  entitlement failure, stale protocols, and provider outage;
- escalation availability and fallback contact wording exist per launch country.

## Related documents

- [Knowledge governance](../knowledge/governance.md)
- [Domain model](../architecture/domain-model.md)
- [Testing and approval](../testing/phase-1-approval.md)
