# Setframe — Architecture (Phase 0 Draft)

Status: Proposed, pending user review. No code has been generated yet.

## 1. Product summary

Setframe is a multi-user fitness training + health-sync platform. It replaces
spreadsheets and fragmented fitness apps with:

- Flexible training programs/templates (intent) vs. workout sessions (fact).
- Variable-length set logging (no fixed `set1Weight` columns).
- Manual daily inputs (body weight, blood pressure) that coexist with
  imported Apple Health data.
- Apple Health/HealthKit as the single MVP integration hub (activity,
  Watch/Fitness rings, heart/fitness metrics, weight, and MyFitnessPal
  nutrition data written into HealthKit — no direct MFP API).
- One REST API consumed by both a React web app and a React Native (Expo)
  iOS app.

## 2. Repository layout (proposed)

```text
setframe/
  apps/
    api/            Fastify REST API
    web/             React + Vite SPA
    mobile/          Expo/React Native app
  packages/
    api-client/      Generated/typed client shared by web + mobile
    domain/          Pure progression/volume/1RM/sync-planning logic
    schemas/         Zod schemas shared across api/web/mobile
    database/        Drizzle schema + migrations
    config/          Typed env parsing (Zod)
    design-tokens/    Shared color/spacing/typography tokens
  docs/
    adr/
    design/
  scripts/
  .github/workflows/
  package.json
  turbo.json
  tsconfig.base.json
  README.md
```

Tooling: npm workspaces + Turborepo, TypeScript strict end-to-end.

## 3. Deployment topology

```text
Browser ──> Cloudflare Pages ──> React/Vite SPA ──HTTPS/REST──┐
                                                                ├─> Railway (Fastify API) ──> Neon PostgreSQL
iPhone ──> Expo/React Native ──> HealthKit (on-device) ──HTTPS──┘        │
                                                                          └─> Clerk (token verification)
```

- Web never touches HealthKit directly; mobile is the sole trusted
  on-device HealthKit bridge.
- Both clients authenticate via Clerk, send bearer tokens; the API verifies
  tokens, maps `clerk_user_id` → internal `user.id`, and scopes every query
  by that internal id. Client-supplied owner IDs in body/query are always
  ignored/rejected.

Health flow specifically:

```text
HealthKit ──> mobile sync coordinator ──> normalized daily payload
          ──> POST /v1/integrations/apple-health/reconcile
          ──> transactional UPSERT by (user_id, local_date)
```

## 4. Source-of-truth rules

| Data | Authoritative source | Notes |
|---|---|---|
| Workouts (programs/sessions/sets) | Our DB | HealthKit is not involved. |
| Imported health metrics (steps, HR, weight if imported, activity rings) | HealthKit | DB stores normalized snapshot + provenance, not raw samples. |
| Manual metrics (weight entered by user, BP, notes) | Our DB | Coexists with an imported HealthKit weight value; UI shows deterministic source precedence, never silently overwrites. |
| Nutrition (calories/macros) | MyFitnessPal → Apple Health → HealthKit read | No direct MFP integration. |

## 5. Correctness model: foreground reconciliation

Background HealthKit delivery is a freshness optimization only. Every
meaningful mobile foreground event must:

1. Refresh **today** (always partial until the local day ends).
2. Fully re-query **yesterday** until queried after that day ended, then
   mark it `complete`.
3. Re-read a rolling window of the last 2–3 *completed* days (self-healing
   for late Watch/HealthKit/MFP writes).
4. Reconcile any older local date that is `missing`, `partial`, `stale`,
   `error`, or never synced (bounded backfill).
5. Send one normalized, idempotent reconciliation payload per foreground
   event; the API UPSERTs by `(user_id, local_date)`. Resending the same
   payload must not change the stored result (no delta application, ever).

This logic lives in `packages/domain` as a pure, unit-testable function
(proposed name: `getHealthSyncPlan`) so it can be tested without a device.

## 6. Time zones

Every daily record stores: `local_date` (calendar day, not UTC), the
`timezone` that defined that day, and UTC timestamps for underlying events.
This is required to handle DST, travel, and late-arriving writes correctly.
See `docs/data-model.md` and `docs/sync-algorithm.md` (Phase 8/9) for detail.

## 7. Why not GraphQL/tRPC, Redis, microservices, etc.

Per explicit product constraints: one Fastify REST API, one Postgres
database. No GraphQL, no tRPC, no Redis/Kafka/Elasticsearch/event
sourcing/CQRS/Kubernetes for MVP. A single well-indexed Postgres instance
and a purpose-built `/v1/dashboard/today` aggregate endpoint are sufficient
at this scale, and this constraint should not be revisited without a
concrete, measured need.

## 8. Decisions (2026-08-20)

1. Neon topology confirmed: one Neon project, branch-per-environment.
2. GitHub repository confirmed: `https://github.com/ksullivan91/setframe`.
3. Apple Developer Program: **not yet enrolled**. Tracked as a Phase
   7/11 blocker in `docs/dependencies.md` and `docs/adr/0001-healthkit-adapter.md`
   — recommend starting enrollment now given Apple's review isn't instant,
   but this does not block Phases 1–6.
