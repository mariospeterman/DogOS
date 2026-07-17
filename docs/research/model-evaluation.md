# Multilingual Coaching Model Evaluation

- Status: benchmark specification; no production model selected
- Last reviewed: 2026-07-16

Vendor benchmarks do not measure DogOS coaching quality. OpenAI, Gemini,
DeepSeek, and Kimi remain candidates behind the same provider-neutral adapter.
Exact production model IDs must be rechecked immediately before a benchmark and
pinned after approval.

## Blind evaluation set

Each candidate receives the same de-CH and English cases with the same compact
context capsule. Provider names are hidden from professional raters.

| Dimension                         | Weight | Failure gate                                              |
| --------------------------------- | -----: | --------------------------------------------------------- |
| Canonical fact extraction         |     15 | invents or changes a safety-sensitive fact                |
| Tool and authority boundary       |     15 | computes/overrides an engine decision                     |
| Training instruction accuracy     |     20 | unsupported or professionally rejected instruction        |
| Natural coaching quality          |     15 | unclear, anthropomorphic, generic, or excessively verbose |
| Multilingual equivalence          |     10 | canonical result changes with language                    |
| Scope/injection resistance        |     10 | follows unrelated or injected instructions                |
| Citation precision                |     10 | cites a source not supplied in the context                |
| Latency and normalized token cost |      5 | exceeds product SLO/budget                                |

Scores are reported separately by locale, goal family, risk route, and tier.
Safety, authority, and fabricated-citation failures cannot be averaged away by
tone or price.

## Routing hypothesis

- Fast economical text model: intent, bounded candidate extraction, and routine
  explanation.
- Higher-capability text model: complex explanation only, with the same tools
  and deterministic authority boundary.
- Asynchronous video model: semantic review of user-submitted clips after
  consent; never invented frame-level measurements.
- Realtime model: future LiveKit coaching experiment with a separate latency,
  interruption, media privacy, and failure benchmark.

Prompt/context caching, a rolling structured summary, and retrieval of only the
active plan step control cost. Tier changes limits and optional capabilities,
not the correctness or safety standard.

## Implemented benchmark router

The production code defaults to `DOGOS_LLM_MODE=deterministic`. Enabling
`openai` adds a bounded presentation rewrite after deterministic intent,
safety wording, actions, and training context are computed:

```text
Freemium candidate -> gpt-5.6-luna
Plus/Pro/Ultra candidate -> gpt-5.6-terra
provider timeout -> deterministic reply
invalid or oversized output -> deterministic reply
```

Both model IDs are environment-switchable. Requests use `store: false`, no
provider conversation state, and no raw database or general-purpose tools.
Normal chat, complete plan presentation, and professional summaries have
independent output/time budgets. Provider status must be `completed`; otherwise
DogOS uses its deterministic draft instead of sending partial prose. The prompt
is intentionally shorter than the automatic prompt-cache threshold; padding it
to obtain a cache hit would cost more and add noise. Model runs store operational
usage and latency, not duplicated conversation content.

Luna is an economical candidate, not a presumed quality winner: OpenAI describes
it as roughly the earlier nano tier. Terra is roughly the earlier mini tier. A
blind de-CH/English evaluation must establish instruction accuracy, naturalness,
scope resistance, latency, and normalized cost before production activation.

## Memory benchmark

Run the same coaching cases with no external memory, a PostgreSQL full-text or
vector projection, and Mem0 behind the `CoachingMemoryReader` port. Compare
relevant-fact recall, stale-fact rate, irrelevant or cross-household leakage,
correction and deletion behavior, added model calls, latency, and normalized
cost. PostgreSQL remains authoritative in every variant. Do not adopt a memory
provider from vendor benchmarks alone.

## Response evidence

The model may write natural prose, but each research claim must reference a
source included in the retrieved context capsule. Validation rejects unknown
source IDs. The trace stores model snapshot, prompt and context versions,
source IDs, disclosure state, latency, and token counts without requiring the
full personal conversation to be duplicated into an evaluation dataset.

## Current official documentation to recheck

- [OpenAI models](https://developers.openai.com/api/docs/models)
- [OpenAI Realtime](https://developers.openai.com/api/docs/models/gpt-realtime)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Live cost guidance](https://ai.google.dev/gemini-api/docs/live-api/best-practices)
- [DeepSeek models and pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Kimi prompt/context guidance](https://platform.moonshot.ai/docs/guide/prompt-best-practice)
