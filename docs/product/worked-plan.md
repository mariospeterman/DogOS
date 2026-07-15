# Worked Training Plan Examples

- Status: development example only
- Professional approval: not reviewed
- Production use: prohibited
- Last reviewed: 2026-07-14

These examples demonstrate data flow and explainability. They are not dog-
training instructions and cannot be enabled in production until reviewed and
approved under the governance process.

## 1. Example case

```json
{
  "dog": {
    "age_months": 26,
    "sex": "female",
    "neutered": true,
    "breed_status": "mixed",
    "weight_kg": 18,
    "health_context": {
      "pain_suspected": false,
      "sudden_behavior_change": false,
      "medications": []
    }
  },
  "household": {
    "country": "DE",
    "locale": "de-DE",
    "available_training_minutes_per_day": 8,
    "children_present": false,
    "other_animals": []
  },
  "concern": {
    "type": "loose_leash_walking",
    "context": "quiet_street",
    "frequency": "most_walks",
    "known_bite_or_snap_events": false
  },
  "handler": {
    "experience": "beginner",
    "confidence": 2,
    "preferred_reinforcer": "food"
  }
}
```

All values above are `owner_report`; none are independently measured facts.

## 2. Measurable goal

```json
{
  "goal_type": "loose_leash_walking",
  "baseline": {
    "metric": "continuous_loose_steps",
    "value": 4,
    "unit": "count",
    "method": "owner_counted",
    "environment": "quiet_street",
    "distraction_level": 1,
    "quality": "moderate"
  },
  "target": {
    "continuous_loose_steps": 30,
    "success_rate": 0.8,
    "consecutive_sessions": 3,
    "environment": "quiet_street",
    "distraction_level": 1
  },
  "horizon_days": 28,
  "stop_conditions": ["suspected_pain", "uncontrolled_environment"],
  "escalation_conditions": ["bite_or_snap", "sudden_behavior_change"]
}
```

The horizon is a product assumption in this example, not a promised outcome.

## 3. Development protocol

```yaml
protocol_id: loose_leash_foundations
version: 0.1.0-dev
status: approved_development
professional_review: pending
risk_class: low
goal_type: loose_leash_walking

eligibility:
  required:
    - pain_suspected == false
    - handler_can_create_distance == true
    - environment_controlled == true
  excluded:
    - sudden_behavior_change == true
    - bite_or_snap_history_requires_review == true

baseline:
  metric: continuous_loose_steps
  method: owner_counted
  environment: quiet_street

difficulty_parameters:
  distraction_level: { min: 0, max: 3, initial: 1 }
  target_steps: { min: 4, max: 30, initial: 6 }
  session_minutes: { min: 2, max: 5, initial: 3 }

progression:
  when:
    consecutive_sessions: 3
    success_rate_gte: 0.8
    food_acceptance: true
    stop_signal_count: 0
  action:
    change_one_parameter_only: true
    target_steps_increment: 2

regression:
  when_any:
    - success_rate_lt: 0.5
    - food_acceptance: false
    - owner_confidence_lte: 1
  action:
    reduce_target_steps_percent: 25
    do_not_increase_distraction: true

stop_and_escalate:
  - suspected_pain
  - sudden_behavior_change
  - bite_or_snap
  - owner_cannot_control_environment
```

The thresholds are engineering examples only and require professional approval.

## 4. Generated plan version 1

| Day | Step                  | Duration | Difficulty                       | Measurement                             | Purpose                           |
| --- | --------------------- | -------: | -------------------------------- | --------------------------------------- | --------------------------------- |
| 1   | Baseline confirmation |    3 min | quiet street, distraction 1      | loose steps, attempts, food, confidence | Confirm starting value            |
| 2   | Foundation step A     |    3 min | target 6 steps                   | attempts/successes, food, confidence    | Establish repeatable setup        |
| 3   | Recovery              |     none | none                             | optional wellbeing check                | Avoid unnecessary load            |
| 4   | Foundation step A     |    3 min | same                             | same                                    | Obtain comparable session         |
| 5   | Foundation step A     |    3 min | same                             | same                                    | Reach progression evidence window |
| 6   | Flexible/rest         |  <=3 min | engine-selected after evaluation | same                                    | Preserve feasibility              |
| 7   | Weekly review         |     none | none                             | completeness and confidence             | Explain progress/next version     |

