# DogOS MCP tool catalog

Read tools: `dogos_get_profile`, `dogos_get_current_state`, `dogos_get_today`, `dogos_get_progress`.

Authenticated idempotent writes: `dogos_record_anamnesis_answer`, `dogos_run_safety_assessment`, `dogos_create_goal`, `dogos_generate_plan`, `dogos_start_session`, `dogos_record_session`, `dogos_complete_checkin`, `dogos_adjust_plan`, `dogos_request_professional_handoff`.

No database, provider credential, threshold, eligibility, ranking, diagnosis, or direct decision tool exists. Use `DOGOS_MCP_READ_ONLY=true` for read-only clients.
