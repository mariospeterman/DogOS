# DogOS

DogOS is a mobile-first dog-training PWA. The authenticated Coach learns the
dog, handler context, observable problem, goal, and baseline through a natural
conversation. It then projects those facts into a versioned PostgreSQL record
and a deterministic training plan. The same conversation remains the primary
surface for explanations and daily coaching; Plan, Calendar, Progress, Session,
Billing, and Account are focused supporting views.

The language model extracts explicitly stated facts and presents computed
results. It is not authoritative for safety disposition, protocol eligibility,
progression, measurements, or plan adjustment. Initial training protocols are
development content and still require professional review before release.

## Architecture

```text
Next.js PWA + Vercel AI SDK
  -> authenticated Fastify API
  -> compact structured dog context
  -> OpenAI presentation/extraction adapter (optional)
  -> deterministic DogOS engines
  -> Supabase Auth + private PostgreSQL persistence
```

The app uses one durable Coach timeline per dog. Structured relational data is
the source of truth for memory; conversation history is episodic context.
Embeddings and model fine-tuning are intentionally deferred until evaluated
retrieval failures justify them.

See [Chat-first PWA architecture](docs/architecture/chat-first-pwa.md).

## Local Development

Prerequisites: Node.js 24 LTS, Corepack, and Docker Desktop.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev:services
pnpm db:reset
pnpm dev
```

Open <http://localhost:3000/app/coach>. The API health endpoint is
<http://127.0.0.1:4000/health/live>.

For an isolated reset and review environment:

```bash
pnpm demo:product
```

## Verification

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:test
pnpm db:lint
pnpm build
```

Production credentials belong in deployment secret storage. `.env.example` is
the committed variable contract; `.env.local` is the uncommitted local source
of truth.

## Current Release Blockers

- professionally reviewed and versioned training protocols;
- blind model evaluation for extraction and multilingual coaching quality;
- privacy export, deletion, and retention workflows;
- commercial Stripe catalog, tax, legal, and entitlement approval;
- verified professional supply and referral governance;
- asynchronous video analysis and later LiveKit live coaching;
- real-device PWA acceptance and production deployment review.

Historical Phase 1 and provider experiments remain under `docs/` and in old
migrations for auditability; they are not part of the active PWA runtime.
