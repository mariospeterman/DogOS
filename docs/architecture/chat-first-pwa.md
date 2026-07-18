# Chat-First PWA Architecture

Status: active product architecture as of 2026-07-18.

## Product Boundary

DogOS owns the primary conversation. The installed PWA is the distribution,
authentication, coaching, upload, billing, plan, session, and progress surface.
External messaging providers are not part of the active runtime.

The default route is `/app/coach`. Supporting views are opened from the Coach or
bottom navigation and return to the same durable conversation.

## Trust Boundary

```text
owner message
  -> authenticated request and entitlement limit
  -> structured fact extraction
  -> deterministic missing-fact workflow
  -> canonical dog/anamnesis/goal/measurement projection
  -> safety and protocol engines
  -> transactional plan persistence and audit
  -> schema-validated natural-language presentation
```

The model may extract, acknowledge, explain, summarize, and translate. It may
not create measurements, change canonical decisions, add protocol steps, infer
sensitive facts, or bypass authorization and entitlement checks. Generated
presentations are validated against canonical decision, duration, protocol
step, target, evidence threshold, and risk disposition before display.

## Memory

DogOS uses four compact layers:

1. Stable profile: explicit dog history, owner-defined concern, goal, household,
   and reviewed constraints in relational tables.
2. Episodic history: durable Coach messages, sessions, check-ins, and plan
   versions.
3. Working state: current step, baseline, target, latest canonical decision,
   evidence count, and schedule.
4. Presentation context: a purpose-specific bounded projection sent to the
   model, without unrelated records or raw provider payloads.

This is a self-improving data foundation, not autonomous self-modifying rules.
Cross-user learning requires de-identified aggregate analysis, minimum sample
sizes, bias checks, provenance, and reviewed protocol releases. Personal data
must never be mixed between households.

## UI

The Coach uses Vercel AI SDK UI transport and custom DogOS rendering. It does
not expose a model selector, generic artifacts, coding tools, or unrestricted
assistant behavior. Training, plan, session, progress, and future video results
render as domain-specific inline cards.

Supabase Auth creates the app user, household, owner membership, tier, and
entitlement atomically. First-run chat persists independently of browser state
and projects the complete canonical product once enough explicit facts exist.

## Deferred Capabilities

- Async video upload and analysis: background jobs plus a validated finding
  timeline; no invented biomechanics or diagnosis.
- Live coaching: LiveKit for media transport only, with DogOS persistence and
  authorization remaining authoritative.
- Retrieval: add embeddings only after evaluated SQL/context retrieval misses
  important free-text evidence at production scale.
- Native stores: wrap the proven PWA with Capacitor only when distribution or
  native media requirements justify the maintenance cost.
