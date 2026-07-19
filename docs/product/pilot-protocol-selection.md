# Pilot Protocol Selection

Date: 2026-07-19
Release channel: `private_pilot`
Configured goal family: `goal.loose_leash_walking`

## Selected Goal

DogOS private pilot exposes one autonomous goal family:

```text
goal.loose_leash_walking
```

Owner-facing wording:

```text
Locker an anderen Hunden vorbeigehen
Walk past other dogs on a loose leash
```

## Reason

This is the strongest private-pilot candidate in the current repository because it already has:

- a canonical development protocol fixture: `protocol.loose_leash_foundation`;
- a persisted Supabase seed protocol: `protocol.loose_leash_foundation`;
- seeded active plans, plan versions, plan steps, sessions and progress records;
- a measurable baseline and target using `metric.continuous_loose_steps`;
- existing Coach, Today, Plan, Progress and E2E product coverage;
- clear stop and regression signals for food refusal, avoidance, distress and safety escalation.

Recall and calm engagement remain useful future foundations, but loose-leash currently has the most complete product surface and the clearest persisted low-risk pilot loop.

## Protocol Version

Development fixture:

```text
protocol.loose_leash_foundation
semanticVersion: 0.1.0-development
step: step.loose_leash_low_distraction
```

Persisted seed version:

```text
protocol.loose_leash_foundation
semanticVersion: 0.1.0-development
step: step.low_distraction_baseline
```

These are not production-approved protocol versions.

## Measurements

Primary pilot measurement:

```text
metric.continuous_loose_steps
```

Supporting session measurements:

```text
metric.success_rate
metric.food_acceptance
metric.recovery_seconds
```

Pilot presentation should explain unknown measurements as unknown. Missing values must not be converted to zero.

## Exclusions

Autonomous planning or progression is excluded when:

- safety disposition is not low risk;
- suspected pain, sudden behavior change, bite risk or child-involved events are present;
- the handler cannot safely manage leash and reward delivery;
- required equipment is missing;
- the environment is not low distraction;
- the owner asks for an unsupported goal family.

Unsupported goals should be acknowledged naturally and routed to waitlist, observation, or professional-help paths. DogOS must not pretend an autonomous plan exists for them.

## Stop Conditions

Stop autonomous training and preserve history when there is:

- food refusal during work;
- avoidance or distress;
- suspected pain or sudden behavior change;
- leash handling that cannot remain low intensity;
- safety escalation from deterministic rules;
- insufficient evidence to distinguish observation from interpretation.

The validated next state remains one of:

```text
repeat current step
increase difficulty
reduce difficulty
request another observation
pause for professional review
```

## Professional-Review State

Current state:

```text
development only; not professionally approved for broad production
```

The protocol includes source placeholders and is explicitly marked unapproved in the development fixture. The private pilot may test deterministic mechanics, UX, retrieval, video review and handoff packaging, but broad production readiness requires external professional review evidence.

## Remaining Approval Gate

Before any production/staging provider mode can claim approved autonomous protocol guidance, DogOS needs:

- qualified professional review of every protocol step, prerequisite, cap, progression rule, regression rule, stop rule and escalation rule;
- reviewed localized owner-facing presentation for each supported locale;
- safety review for the loose-leash stop conditions and escalation thresholds;
- signed release record tied to the exact immutable protocol version and release channel;
- pilot evaluation evidence showing owners can execute the micro-session safely and consistently.
