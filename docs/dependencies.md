# Setline — Proposed Dependency Set (Phase 0 Draft)

Status: Proposed. Versions below were checked live against npm on
2026-08-20 and represent current `latest` at that time — re-verify
immediately before running `npm install` in Phase 1, since these will
drift.

## Repository tooling
- `turbo` — `2.10.11`
- TypeScript strict mode across all workspaces
- npm workspaces (no Yarn/pnpm per spec)

## Web (`apps/web`)
- `react` / `react-dom` — `19.2.8`
- `react-router-dom` — `7.18.2`
- `@tanstack/react-query` — `5.101.4`
- `vite` — `8.2.2`
- `styled-components` — `6.5.3`
- `react-hook-form` — `7.85.0`
- `zod` — `4.4.3`
- `@clerk/clerk-react` — `5.61.3`
- `vitest` — `4.1.11`, Testing Library, MSW

## Mobile (`apps/mobile`)
- `expo` / `expo-router` — `57.0.15`
- `react-native` — `0.87.0`
- `@tanstack/react-query`, `react-hook-form`, `zod` (shared versions above)
- `@clerk/clerk-expo` — `2.20.0`
- `expo-secure-store`
- `@kingstinct/react-native-healthkit` — `14.0.2` (see ADR 0001) +
  `react-native-nitro-modules` (peer dependency)

## Backend (`apps/api`)
- `fastify` — `5.12.1`
- `fastify-type-provider-zod` — `7.0.0`
- `@fastify/cors` — `11.3.0`
- `@fastify/helmet` — `13.1.1`
- `zod` — `4.4.3`
- `pino` — `10.3.1` (Fastify's built-in logger ecosystem)
- `drizzle-orm` — `0.45.2`
- `drizzle-kit` — `0.31.10`
- `@neondatabase/serverless` — `1.1.0`
- `@clerk/backend` — `3.16.9`

## Shared packages
- `zod` — schema source of truth (`packages/schemas`)
- `openapi-typescript` — `7.13.0` (or current-recommended equivalent,
  reconfirm at Phase 5) for `packages/api-client` generation

## Testing / CI
- `vitest` — `4.1.11` (domain, API, web unit/integration tests)
- Playwright (added later, Phase 11 critical-flow E2E) — version to be
  checked when that phase starts
- GitHub Actions (no specific version pin beyond referencing current
  `actions/checkout`, `actions/setup-node` major versions at
  implementation time)

## Explicitly excluded per master spec

No Redis, Kafka, Elasticsearch, event sourcing/CQRS framework,
Kubernetes, GraphQL, or tRPC packages — Postgres + one Fastify service is
sufficient for MVP scale (spec §34).

## Decided (2026-08-20)

`react-native-health` (AE Studio) was evaluated and rejected in favor of
`@kingstinct/react-native-healthkit` — see ADR 0001. Confirmed, no
objection — this is the working HealthKit dependency for Phase 6/7.

**Blocker to track**: the user has not yet enrolled in the Apple Developer
Program. This doesn't block npm dependency work in Phases 1–6, but must be
resolved before Phase 7 (HealthKit entitlements require a paid Apple
Developer account) and Phase 11 (TestFlight/App Store distribution).
Recommend starting enrollment now, in parallel with earlier phases, since
Apple's approval isn't instant.