The user-facing German explanation is generated only from this approved
structure. It cannot add a technique, tool, correction, or higher difficulty.

## 5. Three recorded sessions

| Metric                      | Session 1 | Session 2 | Session 3 |
| --------------------------- | --------: | --------: | --------: |
| Attempts                    |        10 |        10 |        10 |
| Successful repetitions      |         5 |         7 |         8 |
| Success rate                |      0.50 |      0.70 |      0.80 |
| Longest loose-step sequence |         6 |         8 |        10 |
| Food accepted               |       yes |       yes |       yes |
| Distraction level           |         1 |         1 |         1 |
| Handler confidence (1-5)    |         2 |         3 |         3 |
| Response latency            |   unknown |   unknown |   unknown |
| Stop signal                 |      none |      none |      none |

## 6. Plan adjustment after three sessions

```json
{
  "evaluation": "improving",
  "confidence": "moderate",
  "evidence": [
    "success rate increased from 0.50 to 0.80",
    "longest measured sequence increased from 6 to 10 steps",
    "food was accepted in all three sessions",
    "difficulty and environment remained unchanged"
  ],
  "missing": ["response_latency"],
  "decision": "repeat_step",
  "reason_codes": [
    "SUCCESS_THRESHOLD_MET_ONCE",
    "CONSECUTIVE_THRESHOLD_NOT_MET"
  ],
  "plan_change": {
    "new_plan_version": "2",
    "difficulty_change": null,
    "next_sessions_at_same_difficulty": 2
  }
}
```

Transparent German output:

> Die Erfolgsrate stieg in drei vergleichbaren Einheiten von 50 auf 80 Prozent.
> Das Ziel verlangt jedoch drei Einheiten in Folge mit mindestens 80 Prozent.
> Deshalb bleibt die Schwierigkeit zunächst gleich. Die Reaktionszeit wurde nicht
> gemessen und floss nicht in die Bewertung ein.

No LLM judgment is needed to choose the action. An LLM may localize and shorten
the already approved explanation while preserving reason codes and numbers.

## 7. Correlation observation

Assume eight later sessions contain four `less_sleep_than_usual` reports. Three
of those four have a lower success rate than the dog's rolling median, compared
with one of four sessions after normal sleep.

```json
{
  "type": "descriptive_association",
  "variables": ["sleep_report", "session_success_rate"],
  "sample_size": 8,
  "subgroup_counts": { "less_sleep": 4, "usual_sleep": 4 },
  "status": "display_with_strong_caveat",
  "confidence": "low",
  "causal_claim_allowed": false,
  "message_key": "correlation.sleep_and_difficulty.low_confidence"
}
```

German output:

> In deinen bisherigen Daten waren Einheiten nach weniger Schlaf häufiger
> schwierig. Es gibt erst acht vergleichbare Einheiten. Das ist ein beobachteter
> Zusammenhang und kein Beweis, dass weniger Schlaf die Ursache war.

The minimum display sample, comparison method, and confidence thresholds remain
product assumptions until statistical and professional review. No correlation
changes a plan directly; it can trigger a question or reviewer-visible insight.

## 8. Failure examples

- If `pain_suspected` becomes true, the engine stops the relevant plan and emits
  `veterinary_review`; the positive trend does not override the stop rule.
- If Session 3 has no measurements, the engine records insufficient evidence and
  does not count it as failure or success.
- If the protocol review expires, no new plan may use it; existing-plan handling
  follows an explicit safety migration decision.
- If the text provider is unavailable, the canonical plan/evaluation remains
  valid and a deterministic localized fallback message is shown.

## Related documents

- [Domain model](../architecture/domain-model.md)
- [Knowledge governance](../knowledge/governance.md)
- [Safety](../safety/safety-escalation.md)
