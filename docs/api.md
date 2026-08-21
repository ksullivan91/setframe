# Setline — API Resource Map (Phase 0 Draft)

Status: Proposed, pending review. Base path `/v1`.

All endpoints except `/v1/health` and `/v1/ready` require a valid Clerk
bearer token.

## System

```text
GET  /v1/health
GET  /v1/ready
```

## Current user

```text
GET    /v1/me
PATCH  /v1/me
```

## Exercises

```text
GET    /v1/exercises
POST   /v1/exercises
GET    /v1/exercises/:exerciseId
PATCH  /v1/exercises/:exerciseId
POST   /v1/exercises/:exerciseId/archive
GET    /v1/exercises/:exerciseId/history
GET    /v1/exercises/:exerciseId/progress
```

## Programs / day types / schedule

```text
GET    /v1/programs
POST   /v1/programs
GET    /v1/programs/:programId
PATCH  /v1/programs/:programId
POST   /v1/programs/:programId/activate
POST   /v1/programs/:programId/archive

GET    /v1/day-types
POST   /v1/day-types
GET    /v1/day-types/:dayTypeId
PATCH  /v1/day-types/:dayTypeId
DELETE /v1/day-types/:dayTypeId

POST   /v1/day-types/:dayTypeId/exercises
PATCH  /v1/day-types/:dayTypeId/exercises/:exerciseId
DELETE /v1/day-types/:dayTypeId/exercises/:exerciseId
POST   /v1/day-types/:dayTypeId/exercises/reorder

GET    /v1/programs/:programId/schedule-slots
POST   /v1/programs/:programId/schedule-slots
PATCH  /v1/programs/:programId/schedule-slots/:id
DELETE /v1/programs/:programId/schedule-slots/:id

GET    /v1/me/schedule/:date
PUT    /v1/me/schedule/:date/override
DELETE /v1/me/schedule/:date/override
```

`/v1/me/schedule/:date` resolves schedule overrides first, then falls back
to the active program's `program_schedule_slot` rows using block mode
(`cycleLengthWeeks` set) or perpetual mode (`cycleLengthWeeks` null).

## Workout sessions

```text
GET    /v1/workout-sessions
POST   /v1/workout-sessions
GET    /v1/workout-sessions/:sessionId   // includes nested exercises[] + sets[]
PATCH  /v1/workout-sessions/:sessionId
POST   /v1/workout-sessions/:sessionId/complete

POST   /v1/workout-sessions/:sessionId/exercises
PATCH  /v1/workout-exercise-logs/:id

POST   /v1/workout-exercise-logs/:exerciseLogId/sets
PATCH  /v1/workout-sets/:setId
DELETE /v1/workout-sets/:setId
POST   /v1/workout-exercise-logs/:exerciseLogId/sets/reorder
```

`POST /v1/workout-sessions` with a `templateId` pre-populates each
exercise's sets from its planned `prescription` (sets/reps, top+backoff
split, timed, distance, duration) — set type and target reps/duration/
distance are filled in, weight is left blank for the user to log. Extra
sets (e.g. an additional PR-chase set) can still be added freely via
`POST .../sets`.


## Daily manual inputs

```text
GET    /v1/daily/:localDate
PATCH  /v1/me/daily-entries/:localDate
```

Patch payload may include `morningWeightValue`, `morningWeightUnit`,
`systolicBp`, `diastolicBp`, `notes` (journal text), `mood`, and
`preWorkoutMealLogged`.

## Dashboard aggregate

```text
GET  /v1/dashboard/today
```

Resolves schedule overrides before fallback scheduling and returns the
planned day type name as `dayLabel`, its id as `dayTypeId`, plus estimated duration.

## Progress

```text
GET  /v1/progress/consistency
```

## Notification preferences

```text
GET    /v1/me/notification-preferences
PATCH  /v1/me/notification-preferences
```

## Apple Health integration

```text
GET   /v1/integrations/apple-health/sync-state
POST  /v1/integrations/apple-health/reconcile
```


### Workout set payloads

`POST /v1/workout-exercise-logs/:exerciseLogId/sets` accepts `setType` (`warmup|working|top|backoff|drop|failure`, default `working`) alongside weight/reps/RPE fields. `PATCH /v1/workout-sets/:setId` may update `setType` too. Responses always include `setType`.

PR flags are computed server-side on create/update for completed historical sets of the same exercise and user. Only `working`, `top`, and `backoff` sets are eligible; warmup/drop/failure sets never receive PR badges. `isPrWeight` marks a new all-time heaviest logged set, and `isPrReps` marks a new all-time rep best at that weight or heavier.
