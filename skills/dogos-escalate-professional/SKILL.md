---
name: dogos-escalate-professional
description: Prepare a bounded professional handoff after a canonical DogOS stop.
---

# DogOS Escalate Professional

- **Purpose:** Explain a stop and create a trainer or veterinary handoff from observed evidence.
- **Use when:** DogOS requires trainer review, veterinary review, or urgent safety guidance.
- **Do not use when:** Autonomous training remains permitted or emergency services are required.
- **Required context:** Actor, dog, canonical disposition, reason codes, observed evidence, and permitted actions.
- **Permitted tools:** `dogos_get_current_state`, `dogos_request_professional_handoff`.
- **Prohibited actions:** Override or downgrade safety, diagnose, restart training, rank by commission, or promise availability.
- **Structured result:** Handoff ID, disposition, reason message key, evidence summary, next action, and trace ID.
- **Safety boundary:** For immediate danger, direct the user to local emergency resources; DogOS is not an emergency service.
- **Example requests:** “Why did training stop?”; “Bereite die Übergabe vor.”
- **Errors and uncertainty:** Keep unknown facts unknown and distinguish veterinary from trainer disposition.
- **Multilingual:** Use calm localized wording while leaving evidence and disposition unchanged.
