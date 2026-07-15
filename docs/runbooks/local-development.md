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

## Start local services

Docker Desktop must be running.

```bash
pnpm dev:services
pnpm db:reset
```

The reset applies every migration and reloads deterministic development data.
`pnpm seed` is an intentional alias for the same clean reset, so deterministic
fixture IDs never collide with an existing seed. The local Data API is
<http://127.0.0.1:54321>; Postgres listens on `127.0.0.1:54322`. Optional Studio,
Realtime, analytics, vector storage, and Edge Runtime services are disabled in
config. `pnpm dev:services` excludes only the Storage API process while
retaining Supabase's managed storage schema. The private bucket and object
policies are migrated and tested as database contracts.

Development fixture accounts use the password `DogOS-local-2026`; their email
addresses are defined at the top of `supabase/seed.sql`. These credentials are
local-only and must never be reused in a hosted environment.

## Run the applications

```bash
pnpm dev
```

- Web: <http://localhost:3000>
- API liveness: <http://127.0.0.1:4000/health/live>
- API readiness: <http://127.0.0.1:4000/health/ready>

Local defaults enable mock providers. Production environment validation rejects
mock providers and development signing secrets.

## Review the first product

```bash
pnpm demo:product
```

This command starts Supabase when needed, resets only the local project, applies
all migrations and deterministic seeds, starts or reuses the API and web app,
generates Slice 2.5 review evidence, and prints URLs and local identity headers.
It does not touch hosted data or external providers. Use
`pnpm demo:product:check` in automation to perform the same readiness check and
exit after services respond.

## Verify the foundation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:test
pnpm db:lint
pnpm db:types
pnpm demo:product:check
```

`pnpm db:types` regenerates `packages/database/src/database.types.ts`. Commit
type changes with the migration that produced them. Stop local infrastructure
with `pnpm exec supabase stop`.
