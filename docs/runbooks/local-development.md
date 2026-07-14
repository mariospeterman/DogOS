# Local Development Runbook

## Prerequisites

- Node.js 24 LTS (`24.18.0` recommended, `24.11.0` minimum)
- Corepack with pnpm `11.13.0`
- Docker Desktop for Slice 2.2 database services

## First setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

The package manager version is enforced through `packageManager`, engines, and
the lockfile. Do not install dependencies with npm or yarn.

## Run the applications

```bash
pnpm dev
```

- Web: <http://localhost:3000>
- API liveness: <http://127.0.0.1:4000/health/live>
- API readiness: <http://127.0.0.1:4000/health/ready>

Local defaults enable mock providers. Production environment validation rejects
mock providers and development signing secrets.

## Verify the foundation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

`pnpm dev:services`, `pnpm db:reset`, and `pnpm seed` intentionally do not exist
until Slice 2.2 adds a real local Supabase project, migrations, and deterministic
seed data.
