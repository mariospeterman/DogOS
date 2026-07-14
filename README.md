# DogOS

DogOS is a German-first, WhatsApp-first dog-training platform for Germany,
Austria, and Switzerland. Its core is a contextual, deterministic training
engine that turns anamnesis, safety checks, measurable goals, session evidence,
and training history into versioned plans and explainable plan adjustments.

DogOS does not use a language model as the authority for training progression,
safety, medical interpretation, or protocol creation. Initial protocols are
development content and are not approved for production use.

## Current status

Phase 2 implementation has started. Slice 2.1 provides the pinned monorepo,
bootable web and API shells, environment validation, test harnesses, and CI.
No database schema or product workflow has been implemented yet. Professional
protocol and safety review remains a production release blocker.

## Local development

Prerequisites: Node.js 24 LTS, Corepack, and Docker Desktop (used from Slice
2.2 onward).

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

The web app runs at <http://localhost:3000> and the API health endpoint at
<http://127.0.0.1:4000/health/live>. See the
[local development runbook](docs/runbooks/local-development.md) for all checks
and the explicit Slice 2.1 limitations.

## Phase 1 documentation

- [Architecture](docs/architecture/phase-1.md)
- [Domain model and contracts](docs/architecture/domain-model.md)
- [Knowledge governance](docs/knowledge/governance.md)
- [Safety and escalation](docs/safety/safety-escalation.md)
- [WhatsApp, mobile, and referral flows](docs/product/whatsapp-mobile.md)
- [Worked training-plan examples](docs/product/worked-plan.md)
- [Testing and approval gates](docs/testing/phase-1-approval.md)

The original research notes remain in [architecture](architecture) and
[provider-mvp imporvment](provider-mvp%20imporvment).

## Phase 2 implementation

- [Slice 2.1 foundation](docs/implementation/slice-2.1-foundation.md)
