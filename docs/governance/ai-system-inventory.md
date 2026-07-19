# DogOS AI System Inventory

Last updated: 2026-07-19

DogOS treats deterministic training engines and Postgres records as the authority. LLMs, video models, and LiveKit sessions may present, summarize, or propose owner-confirmed candidates; they do not directly write canonical training decisions.

| Feature                 | Purpose                                                                    | Provider                                                      | Data categories                                                     | Release state          | Required gate                                                              |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| AI policy registry      | Task-based model/provider routing and release gating                       | DogOS runtime                                                 | task policy, manifest IDs, capability readiness                     | Implemented            | approved manifests before provider activation                              |
| Context snapshots       | Immutable bounded context for each provider call                           | Supabase Postgres                                             | dog facts, plan state, selected memory/evidence, token estimate     | Implemented            | context compiler coverage and retention review                             |
| Coach chat              | Owner-facing coaching and plan explanation                                 | OpenAI Responses API through DogOS API                        | dog profile, active goal, plan, sessions, bounded memory, citations | Blocked for production | external model approval evidence, blind eval pass, protocol review         |
| Onboarding extraction   | Convert owner text into supported canonical setup answers                  | OpenAI structured outputs with deterministic fallback         | onboarding messages, dog profile facts                              | Staging gated          | extraction eval pass, privacy approval                                     |
| Retrieval and citations | Ground coach replies in approved protocols, memory, sessions, and evidence | Supabase Postgres                                             | context capsule, memory refs, source refs, protocol refs            | In implementation      | citation coverage tests, approved-claim retrieval                          |
| Async video analysis    | Candidate observations from private training clips                         | Vertex Gemini target, OpenAI frame fallback, Supabase Storage | private media, metadata, candidate observations                     | Worker gated           | media consent, safety review, provider eval, object reader/frame extractor |
| Local CV precision      | Timing and geometry evidence from selected event windows                   | FFmpeg/MediaPipe/OpenMMLab candidate stack                    | derived landmarks, tracks, event windows, confidence scores         | Disabled               | model files, calibration, abstention thresholds, worker isolation          |
| Live coaching           | Real-time transport for owner training sessions                            | LiveKit transport, Vertex Gemini/OpenAI realtime candidates   | room metadata, consent, optional transcript/recording refs          | Staging gated          | LiveKit staging smoke, consent/retention approval                          |
| Billing upgrades        | Checkout and entitlement projection                                        | Stripe Billing                                                | customer/subscription IDs, tier projection                          | Staging gated          | webhook verification, tax/legal approval                                   |
| Professional handoff    | Owner-controlled trainer/veterinary case packet with facts, evidence refs, unknowns, and disagreements | Supabase Postgres, DogOS API, future signed share link         | summary, memory/video refs, referral metadata, audit trail           | Artifact implemented; sharing gated | signed share link approval, trainer/vet consent, export retention review    |

## Global Controls

- No raw provider credentials, access tokens, prompts, chain-of-thought, or private media URLs are rendered to users.
- No user media or personal cases are used for provider model training by default.
- Video and live outputs cannot diagnose pain, anxiety, trauma, aggression, or human identity/biometrics.
- Sensitive writes require owner confirmation: paid upgrades, trainer/veterinary handoff, deletion, video/live consent, goal replacement, and plan activation.
- Telemetry records provider, model, latency, token counts, outcome, versions, and trace IDs without raw sensitive content.
