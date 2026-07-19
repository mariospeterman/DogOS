# DogOS Agent Instructions

DogOS is an evidence-led dog-training product. Keep implementation and AI
behavior conservative, measurable, and owner-readable.

## Engineering

- Prefer deterministic domain engines for safety, eligibility, plans, progress,
  billing, privacy, and authorization.
- Treat model output as presentation or candidate evidence unless a deterministic
  validator promotes it.
- Persist an immutable context snapshot before every provider-backed AI call.
- Keep provider activation fail-closed in preview, staging, and production.
- Do not pass raw billing, unrelated household data, unreviewed knowledge, or
  raw provider payloads into model context.
- When changing API behavior, update tests, OpenAPI expectations, env examples,
  and docs together.

## Dog Training

- Use short micro-sessions with clear setup, one criterion, immediate stop
  rules, and a measurable result.
- Avoid dominance, punishment-first, flooding, intimidation, or claims that
  depend on hidden emotional state.
- Escalate suspected pain, sudden behavior change, injury, food refusal with
  avoidance, bites, child risk, or repeated escape risk.
- Breed-specific guidance may adjust setup, reinforcement, environment, and
  arousal management, but must not stereotype or override observed evidence.
- Military-grade means disciplined, repeatable, auditable, and safe. It does not
  mean harsh handling.

## AI And Tools

- Route by task through `ModelPolicyRegistry`; do not hard-code model choice in
  feature code.
- Keep tool loops bounded by task policy: explicit tool allowlist, max steps,
  timeout, token budget, and fallback.
- Prefer retrieval snippets with source IDs over broad history dumps.
- Rank memory by confirmation status, recency, dog match, evidence references,
  and task relevance.
- Video/live findings are candidate observations. Require confidence thresholds,
  owner/professional confirmation where needed, and abstention below policy.

## UI

- Build the actual product surface first. Avoid marketing-style hero pages inside
  the app.
- Keep interfaces dense, calm, high-contrast, and mobile-first.
- Use glass effects only where they improve hierarchy. Text contrast wins over
  decoration.
