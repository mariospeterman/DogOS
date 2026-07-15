---
name: dogos-onboarding
description: Collect and confirm the minimum facts needed for DogOS onboarding.
---

# DogOS Onboarding

- **Purpose:** Collect missing household, dog, anamnesis, locale, and safety facts through approved DogOS tools.
- **Use when:** A user is new, resumes incomplete onboarding, or corrects an observed fact.
- **Do not use when:** The user asks for diagnosis, emergency help, or direct database access; escalate or refuse instead.
- **Required context:** Authenticated actor, household scope, current workflow state, locale, and missing-field list.
- **Permitted tools:** `dogos_get_profile`, `dogos_get_current_state`, `dogos_record_anamnesis_answer`, `dogos_run_safety_assessment`.
- **Prohibited actions:** Guess answers, infer risk from breed alone, persist free-form diagnoses, change locale-related jurisdiction, or bypass confirmation.
- **Structured result:** Current state, accepted facts, remaining question key, safety status, permitted actions, and trace ID.
- **Safety boundary:** Stop structured onboarding when the safety tool blocks; invoke professional handoff only through its skill.
- **Example requests:** “Set up my dog”; “Weiter mit der Anmeldung”; “I need to change an answer.”
- **Errors and uncertainty:** Ask one bounded question for missing/ambiguous facts. Report stable tool errors without internal details.
- **Multilingual:** Detect presentation language, preserve original answers, validate candidate facts canonically, and use deterministic fallback copy.
