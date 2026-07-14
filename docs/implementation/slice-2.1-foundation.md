# Slice 2.1: Production Foundation

- Status: implemented
- Date: 2026-07-14
- Baseline: `bf1982e`

## Scope

This slice establishes only the production-oriented development foundation:

- pnpm 11 workspace with Turborepo;
- pinned Node, package manager, framework, test, and Supabase CLI versions;
- minimal Next.js App Router and Fastify applications;
- strict TypeScript, ESLint, Prettier, Vitest, and Playwright configuration;
- runtime environment validation with production mock/secret guards;
- OpenTelemetry-compatible tracing plus vendor-neutral error and analytics ports;
- GitHub Actions quality and browser-test jobs.

## Boundaries

The web page is an honest implementation-status surface, not a finished
marketing site. The API exposes only liveness and readiness endpoints. Slice
2.1 intentionally does not initialize Supabase, create a schema, seed data,
implement domain contracts, or connect a real provider.

The following required developer commands arrive with Slice 2.2 because they
must operate on real local infrastructure and migrations:

- `pnpm dev:services`
- `pnpm db:reset`
- `pnpm seed`

They are omitted rather than returning false success.

## Version policy

Exact versions are recorded in each `package.json` and `pnpm-lock.yaml`.
Node.js is pinned to `24.18.0` in CI and version-manager files; the engine floor
is `24.11.0` so the existing Node 24 LTS development runtime remains usable.
TypeScript 6.0 is the newest compiler supported by the current
`typescript-eslint` release (`<6.1`). ESLint 9 is retained because Next.js's
current React and import plugins do not yet declare ESLint 10 compatibility.
Version updates must arrive through reviewed pull requests.

## Decisions

No architecture decision from Phase 1 changed. In particular, Supabase CLI is
a pinned development dependency, while `supabase init`, migrations, explicit
grants, RLS, and pgTAP tests remain a single Slice 2.2 change set.

## Official documentation checked

- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [pnpm installation](https://pnpm.io/installation)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Turborepo existing repository setup](https://turborepo.com/docs/getting-started/add-to-existing-repository)
- [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Fastify v5 migration guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/)
- [Vitest migration guide](https://vitest.dev/guide/migration)
- [Playwright installation](https://playwright.dev/docs/intro)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase changelog](https://supabase.com/changelog)

The Supabase changelog review recorded the current opt-in Data/GraphQL API
exposure behavior, Postgres 14 support removal, and `pg_graphql` defaults for
the Slice 2.2 implementation.
