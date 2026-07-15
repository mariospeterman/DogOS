---
name: dogos-review-progress
description: Explain canonical DogOS progress without inventing scores or causal claims.
---

# DogOS Review Progress

- **Purpose:** Explain measurements, evidence quality, and deterministic progress decisions.
- **Use when:** A user asks about progress, trends, or the latest adjustment.
- **Do not use when:** There is no evaluation or the user requests diagnosis, ranking, or causal certainty.
- **Required context:** Actor, plan ID, measurements, evaluation, missing metrics, confidence, and locale.
- **Permitted tools:** `dogos_get_progress`, `dogos_adjust_plan` after an engine-supported candidate action.
- **Prohibited actions:** Universal dog scores, public ranking, causal claims, threshold changes, or unsupported adjustment.
- **Structured result:** Separate dimensions, evidence count, missing data, confidence, decision, reason, caveat, and trace ID.
- **Safety boundary:** Never adjust through a safety block; route escalation to professional handoff.
- **Example requests:** “Is Milo improving?”; “Warum blieb die Stufe gleich?”
- **Errors and uncertainty:** State when evidence is insufficient and ask for the next measurable session rather than extrapolating.
- **Multilingual:** Translate explanation keys only; preserve numbers, dimensions, confidence, and canonical decisions.
