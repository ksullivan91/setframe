# Setline — API Resource Map (Phase 0 Draft)

Status: Proposed, pending review. Base path `/v1`. Fastify + Zod (via a
supported Fastify/Zod type provider) + OpenAPI generation. REST only (no
GraphQL/tRPC).

All endpoints except `/v1/health` and `/v1/ready` require a valid Clerk
bearer token. The API maps `clerk_user_id` → internal `user.id` on every
request and scopes all reads/writes by that internal id. Any `userId`/
`ownerId` present in a request body or query string is ignored (or
rejected with a validation error) — ownership is never taken from client
input.

## System

```text
GET  /v1/health           liveness — no auth
GET  /v1/ready            readiness (DB reachable) — no auth
```

## Current user

```text
GET    /v1/me
PATCH  /v1/me             display_name, preferred_units, timezone
```

## Exercises

```text
GET    /v1/exercises                       list system + own custom exercises
POST   /v1/exercises                       create custom exercise
GET    /v1/exercises/:exerciseId
PATCH  /v1/exercises/:exerciseId           only own custom exercises
POST   /v1/exercises/:exerciseId/archive   archive, not hard delete
GET    /v1/exercises/:exerciseId/history    recent sessions/sets for this exercise
GET    /v1/exercises/:exerciseId/progress   volume/1RM/PR trend data
```

## Programs / versions / templates

```text
GET    /v1/programs
POST   /v1/programs
GET    /v1/programs/:programId
PATCH  /v1/programs/:programId
POST   /v1/programs/:programId/activate
POST   /v1/programs/:programId/archive

GET    /v1/programs/:programId/workouts             list workout templates (current version)
POST   /v1/programs/:programId/workouts              create a workout template
GET    /v1/workout-templates/:templateId
PATCH  /v1/workout-templates/:templateId
POST   /v1/workout-templates/:templateId/reorder

POST   /v1/workout-templates/:templateId/exercises              add exercise to template
PATCH  /v1/workout-template-exercises/:id                        edit prescription/notes/order
DELETE /v1/workout-template-exercises/:id
```

## Workout sessions (plan vs. reality)

```text
GET    /v1/workout-sessions                      ?localDate=, ?status=, pagination
POST   /v1/workout-sessions                       start a session (from template or ad hoc)
GET    /v1/workout-sessions/:sessionId
PATCH  /v1/workout-sessions/:sessionId             notes, status transitions
POST   /v1/workout-sessions/:sessionId/complete

POST   /v1/workout-sessions/:sessionId/exercises   add exercise log (planned or ad hoc)
PATCH  /v1/workout-exercise-logs/:id                 notes, skipped, reorder

POST   /v1/workout-exercise-logs/:exerciseLogId/sets                 create a set (client_id required, idempotent)
PATCH  /v1/workout-sets/:setId
DELETE /v1/workout-sets/:setId
POST   /v1/workout-exercise-logs/:exerciseLogId/sets/reorder
```

## Daily manual inputs

```text
GET        /v1/daily/:localDate                     manual entry + activity + nutrition snapshot for the day
PUT/PATCH  /v1/daily/:localDate/body-weight
PUT/PATCH  /v1/daily/:localDate/blood-pressure
PUT/PATCH  /v1/daily/:localDate/notes
```

## Dashboard aggregate

```text
GET  /v1/dashboard/today
```

Purpose-built endpoint (master spec §34): today's planned/active session,
manual entries, activity + nutrition snapshot, and sync status in one
response, so the Today screen never needs several serial requests. Now
also includes the derived `weekLabel`/`dayLabel` and
`estimatedDurationMinutes` for the pre-workout preview card (see
`docs/data-model.md` §3 `training_program.cycle_length_weeks` and
`workout_template.estimated_duration_minutes`).

## Progress

```text
GET  /v1/progress/consistency   ?weeks= (default 8)
```

Read-only, computed-on-request endpoint backing the Progress screen's
"Consistency (last N weeks)" streak widget (Figma style guide §19). No
new table — derives planned-vs-completed counts per ISO week from
existing `workout_session` rows against the active `program_version`'s
templates, same pattern as the existing `estimateOneRepMax`/
`calculateVolume` domain functions. Response: array of
`{ weekStart, plannedCount, completedCount }`.

## Notification preferences

```text
GET    /v1/me/notification-preferences
PATCH  /v1/me/notification-preferences   workout_reminders_enabled, weekly_summary_enabled
```

**New scope beyond the original master spec** — backs the Settings
screen's "Workout reminders" / "Weekly progress summary" toggles (Figma
style guide §19). See `docs/data-model.md` §6.1. These endpoints persist
user *intent* only; no push delivery is implemented yet (deferred —
requires its own ADR + `expo-notifications`/APNs decision before Phase
7+ mobile work).

## Apple Health integration

```text
GET   /v1/integrations/apple-health/sync-state
POST  /v1/integrations/apple-health/reconcile
```

`reconcile` request body: an array of normalized per-local-day payloads
(activity + nutrition + provenance), each tagged with `localDate` and
`timezone`. The handler:
1. Authenticates and resolves the internal user id.
2. Validates the full payload with Zod (reject on shape mismatch).
3. Ignores/rejects any client-supplied owner id.
4. Runs one DB transaction per request: UPSERT each day into
   `daily_activity_summary` / `daily_nutrition_snapshot` keyed by
   `(user_id, local_date)`, applying the completeness rules from
   `docs/sync-algorithm.md` (Phase 8/9 doc).
5. Updates `integration_sync_state` (`last_attempt_at`, `last_success_at`,
   `latest_complete_local_date`, `status`, error fields on failure).
6. Returns the updated sync state.

Resending an identical payload must leave the database in the same final
state (idempotent UPSERT by normalized absolute totals, never deltas).

## Error shape (all endpoints)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, safe to display",
    "requestId": "..."
  }
}
```

No stack traces or internal error detail in production responses (master
spec §18).

## Decided (2026-08-20)

1. **Pagination**: cursor-based (`?cursor=`, `?limit=`) for all list
   endpoints (`/v1/workout-sessions`, `/v1/exercises/:id/history`, etc.).
   Cursor should encode `(created_at, id)` or `(local_date, id)` as
   appropriate per resource to keep ordering stable.
2. **Exercise search**: `/v1/exercises` supports `?q=` full-text search.
   Implementation: Postgres trigram search (`pg_trgm` extension + GIN
   index on `exercise.name`) for simple, fast fuzzy matching at MVP scale.
