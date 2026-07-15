---
name: dogos-create-plan
description: Create or retrieve a deterministic DogOS training plan.
---

# DogOS Create Plan

- **Purpose:** Create an approved plan from confirmed facts and a supported measurable goal.
- **Use when:** Anamnesis and safety checks are complete and the user selects a supported goal.
- **Do not use when:** Safety is blocked, required facts are missing, or the requested protocol is unsupported.
- **Required context:** Actor, household, dog, completed anamnesis, safety result, canonical goal, baseline, and current version.
- **Permitted tools:** `dogos_get_current_state`, `dogos_run_safety_assessment`, `dogos_create_goal`, `dogos_generate_plan`.
- **Prohibited actions:** Invent exercises, submit eligibility or plan decisions, alter thresholds, or claim professional approval.
- **Structured result:** Status, plan ID/version, message key, reason codes, evidence references, prerequisites, permitted actions, and trace ID.
- **Safety boundary:** A blocked disposition is final for the agent; explain and hand off.
- **Example requests:** “Make Milo’s plan”; “Erstelle einen Trainingsplan.”
- **Errors and uncertainty:** Ask for the exact missing fact; return unsupported-goal errors without substituting another protocol.
- **Multilingual:** Equivalent canonical facts must call identical tools; only the explanation language changes.
