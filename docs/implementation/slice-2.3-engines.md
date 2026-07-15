# Slice 2.3: Canonical Contracts and Deterministic Engines

## Status

Slice 2.3 implements the in-memory decision chain approved after Slice 2.2:

```text
anamnesis -> safety -> goal -> eligibility -> plan
           -> session evidence -> progress -> correlation -> adjustment
```

No API, provider, persistence, billing, booking, video, or product UI workflow is included.

## Packages

| Package                     | Responsibility                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `@dogos/contracts`          | Strict Zod schemas, inferred types, reason codes, measurements, and persistence command shapes |
| `@dogos/knowledge`          | Validated, versioned, development-only protocol fixtures                                       |
| `@dogos/safety-engine`      | Fail-closed risk assessment and disposition                                                    |
| `@dogos/training-engine`    | Protocol eligibility and deterministic plan generation                                         |
| `@dogos/progress-engine`    | Ten-dimension progress evaluation and explainable plan adjustment                              |
| `@dogos/observation-engine` | Observation validation, bounded hypotheses, and descriptive correlations                       |
| `@dogos/testing`            | Localized fixtures, cross-engine tests, and the in-memory demonstration                        |

The engines import contracts and, where needed, knowledge. They do not import database, web, provider, payment, calendar, or model SDKs.

## Canonical Contracts

The contract package covers:

- context: dog, breed, health, household, owner, anamnesis, concerns, safety events, and session context;
- knowledge: claims, protocols, protocol versions, requirements, exclusions, rules, and eligibility;
- goals and plans: versioned goals, measurements, plans, immutable steps, schedules, progression, regression, stop, and escalation boundaries;
- evidence: measurements, owner check-ins, observations, hypotheses, quality, and session evidence;
- decisions: risk, progress dimensions, correlations, adjustments, and professional disposition;
- persistence boundary: database measurement row mapper and canonical persistence commands without a database client.

All canonical schemas reject extra object keys where practical. Measurements reject unsupported metrics, invalid units, invalid timestamps, out-of-range percentages, and inconsistent unknown/value combinations. Numeric zero remains a valid known value.

## Reason Codes

Persisted reason codes are defined once in `packages/contracts/src/reason-codes.ts` and grouped by concern:

- `SAFETY_*`: pain, sudden change, bite, snap, injury, child involvement, uncontrolled aggression, escape, panic, missing information, environment, and food refusal with avoidance;
- `PROTOCOL_*`: prerequisites, exclusions, safety, stage, constraints, environment, equipment, owner capability, baseline, approval, development mode, rule version, and localization release;
- `PLAN_*`: unsupported goals, no eligible protocol, unmeasurable or tied goals, and development generation;
- `PROGRESSION_*` and `REGRESSION_*`: exact thresholds, consecutive count, food refusal, recovery, and declining success;
- `DATA_*` and `CORRELATION_*`: missing, conflicting, stale, low-quality, undersized, non-causal, and small-sample evidence;
- `ADJUSTMENT_*` and `REQUIRE_*`: next-state decisions and professional review.

Human-facing explanations are intentionally absent.

## Safety Rules

Development safety rule set `1.0.0` uses explicit priorities:

1. child-involved safety event;
2. uncontrolled aggression context;
3. injury;
4. suspected pain;
5. sudden behavioral change;
6. recent bite;
7. recent snap;
8. severe fear or panic;
9. food refusal combined with avoidance;
10. escape risk;
11. missing critical answers;
12. unsupported environment.

Urgent, veterinary, trainer, stop, and information dispositions prohibit autonomous training and plan generation. Evidence IDs are deduplicated and sorted. Breed labels are not inspected by safety rules.

## Protocols and Plans

Six fixtures exist under the development namespace: marker timing, sit, down, loose-leash foundation, calm engagement, and low-distraction recall. Every fixture is `developmentOnly`, unapproved, has source placeholders, and pins semantic protocol and rule-set versions.

Eligibility evaluates prerequisites, all declared exclusion types, safety disposition, stage, sourced physical constraints, environment, equipment, owner capability, baseline evidence, mode, approval expiry, jurisdiction, release channel, exact rules, and safety-critical localization release.

Plan generation accepts one active top-priority measurable goal, selects a deterministic eligible protocol version, freezes protocol and rule versions, caps duration and repetitions, copies progression/regression/stop/escalation boundaries, and creates fixed micro-sessions plus configured recovery observations. It never generates free-form exercise text.

## Progress and Adjustment

Progress is not a universal dog score. It always returns these dimensions separately: goal attainment, consistency, success rate, current difficulty, response latency, distance or duration, engagement, recovery, handler execution, and data quality.

Confidence thresholds are deterministic:

- `unavailable`: no recent sessions;
- `low`: conflicting evidence, required metric gaps, or fewer than two reliable sessions;
- `moderate`: at least three adequate sessions, or otherwise-high evidence constrained by stale data;
- `high`: at least five sessions with at least four moderate/high-quality sessions, no conflict, no required gaps, and no stale evidence.

Adjustment precedence is safety, missing critical data, protocol stop, regression, prerequisite, progression, then repeat/continue. Simultaneous progression and regression is reported as `mixed`, while regression controls the safer next action.

## Correlations and Hypotheses

Correlations compare exposed and unexposed groups using configurable minimum group size and absolute difference. Low/unavailable measurements are excluded. Undersized comparisons emit no observation. Every emitted observation includes the observed window, samples, supporting and contradicting sessions, confidence, and `CORRELATION_NOT_CAUSATION`; samples below ten also carry `CORRELATION_SMALL_SAMPLE`.

The engine does not infer a diagnosis. Allowed hypotheses are bounded training interpretations. Clinical anxiety, trauma, depression, dominance, and medical pain diagnosis labels are rejected.

## Review Gates

Before any production release:

- a qualified dog-training professional must review every protocol step, prerequisite, cap, progression, regression, stop, and escalation rule;
- a veterinary reviewer must review pain, injury, sudden-change, food-refusal, and recovery routing;
- child-involved, bite, aggression, escape, and urgent-support wording and operations require safety/legal review;
- safety-critical localized presentation must be reviewed and explicitly released per locale;
- correlation thresholds and confidence bands remain product assumptions requiring empirical validation;
- source placeholders must be replaced with governed knowledge sources and approvals.

## Manual Verification

```bash
pnpm test:contracts
pnpm test:engines
pnpm demo:engines
open test-results/slice-2.3/engine-demo.html
```

The demo writes deterministic JSON and HTML reports under `test-results/slice-2.3/`.
