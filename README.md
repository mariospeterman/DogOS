# DogOS

DogOS is a multilingual dog-training platform with one Coach across its web app
and WhatsApp. It is
Swiss-positioned and DACH-first commercially. German is the first reviewed
launch content locale, not a technical product boundary. Its core is a
contextual, deterministic training engine that turns anamnesis, safety checks,
measurable goals, session evidence, and training history into versioned plans
and explainable plan adjustments.

DogOS does not use a language model as the authority for training progression,
safety, medical interpretation, or protocol creation. Initial protocols are
development content and are not approved for production use.

## Current status

Phase 2 Slices 2.1 through 2.7 provide the pinned monorepo, local Supabase
schema and RLS, deterministic multilingual engines, strict persistence mappers,
transactional repositories, typed Fastify API and OpenAPI, signed actions, a
provider-neutral WhatsApp integration, a canonical omnichannel Coach timeline,
and the first mobile owner journey. Professional
protocol, safety, legal, privacy, provider, and launch translation review remain
production release blockers.

## Local development

Prerequisites: Node.js 24 LTS, Corepack, and Docker Desktop (used from Slice
2.2 onward).

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev:services
pnpm db:reset
pnpm dev
```

The web app runs at <http://localhost:3000> and the API health endpoint at
<http://127.0.0.1:4000/health/live>. See the
[local development runbook](docs/runbooks/local-development.md) for all checks
and the current database workflow.

For the complete reset, seed, API, Coach, and mobile review experience:

```bash
pnpm demo:product
```

## Phase 1 documentation

- [Architecture](docs/architecture/phase-1.md)
- [Domain model and contracts](docs/architecture/domain-model.md)
- [Knowledge governance](docs/knowledge/governance.md)
- [Safety and escalation](docs/safety/safety-escalation.md)
- [WhatsApp, mobile, and referral flows](docs/product/whatsapp-mobile.md)
- [Twilio WhatsApp Sandbox setup](docs/providers/twilio-whatsapp-sandbox.md)
- [Worked training-plan examples](docs/product/worked-plan.md)
- [Testing and approval gates](docs/testing/phase-1-approval.md)

The original research notes remain in [architecture](architecture) and
[provider-mvp imporvment](provider-mvp%20imporvment).

## Phase 2 implementation

- [Slice 2.1 foundation](docs/implementation/slice-2.1-foundation.md)
- [Slice 2.2 database foundation](docs/implementation/slice-2.2-database.md)
- [Slice 2.3 deterministic engines](docs/implementation/slice-2.3-engines.md)
- [Slice 2.4 API and persistence](docs/implementation/slice-2.4-api-persistence.md)
- [Slice 2.5 local product](docs/implementation/slice-2.5-local-product.md)
- [Slice 2.6 authenticated WhatsApp](docs/implementation/slice-2.6-authenticated-whatsapp.md)
- [Slice 2.7 omnichannel Coach](docs/implementation/slice-2.7-omnichannel-coach.md)
- [RLS access matrix](docs/architecture/phase-2-2-rls-matrix.md)
