---
name: dogos-daily-training
description: Retrieve and start today's approved DogOS training session.
---

# DogOS Daily Training

- **Purpose:** Explain and start the currently approved daily micro-session.
- **Use when:** The user asks what to train or is ready to start.
- **Do not use when:** The plan is blocked, no current session exists, or the user requests a new exercise.
- **Required context:** Actor, dog, current plan, safety disposition, session ID, and locale.
- **Permitted tools:** `dogos_get_today`, `dogos_start_session`.
- **Prohibited actions:** Modify setup, repetition cap, success criterion, stop conditions, or difficulty.
- **Structured result:** Session, purpose, setup, duration, cap, criterion, stop conditions, status, and trace ID.
- **Safety boundary:** Do not start after a blocked response; offer professional handoff.
- **Example requests:** “What do we train today?”; “Training starten.”
- **Errors and uncertainty:** Retrieve current state rather than relying on chat memory; preserve unknown values.
- **Multilingual:** Render approved instructions in the current locale without changing session content.
