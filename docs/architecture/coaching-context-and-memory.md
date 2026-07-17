# Coaching Context and Memory

- Status: approved foundation; provider benchmark pending
- Last reviewed: 2026-07-16

DogOS should feel like a capable natural-language coach, not a form that happens
to send messages. The model receives a small context capsule assembled from
authoritative product state. It does not receive the full account, full chat
history, or unrestricted database access.

## Authority model

```text
PostgreSQL facts and measurements (authoritative)
  -> relevant memory retrieval (read-only projection)
  -> compact context capsule
  -> natural coaching model
  -> typed draft with citations and proposed actions
  -> validation
  -> canonical Coach message
  -> WhatsApp presentation or authenticated app record

Confirmed user fact or command
  -> canonical API tool
  -> authorization and idempotency
  -> database transaction and audit
```

The model writes prose and proposes actions. Only canonical tools can mutate
state. This keeps the prompt short while protecting the few boundaries that
matter: identity, household access, measured facts, evidence provenance, and
durable writes.

The canonical conversation belongs to DogOS, not a provider. WhatsApp messages
append to one ordered server-side timeline. Channel bindings contain routing
metadata only; they cannot fork memory, plan state, entitlements, or assistant
behavior. The owner web product does not render a second chat.

## Context capsule

The capsule contains only:

- dog identity, development stage, and owner-reported breed description;
- current measurable goal and active versioned plan step;
- up to 12 recent measurements and 16 relevant memory facts;
- unknown facts that materially affect the answer;
- up to four contextual advisories;
- up to eight reviewed claims and their source metadata.

The capsule deliberately excludes billing details, unrelated household data,
raw authentication data, and an unbounded transcript. The complete record stays
in PostgreSQL and is retrieved only under household authorization.

## Memory decision

PostgreSQL remains the source of truth. A memory implementation must satisfy the
`CoachingMemoryReader` port and return sourced, tenant-bound facts. It may rank
or summarize but cannot silently overwrite canonical facts.

Mem0 is a candidate retrieval implementation, not an approved dependency. Its
self-hosted mode and hybrid retrieval are potentially useful, but it adds a
second personal-data index, model calls for memory extraction, deletion and
correction synchronization, and another injection surface. Adopt it only if a
DogOS benchmark proves better retrieval quality or token cost than a PostgreSQL
full-text/vector projection, with equivalent tenant isolation and erasure.

## Natural response policy

The model instruction is intentionally short. It defines the DogOS role,
requires use of retrieved facts and citations, asks for missing material facts,
mentions relevant advisories briefly, and prohibits invented measurements or
claims that a proposed action already occurred. Legal and governance controls
belong in system architecture, tests, traces, and product disclosure, not as a
large block repeated in every prompt.

## Evaluation gate

Compare provider/model candidates and memory implementations using the same
cases. Measure coaching quality, factual consistency, source precision, recall
of relevant history, irrelevant-memory leakage, multilingual equivalence,
latency, tokens, and cost. A model or memory layer fails if it crosses household
boundaries, cites an unavailable source, invents a measured value, or represents
a proposed write as completed.

## References

- [OpenAI model guidance](https://developers.openai.com/api/docs/models)
- [Mem0 open-source overview](https://docs.mem0.ai/open-source/overview)
- [Mem0 source repository](https://github.com/mem0ai/mem0)
