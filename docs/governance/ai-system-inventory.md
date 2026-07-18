# DogOS AI System Inventory

Last updated: 2026-07-18

DogOS treats deterministic training engines and Postgres records as the authority. LLMs, video models, and LiveKit sessions may present, summarize, or propose owner-confirmed candidates; they do not directly write canonical training decisions.

| Feature                 | Purpose                                                                    | Provider                                              | Data categories                                                     | Release state     | Required gate                                             |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| Coach chat              | Owner-facing coaching and plan explanation                                 | OpenAI Responses API through DogOS API                | dog profile, active goal, plan, sessions, bounded memory, citations | Staging gated     | approved model snapshot, blind eval pass, protocol review |
| Onboarding extraction   | Convert owner text into supported canonical setup answers                  | OpenAI structured outputs with deterministic fallback | onboarding messages, dog profile facts                              | Staging gated     | extraction eval pass, privacy approval                    |
| Retrieval and citations | Ground coach replies in approved protocols, memory, sessions, and evidence | Supabase Postgres                                     | source refs, memory refs, protocol refs                             | In implementation | citation coverage tests                                   |
| Async video analysis    | Candidate observations from private training clips                         | Provider-neutral adapter, Supabase Storage            | private media, metadata, candidate observations                     | Staging gated     | media consent, safety review, provider eval               |
| Live coaching           | Real-time transport for owner training sessions                            | LiveKit transport, DogOS persistence                  | room metadata, consent, optional transcript/recording refs          | Staging gated     | LiveKit staging smoke, consent/retention approval         |
| Billing upgrades        | Checkout and entitlement projection                                        | Stripe Billing                                        | customer/subscription IDs, tier projection                          | Staging gated     | webhook verification, tax/legal approval                  |
| Trainer handoff         | Owner-controlled professional summary and referral                         | DogOS signed actions, future booking provider         | summary, referral metadata, audit trail                             | Pilot gated       | trainer consent and sharing approval                      |

## Global Controls

- No raw provider credentials, access tokens, prompts, chain-of-thought, or private media URLs are rendered to users.
- No user media or personal cases are used for provider model training by default.
- Video and live outputs cannot diagnose pain, anxiety, trauma, aggression, or human identity/biometrics.
- Sensitive writes require owner confirmation: paid upgrades, trainer sharing, deletion, video/live consent, goal replacement, and plan activation.
- Telemetry records provider, model, latency, token counts, outcome, versions, and trace IDs without raw sensitive content.
