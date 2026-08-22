# ADR 0003: REST + OpenAPI (not GraphQL/tRPC)

Status: Proposed. Date: 2026-08-20.

## Context

Setframe needs one API consumed by two very different clients (React web,
React Native/Expo mobile), with strong end-to-end TypeScript types and low
operational complexity for an MVP-stage single-service backend.

## Decision

Use **Fastify + Zod + OpenAPI**, exposing a single REST API under `/v1`,
with a generated/typed client in `packages/api-client` shared by both
clients. Do not use GraphQL or tRPC for MVP.

Implementation approach:
- Fastify route schemas defined with Zod, wired through a supported
  Fastify/Zod type-provider package (e.g. `fastify-type-provider-zod`,
  latest checked version `7.0.0`) so runtime validation and static types
  come from one schema definition.
- Generate a valid OpenAPI document from those route schemas; expose the
  JSON spec in dev/staging.
- Generate a typed TS client from the OpenAPI document (e.g. via
  `openapi-typescript`, latest checked version `7.13.0`, or an equivalent
  current-recommended generator, confirmed against current docs at
  implementation time) into `packages/api-client`. Web and mobile both
  import from this package — no hand-written second request layer.
- Add CI stale-client detection (regenerate the client in CI and fail the
  build if it differs from the committed version) once Phase 5 lands.

## Rationale

- REST + OpenAPI is simpler to operate, cache, and reason about at this
  scale than GraphQL (no resolver graph, no N+1 concerns to manage) and
  avoids tRPC's tighter coupling to a single TypeScript-only client
  runtime, which is less of an advantage here since both clients are
  already TypeScript but benefit more from a stable, inspectable HTTP
  contract (useful for the mobile offline retry queue and for the health
  reconciliation endpoint's idempotency guarantees).
- OpenAPI gives a durable, tool-agnostic contract that's easy to diff in
  PRs and easy to keep client/server in sync via generation rather than
  hand maintenance.
- A single purpose-built aggregate endpoint (`/v1/dashboard/today`) covers
  the one case where GraphQL's flexible querying is usually cited as an
  advantage (avoiding many serial REST calls), without taking on GraphQL's
  operational cost.

## Consequences

- Any new field must be added to the Zod schema (source of truth) before
  it can flow through validation, OpenAPI, and the generated client — a
  deliberate single-source-of-truth constraint, not a limitation to work
  around.
- Requires CI steps to keep the generated client fresh; a stale-client
  check is part of Phase 5's acceptance criteria.
