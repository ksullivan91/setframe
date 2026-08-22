# ADR 0002: Authentication via Clerk

Status: Proposed. Date: 2026-08-20.

## Context

Setframe needs multi-user auth from day one across three surfaces (React
web, React Native/Expo mobile, Fastify API), with strict per-user data
isolation and no reliance on client-supplied identity.

## Decision

Use **Clerk** as specified by the master prompt:
- Web: current Clerk React/Vite integration.
- Mobile: current Clerk Expo SDK + `expo-secure-store` for token
  persistence.
- API: verifies Clerk-issued bearer tokens on every request (current
  supported verification approach — official `@clerk/backend`, latest
  checked version `3.16.9`).

The API maintains its own `user` table keyed by internal UUID, with a
unique `clerk_user_id` column mapping to Clerk's identity. Every
authenticated request resolves `clerk_user_id` → internal `user.id` once,
and all subsequent DB access is scoped by that internal id — never by a
user id supplied in the request body/query.

## Rationale

- Clerk directly supports both a Vite/React web SPA and an Expo/React
  Native mobile client with dedicated SDKs, avoiding a custom
  auth/session/token-refresh implementation across two very different
  client runtimes.
- Centralizing verification in one place (a Fastify pre-handler) keeps
  ownership-checking logic uniform across all `/v1/*` routes.
- Keeping an internal `user.id` (rather than using `clerk_user_id`
  everywhere) decouples the database schema from the auth provider,
  should Setframe ever need to migrate providers, and gives a stable id
  format (UUID) consistent with the rest of the schema.

## Consequences

- Requires Clerk dev + production instances, plus separate configuration
  for web origins and Expo native redirect handling (documented in
  `docs/deployment.md`, Phase 11).
- Account deletion (master spec §33) must coordinate deleting both the
  Clerk identity and all `user_id`-scoped rows in Postgres; document this
  as an explicit two-step workflow, not just a DB cascade.
- Never log Clerk secrets or raw bearer tokens (master spec §18/§19).

## Open question for user review

Confirm whether email/password, magic link, and/or social sign-in (e.g.
Apple/Google) should be enabled for MVP — this affects Clerk dashboard
configuration but not the API/schema design above.
