# GitHub Copilot CLI Build Prompt — Multi-User Fitness Training + Health Sync Platform

You are GitHub Copilot CLI acting as the senior staff engineer, application architect, database designer, DevOps engineer, QA engineer, and implementation partner for this repository.

Your task is to design and build a production-capable MVP for an unnamed fitness application. Do not invent a permanent product name. Use a neutral internal placeholder such as `fitness-app` until a product name is chosen.

The product exists to replace a collection of spreadsheets and fragmented fitness apps with one flexible system that:

1. Stores training programs and workout plans.
2. Lets users log the exact workout they actually performed, including a variable number of sets and reps.
3. Tracks daily measurements such as body weight and blood pressure.
4. Pulls activity, Apple Watch/Fitness data, body measurements, and nutrition data from Apple Health/HealthKit.
5. Uses Apple Health as the MVP integration path for MyFitnessPal nutrition data. MyFitnessPal already writes the target user's calories, macros, and nutrients into Apple Health, so there is NO direct MyFitnessPal API integration in MVP.
6. Reconciles and validates daily health records whenever the mobile app opens.
7. Backfills missed days when the user has not opened the mobile application.
8. Supports multiple users securely from day one.
9. Exposes one clean HTTP API used by BOTH a React web application and a React Native iOS/mobile application.
10. Can scale beyond a single user without redesigning the core architecture.

The user strongly prefers TypeScript. Keep TypeScript end-to-end.

---

# 1. NON-NEGOTIABLE PRODUCT PRINCIPLES

## 1.1 Plan versus reality
A workout template represents what the user INTENDS to do. A workout session represents what the user ACTUALLY did. Do not overwrite historical workout-session data when a template changes.

## 1.2 Sets are independent records
Never model workout sets as rigid columns (`set1Weight`, `set1Reps`, etc.). Model `WorkoutSession -> WorkoutExerciseLog -> WorkoutSet[]`. A user may do 2 sets this week and 5 sets next week with no schema change.

## 1.3 History must be preserved
Changing exercise order, target reps/sets, progression rules, substitutions, or program structure must not rewrite old sessions. Store snapshots needed to reconstruct the session as performed.

## 1.4 Manual entry only when import is not reliable
Manual-first: workout load/reps, optional RIR/RPE, workout notes, blood pressure if not in HealthKit, optional manual body weight. Imported when available: weight, steps, distance, active energy, exercise/stand minutes, heart metrics, VO2 max, Apple activity summaries/rings, nutrition/macros written to HealthKit by MyFitnessPal, and sleep if useful.

## 1.5 Apple Health is the MVP integration hub
Do not build a private MyFitnessPal integration, scrape apps, reverse-engineer MyFitnessPal endpoints, or scrape Apple Fitness. Use HealthKit. Apple Fitness/Activity data should be read through HealthKit activity summaries and related types.

## 1.6 Foreground reconciliation is the correctness mechanism
Background sync is best-effort freshness. Every meaningful mobile launch/foreground event must trigger reconciliation and repair missed/partial data.

## 1.7 Daily data can be correct-so-far but incomplete
Do not use only `isValid`. Use explicit state such as `partial`, `complete`, `stale`, `unavailable`, `error`. A noon snapshot is partial even if numerically correct at noon; the next day, re-query the full prior local day and mark it complete only after successful post-day reconciliation.

## 1.8 Reconciliation is idempotent
Never send deltas like “add 1,000 steps.” Send authoritative normalized totals for a local day and UPSERT them. Repeating the same sync must leave the same final state.

## 1.9 Time zones are first-class
Daily health data is based on local calendar days, not UTC day boundaries. Store local date, timezone defining that day, and UTC timestamps. Handle DST, travel, timezone changes, and late-written data.

---

# 2. TARGET TECHNOLOGY STACK

Use this architecture unless current official docs show a blocking incompatibility. Verify latest stable package versions before installing; do not copy versions from old posts.

## Repository
- npm workspaces
- Turborepo
- TypeScript
- single GitHub repository

Suggested structure:

```text
fitness-app/
  apps/
    api/
    web/
    mobile/
  packages/
    api-client/
    domain/
    schemas/
    database/
    config/
    design-tokens/
  docs/
  scripts/
  .github/workflows/
  package.json
  turbo.json
  tsconfig.base.json
  README.md
```

Share schemas, API client/types, domain/progression logic, constants, formatting utilities, and design tokens. Keep React DOM and React Native UI implementations separate unless sharing is genuinely ergonomic.

## Web
Use React, TypeScript, Vite, React Router, TanStack Query, styled-components, React Hook Form, Zod, Vitest, Testing Library, MSW. Do not use CRA/react-scripts, Yarn, Next.js, or server actions. Use npm.

## Mobile
Use React Native, Expo, TypeScript, Expo Router, TanStack Query, React Hook Form, Zod, Clerk Expo SDK, `expo-secure-store`, Expo Development Builds/EAS. This app requires native HealthKit, so do not design around Expo Go.

If selecting a HealthKit library, verify maintenance, Expo development-build compatibility, activity summary support, statistics queries, authorization, provenance, observer queries, and background delivery. If no wrapper meets requirements, create a small Swift bridge using Expo Modules API.

Hide native HealthKit behind a TypeScript adapter:

```ts
interface HealthDataProvider {
  requestAuthorization(): Promise<HealthAuthorizationResult>;
  getDailySnapshot(input: DailyHealthQuery): Promise<NormalizedDailyHealthSnapshot>;
  getDailySnapshots(input: DailyHealthRangeQuery): Promise<NormalizedDailyHealthSnapshot[]>;
  getActivitySummaries(input: DateRangeQuery): Promise<NormalizedActivitySummary[]>;
  configureBackgroundDelivery(): Promise<void>;
}
```

## Backend
Use Node.js, TypeScript, Fastify, Zod, a supported Fastify/Zod type provider, OpenAPI, Drizzle ORM, PostgreSQL. REST API shared by web and mobile. Do not use GraphQL or tRPC for MVP.

## Database
Use PostgreSQL hosted on Neon, Drizzle ORM, Drizzle Kit migrations. Local development can use Docker PostgreSQL or a dedicated Neon dev DB/branch; choose the simplest repeatable setup and document it. Migrations must be checked into source control. Never use destructive schema push automatically in production.

## Authentication
Use Clerk. Web via current Clerk React/Vite guidance; mobile via current Clerk Expo guidance; API verifies bearer tokens. Map Clerk user ID to an internal application user. Never trust a user ID from request body/query for ownership.

## Hosting
- Web: Cloudflare Pages
- API: Railway
- DB: Neon PostgreSQL
- Auth: Clerk
- Mobile builds/distribution: Expo EAS; iOS through TestFlight/App Store when ready
- Object storage: not required for MVP; if later needed, prefer Cloudflare R2 after validating need

---

# 3. DEPLOYMENT TOPOLOGY

```text
Browser -> Cloudflare Pages -> React/Vite SPA -> HTTPS REST API

iPhone -> React Native/Expo -> HealthKit on device -> HTTPS REST API

REST API -> Railway/Fastify -> Neon PostgreSQL
                       \-> Clerk token verification
```

Web never accesses HealthKit directly. Mobile is the trusted on-device bridge. Clients authenticate with Clerk, send bearer tokens, API verifies token, maps to internal user, and enforces ownership.

Health flow:

```text
HealthKit -> mobile sync coordinator -> normalized daily payload -> API reconcile -> database UPSERT
```

---

# 4. SOURCE-OF-TRUTH RULES

- Workout data: our DB authoritative.
- HealthKit imported metrics: HealthKit authoritative; DB stores normalized snapshots/provenance.
- Manual metrics: our DB authoritative.
- Nutrition MVP: MyFitnessPal -> Apple Health/HealthKit -> mobile -> API/DB. No direct MFP API.

User has explicitly confirmed MyFitnessPal nutrients, calories, and macros are visible in Apple Health.

At minimum support HealthKit equivalents for energy consumed, protein, carbohydrates, total fat, fiber. Investigate and support when available: saturated fat, sugar, sodium, potassium, cholesterol, and useful additional nutrients. Missing/unauthorized should be `null`/unavailable, not zero.

---

# 5. HEALTHKIT PRIVACY + PERMISSIONS

Health data is sensitive. Follow Apple HealthKit rules and least privilege. Request only data types used by MVP. Do not interpret no returned data as definitive proof that read permission was denied because HealthKit deliberately limits permission disclosure.

Gracefully handle:
- authorized + populated
- authorized but no data
- not granted
- limited historical access
- HealthKit unavailable
- permission/action required
- upstream source stopped writing a metric

Do not upload raw HealthKit data not needed by product. Prefer daily aggregates for dashboard. Do not log tokens or raw production health payloads. Create `docs/health-data-privacy.md`.

---

# 6. HEALTH DATA MVP FIELDS

Activity:
- steps
- walking/running distance
- active energy burned
- exercise minutes
- stand minutes
- flights climbed if useful

Activity summary/rings:
- move actual + goal
- exercise actual + goal
- stand actual + goal
- move mode/unit if needed

Heart/fitness:
- resting HR
- walking HR average
- HRV SDNN
- VO2 max

Body:
- weight
- optional body fat/lean mass if available and authorized

Sleep:
- daily total if reliable; do not block MVP if sleep semantics need extra work

Nutrition:
- calories
- protein g
- carbs g
- fat g
- fiber g
- optional nutrients above

Preserve source/provenance where practical.

---

# 7. HEALTH SYNC MODEL

## Integration sync state
Design roughly:

```text
integration_sync_state
- id
- user_id
- integration_type ('apple_health')
- last_attempt_at
- last_success_at
- latest_complete_local_date
- last_foreground_reconciliation_at
- last_background_reconciliation_at
- status
- last_error_code
- last_error_message_redacted
- created_at
- updated_at
```

Do not model MyFitnessPal as direct integration in MVP.

## Daily snapshot(s)
Use strongly typed MVP columns, not generic EAV. Consider separation into `daily_health_snapshot`, `daily_nutrition_snapshot`, and `daily_activity_summary` if it improves clarity. Avoid both a giant unmaintainable table and premature key/value modeling.

Each snapshot should include:
- user_id
- local_date
- timezone
- sync_status
- synced_through
- reconciled_at
- metric values
- source/provenance metadata where practical
- created_at/updated_at

## Completeness algorithm
Implement a deterministic pure domain function such as `getHealthSyncPlan`.

Rules:
1. Today is refreshed on foreground and remains partial until local day ends.
2. Yesterday is refreshed until successfully queried after that day ended; then complete.
3. Always re-read previous 2–3 completed days as a self-healing rolling window for late HealthKit/Watch/MFP backfill.
4. Older dates are reconciled if missing, partial, stale, failed, or never synced.
5. If user skipped N days, query all missing/incomplete local dates up to today; past dates become complete after full-day reconciliation, today remains partial.
6. Sync is idempotent.
7. Server receives normalized absolute totals and UPSERTS them.

Example: Aug 19 was partial and last synced at noon; app opens Aug 20 7 AM. Re-read Aug 17/18 within rolling window, full Aug 19, and Aug 20 midnight->now. Send one normalized reconciliation payload. Past days complete, today partial.

## Background delivery
Configure HealthKit observer/background delivery where supported, but treat it as freshness optimization. Foreground reconciliation is the correctness fallback. Observer handlers should be lightweight, trigger targeted reconciliation, call completion handlers correctly, and tolerate iOS constraints. Real-device testing required.

---

# 8. WORKOUT DOMAIN MODEL

Suggested entities:

## User
- id
- clerk_user_id unique
- display_name
- preferred_units
- timezone
- timestamps

## Exercise
- id
- name
- canonical_slug
- movement_pattern nullable
- equipment nullable
- muscle metadata nullable
- is_system
- created_by_user_id nullable
- archived_at nullable
- timestamps

Support global/system exercises and user custom exercises.

## TrainingProgram
- id
- user_id
- name
- description
- is_active
- start_date nullable
- archived_at nullable
- timestamps

## ProgramVersion
Prefer explicit versioning if it stays ergonomic:
- id
- training_program_id
- version_number
- effective_from
- effective_to nullable
- notes
- created_at

If explicit versioning is too much UI for MVP, preserve immutable/snapshot historical semantics internally anyway.

## WorkoutTemplate
- id
- program/version FK
- name
- day_label
- sort_order
- description
- timestamps

## WorkoutTemplateExercise
- id
- template_id
- exercise_id
- sort_order
- prescription
- progression_rule_id nullable
- notes

Prescription must support:
- 4x4–6
- 3x8–12
- 1 top set 4–6 + 2 backoffs 6–10
- 3x8 per leg
- timed carries
- bodyweight reps
- distance
- duration

Do not force every exercise into weight+reps.

## WorkoutSession
- id
- user_id
- template_id nullable
- program_id nullable
- local_date
- timezone
- started_at
- completed_at nullable
- status planned/in_progress/completed/abandoned
- session_name_snapshot
- notes
- timestamps

## WorkoutExerciseLog
- id
- session_id
- exercise_id
- exercise_name_snapshot
- sort_order
- prescription_snapshot (JSONB or typed snapshot)
- notes
- skipped
- timestamps

## WorkoutSet
- id
- exercise_log_id
- stable client-generated UUID/idempotency identity
- sort_order
- set_type
- load_value nullable
- load_unit nullable
- reps nullable
- duration_seconds nullable
- distance_value nullable
- distance_unit nullable
- rir nullable
- rpe nullable
- side nullable
- completed
- notes nullable
- timestamps

Set types can include warmup, working, top, backoff, drop, failure, bodyweight, timed, distance. Support unilateral, assisted pullups, carries, warmups, arbitrary extra sets, and skipped planned work.

---

# 9. PROGRESSION DOMAIN

Progression belongs in `packages/domain`, not React or route handlers.

Potential functions:
- calculateVolume
- estimateOneRepMax
- detectWeightPR
- detectRepPR
- getPreviousExercisePerformance
- evaluateDoubleProgression
- buildSuggestedNextTarget

MVP progression rules:
- manual
- double progression
- linear

Suggestions must be explainable, editable, and never forced. No AI coach in MVP.

---

# 10. DAILY USER INPUTS

Manual inputs:
- morning weight
- systolic BP
- diastolic BP
- notes
- optional waist later

Manual and imported values must coexist with provenance rather than silently overwrite. Define deterministic source precedence. A deliberate manual body-weight entry may be preferred in UI while imported HealthKit value remains preserved.

---

# 11. API DESIGN

Base `/v1`.

Suggested resources:

```text
GET /v1/health
GET /v1/ready

GET/PATCH /v1/me

GET/POST /v1/exercises
GET/PATCH /v1/exercises/:exerciseId
DELETE-or-archive /v1/exercises/:exerciseId

GET/POST /v1/programs
GET/PATCH /v1/programs/:programId
POST /v1/programs/:programId/activate
POST /v1/programs/:programId/archive

GET/POST /v1/programs/:programId/workouts
GET/PATCH /v1/workout-templates/:templateId
POST /v1/workout-templates/:templateId/exercises
PATCH/DELETE /v1/workout-template-exercises/:id
POST /v1/workout-templates/:templateId/reorder

GET/POST /v1/workout-sessions
GET/PATCH /v1/workout-sessions/:sessionId
POST /v1/workout-sessions/:sessionId/complete
POST /v1/workout-sessions/:sessionId/exercises
PATCH /v1/workout-exercise-logs/:id

POST /v1/workout-exercise-logs/:exerciseLogId/sets
PATCH/DELETE /v1/workout-sets/:setId
POST /v1/workout-exercise-logs/:exerciseLogId/sets/reorder

GET /v1/exercises/:exerciseId/history
GET /v1/exercises/:exerciseId/progress
GET /v1/dashboard/today

GET /v1/daily/:localDate
PUT/PATCH /v1/daily/:localDate/body-weight
PUT/PATCH /v1/daily/:localDate/blood-pressure
PUT/PATCH /v1/daily/:localDate/notes

GET /v1/integrations/apple-health/sync-state
POST /v1/integrations/apple-health/reconcile
```

Reconcile accepts array of normalized days. API must authenticate, validate with Zod, reject/ignore client owner IDs, transactionally UPSERT by authenticated user + local date, enforce completeness rules, update sync metadata, and return sync state.

---

# 12. OPENAPI + SHARED CLIENT

Generate valid OpenAPI from Fastify route schemas. Expose JSON spec in dev/staging. Generate or maintain a typed TS API client in `packages/api-client`, consumed by web and mobile. Do not hand-write two request layers.

Use a current stable OpenAPI TypeScript client generator after checking official docs. Add CI stale-client detection if practical.

---

# 13. UX INFORMATION ARCHITECTURE

Primary thesis: “What am I doing today, and what do I need to enter?”

Web nav: Today, Training, History, Progress, Settings.
Mobile tabs: Today, Training, Progress, Settings.

## Today screen
Show:
- date
- planned workout/recovery day
- start/resume CTA
- morning weight
- blood pressure if entered
- calories/macros from HealthKit
- steps
- active calories
- exercise minutes
- ring/activity summary where useful
- last sync state
- unobtrusive “Updating health data…” during reconciliation

Render cached server data immediately, reconcile in background, update reactively. If HealthKit needs attention, provide actionable status rather than generic failure.

## Workout logging
Must be exceptional. Show target prescription + last performance + optional suggestion. Use inline editable set rows; no modal per set. Mobile should use numeric keyboard, next-field navigation, quick completion, add/remove/reorder, duplicate previous set. Rest timer is not MVP.

Allow deviations without rewriting template:
- ad hoc exercise
- extra sets
- removed set
- skipped exercise
- session reorder
- notes
- complete workout anyway

## Exercise history
Show recent sessions, set details, top-set trend, PRs, estimated 1RM where meaningful, volume. Keep charts restrained.

## Program editor
Create program, weekly/day sequence, workouts, exercises, reorder, prescriptions, progression rule, activation. Web can be richer; mobile may have lighter editing initially.

---

# 14. WEB DESIGN REQUIREMENTS

Use styled-components, semantic HTML, WCAG-conscious interactions, keyboard usability, clear focus, responsive layout. Avoid spreadsheet-looking primary UX, dense enterprise tables, card nesting, tiny targets, inaccessible icons. Avoid JSX `{condition && <Component />}` where practical; prefer explicit ternaries/early returns/extracted components. Use neutral polished design tokens until branding exists.

---

# 15. MOBILE UX + OFFLINE

Optimize for one-handed gym use. Large targets, minimal taps, numeric entry, preserve in-progress session on backgrounding, do not lose data on network issues.

MVP offline strategy:
- stable client-generated IDs
- persist in-progress workout locally
- retry failed writes
- idempotent create semantics
- no full CRDT required
- HealthKit reconciliation payload can be queued and retried when network returns

---

# 16. STATE MANAGEMENT

TanStack Query for server state. Avoid Redux unless a concrete need emerges. Local state/context for ephemeral UI; RHF for forms; Zod for validation. Do not duplicate server state into global stores without reason.

---

# 17. DATABASE OWNERSHIP + SECURITY

Every user-owned table has ownership path. Never query by record ID alone; scope by authenticated internal user ID. Add unique constraints and useful indexes, including `(user_id, local_date)` snapshots, `(user_id, integration_type)` sync state, exercise/session history, active program lookups. Use UUID/ULID consistently; client UUIDs useful for mobile retries.

---

# 18. API SECURITY

Implement Clerk token verification, CORS allowlist, security headers, request size limits, sensible rate limiting, Zod validation, structured errors, no stack traces in production, health endpoints, graceful shutdown, redacted structured logging. Never log bearer tokens, Clerk secrets, DB credentials, or raw health sync bodies.

---

# 19. OBSERVABILITY

Use Fastify/Pino ecosystem structured logging. Include request ID, safe internal user ID if appropriate, route, status, latency. Health sync logs may include date range/count/status but not metric values. Add `/v1/health` and `/v1/ready`. No paid observability stack required for MVP.

---

# 20. TESTING

## Domain — Vitest
Test progression, volume, 1RM, PRs, sync planning, completeness transitions, timezone windows, backfill, idempotency, source precedence.

## API
Use Fastify injection where practical. Test unauthorized access, ownership isolation, validation, variable set count, arbitrary add/remove, historical immutability after template changes, health reconcile, multi-day UPSERT, partial/complete behavior, duplicate payload idempotency, malicious owner ID rejection, DB constraints. Use isolated test PostgreSQL; never production Neon.

## Web
Vitest + Testing Library + MSW. Test protected routes, Today, workout logger, add/remove set, previous performance, finish workout, program basics, sync status.

## Mobile
Test shared logic heavily. Use current recommended RN testing stack for UI. Fake `HealthDataProvider` for sync coordinator tests. Real HealthKit validation on physical iPhone.

## E2E
Add Playwright for critical web flows once core stabilizes: sign in, create program, start workout, add sets, complete, history. Mobile E2E can follow later.

---

# 21. CI/CD

GitHub Actions PR pipeline:
1. checkout
2. supported Node LTS
3. `npm ci`
4. lint
5. typecheck
6. unit tests
7. API tests
8. web tests
9. build packages
10. build API
11. build web
12. validate OpenAPI
13. verify generated API client freshness if committed

No production deploy from PR.

Main:
- Cloudflare Pages GitHub integration can deploy web
- Railway GitHub integration can deploy API
- migrations must run safely before incompatible app code becomes live

Use committed Drizzle migrations. Never production `push`. Prefer a pre-deploy/release migration command; document rollback.

---

# 22. ENVIRONMENT MANAGEMENT

Create `.env.example` and a Zod-based typed environment parser.

API likely:
- NODE_ENV
- PORT
- DATABASE_URL
- CLERK_SECRET_KEY / current verification config
- WEB_ORIGIN
- LOG_LEVEL

Web:
- VITE_API_BASE_URL
- VITE_CLERK_PUBLISHABLE_KEY

Mobile:
- EXPO_PUBLIC_API_BASE_URL
- EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

Never place secrets in `VITE_*` or `EXPO_PUBLIC_*`; they are public client configuration. Do not commit `.env`.

---

# 23. LOCAL DEVELOPMENT

Provide root scripts similar to:

```text
npm run dev
npm run dev:web
npm run dev:api
npm run dev:mobile
npm run build
npm run test
npm run test:unit
npm run test:web
npm run test:api
npm run lint
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:studio
npm run api:openapi
npm run api:generate-client
```

Document clone -> install -> env -> DB -> migrate -> API -> web -> Expo development build -> HealthKit physical device.

---

# 24. HEALTHKIT IMPLEMENTATION SPIKE

Before production integration code, create `docs/adr/0001-healthkit-adapter.md`.

Evaluate current HealthKit React Native options against:
- maintenance
- latest iOS support
- Expo development builds
- authorization
- statistics collection
- activity summaries
- provenance
- observer/background delivery
- TypeScript quality
- extensibility

Do not silently choose a random npm wrapper. If wrappers lack required APIs, own a small Swift module through Expo Modules API.

Normalize native types at the boundary; UI/domain should not depend on `HKQuantity`/`HKSample` types.

Mapping:

```text
HealthKit native -> adapter DTO -> normalized TS health model -> API reconciliation DTO
```

For MFP nutrition, inspect source metadata, confirm MFP values can be read, compare at least one full day to Apple Health UI, validate calories/protein/carbs/fat/fiber, and document test results. Do not assume raw aggregation options match Apple Health UI without testing.

---

# 25. HEALTH SYNC VALIDATION MATRIX

Test:
1. 6 AM open -> today partial.
2. Noon open -> today refreshed partial.
3. 10 PM open -> refreshed partial.
4. No more opens -> next-day launch full prior-day refresh -> complete.
5. Five-day gap -> backfill all missing past days, today partial.
6. Watch syncs late -> rolling 3-day reconciliation updates prior completed day.
7. MFP writes nutrition late -> rolling reconciliation updates it.
8. Timezone travel -> deterministic local-day semantics, no duplicates/missing day.
9. Network unavailable -> local HealthKit read can complete, upload queued, idempotent retry.
10. HealthKit access removed -> no crash; clear state within privacy semantics.
11. Same reconciliation payload twice -> same DB state.
12. Background partially succeeds -> foreground repair completes.

---

# 26. MVP SCOPE

Must have:
- auth + multi-user isolation
- programs/templates/exercises/prescriptions
- workout execution with variable sets and deviations
- previous performance
- daily weight and BP manual input
- HealthKit authorization + activity + rings/summary + core heart/fitness + weight + MFP nutrition
- foreground reconciliation + missed-day backfill + rolling revalidation + sync status + best-effort background delivery
- workout/exercise/body-weight history
- PR/basic progression
- production web/API/DB/auth deployment + EAS dev build + documented TestFlight path

Not MVP unless trivial:
- AI coach
- social
- trainer marketplace
- billing
- Android Health Connect
- direct Garmin/Fitbit/MFP
- meal logging/food DB
- photo/video storage
- advanced periodization
- organizations
- public sharing
- chat

---

# 27. IMPLEMENTATION PHASES

Do not generate everything in one uncontrolled pass. After each phase run tests/typecheck/build and update docs.

Phase 0: research + ADRs (architecture, HealthKit, auth, hosting, data model)
Phase 1: monorepo foundation
Phase 2: DB + auth + `/v1/me`
Phase 3: exercise/program/template domain + web editor
Phase 4: workout session domain + excellent web logger
Phase 5: shared OpenAPI client
Phase 6: mobile baseline + auth/API/Today/workout/local persistence
Phase 7: HealthKit physical-device spike
Phase 8: production health reconciliation/backfill/sync state
Phase 9: background delivery
Phase 10: history/progress
Phase 11: production deployment + smoke tests

---

# 28. DATABASE MIGRATION PLAN

Separate dev/test/prod. Use committed Drizzle migrations. Production: migration in PR, review, merge, migration step, API deploy, readiness check. For breaking changes use expand/contract. Never let local tests touch prod. Never combine destructive migration and incompatible deploy recklessly.

---

# 29. DETAILED DEPLOYMENT DOCUMENTATION REQUIRED

Create `docs/deployment.md` with exact current steps.

## Neon
- create project + production DB
- choose current Drizzle/Neon recommended connection strategy
- set DATABASE_URL in Railway
- migrations
- TLS
- dev/test isolation
- backup/recovery notes

## Railway API
- create project
- connect GitHub repo
- point service at API workspace/monorepo config
- build/start commands
- variables
- Fastify listens on `process.env.PORT` and `0.0.0.0`
- health/readiness
- generated/custom domain
- logs
- safe migration command
- authenticated smoke test

## Cloudflare Pages
- connect GitHub
- main production branch
- monorepo web build command
- output `dist`
- set public Vite env
- SPA routing
- custom domain if available
- API CORS allowlist
- Clerk production origins/redirects
- ensure preview builds do not receive unintended prod secrets

## Clerk
- dev instance
- sign-in methods
- web config
- Expo native config
- Native API if current docs require it
- secure mobile redirects
- production instance/domain
- iOS bundle ID/Team ID where required
- allowlists
- API token verification
- multi-user isolation test

## Expo/EAS
- expo-dev-client
- EAS CLI/config
- `eas.json` with development/preview/production
- iOS bundle ID
- Apple developer account requirements
- HealthKit entitlement
- background-delivery entitlement
- purpose strings
- Clerk native config
- development build on physical iPhone
- HealthKit test
- preview
- production archive
- TestFlight
- eventual App Store

Do not promise HealthKit background behavior based on simulator.

---

# 30. DEPLOYMENT ENVIRONMENTS

Development: localhost web/API, dev DB, Clerk dev, Expo dev build.
Preview: Cloudflare preview; do not unintentionally expose prod API secrets; API preview optional MVP.
Production: Cloudflare web, Railway API, Neon DB, Clerk prod, EAS/App Store mobile.

---

# 31. DOCUMENTATION FILES

Create:

```text
README.md
docs/architecture.md
docs/data-model.md
docs/api.md
docs/deployment.md
docs/local-development.md
docs/healthkit.md
docs/health-data-privacy.md
docs/sync-algorithm.md
docs/testing.md
docs/adr/0001-healthkit-adapter.md
docs/adr/0002-auth-clerk.md
docs/adr/0003-rest-openapi.md
docs/adr/0004-hosting.md
docs/adr/0005-workout-template-session-separation.md
```

README includes product purpose, architecture diagram, repo layout, setup, scripts, deployment placeholders, HealthKit privacy warning.

---

# 32. CODE QUALITY

- TypeScript strict
- no `any` unless unavoidable/documented
- domain-specific types
- no giant god services
- no business logic in route handlers or React components
- dependency interfaces where they improve testability
- avoid abstraction for abstraction's sake
- structured errors
- validate boundaries
- prefer composition
- Prettier
- Husky/lint-staged optional if useful

---

# 33. DATA DELETION + PRIVACY

Design account deletion feasibility. User-owned workout/health data must be deletable. Document Clerk + DB deletion workflow and retention policy. No need for polished deletion UI in first pass if it delays core MVP, but schema/ownership must make deletion straightforward.

---

# 34. PERFORMANCE

Do not add Redis, Kafka, microservices, Elasticsearch, event sourcing, CQRS, or Kubernetes. Postgres + one API service is enough. Paginate histories. Prefer a purpose-built `/v1/dashboard/today` endpoint over many serial requests. Index user/exercise/date queries.

---

# 35. MULTI-USER SCALE

Build user-scoped ownership now. Future organizations/coach relationships/shared programs are possible later but not MVP. No singleton user, no global current workout.

---

# 36. MVP ACCEPTANCE CRITERIA

A new user can:
1. create account
2. sign in web/mobile
3. create program
4. create workout templates
5. add exercises
6. configure flexible prescriptions
7. start workout
8. see previous performance
9. log arbitrary set counts
10. add/remove sets without schema changes
11. finish workout
12. see history
13. change future template without altering old sessions
14. enter weight
15. enter BP
16. grant Apple Health permission
17. sync activity
18. sync Watch/Fitness activity summary
19. sync weight if available
20. sync MFP nutrition through HealthKit
21. close before day ends
22. reopen next day
23. see prior day re-reconciled and complete
24. skip several days
25. reopen and see missed dates backfilled
26. see current day partial
27. resend reconciliation safely with no double-counting
28. view synced health data on web
29. verify second user cannot access first user's records
30. deploy web/API/DB/auth/mobile dev build successfully from docs

---

# 37. SOURCE MANIFEST — CONSULT OFFICIAL DOCS

## Apple HealthKit
https://developer.apple.com/documentation/healthkit/
https://developer.apple.com/documentation/Xcode/configuring-healthkit-access
https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
https://developer.apple.com/documentation/healthkit/reading-data-from-healthkit
https://developer.apple.com/documentation/healthkit/hkhealthstore
https://developer.apple.com/documentation/healthkit/hkactivitysummary
https://developer.apple.com/documentation/healthkit/hkactivitysummaryquery
https://developer.apple.com/documentation/healthkit/executing-activity-summary-queries
https://developer.apple.com/documentation/healthkit/hkobserverquery
https://developer.apple.com/documentation/healthkit/executing-observer-queries
https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery
https://developer.apple.com/documentation/healthkit/hkhealthstore/enablebackgrounddelivery(for:frequency:withcompletion:)
https://developer.apple.com/documentation/healthkit/workouts-and-activity-rings

## Expo / React Native
https://docs.expo.dev/
https://docs.expo.dev/develop/development-builds/introduction/
https://docs.expo.dev/develop/development-builds/faq/
https://docs.expo.dev/tutorial/eas/configure-development-build/
https://docs.expo.dev/workflow/customizing/
https://docs.expo.dev/modules/overview/
https://docs.expo.dev/build/introduction/
https://docs.expo.dev/submit/introduction/
https://docs.expo.dev/router/introduction/

## Clerk
https://clerk.com/docs
https://clerk.com/docs/react/getting-started/quickstart
https://clerk.com/docs/expo/getting-started/quickstart
https://clerk.com/docs/guides/development/deployment/expo
https://clerk.com/docs/react/guides/ai/prompts

## Fastify
https://fastify.dev/docs/latest/
https://fastify.dev/docs/latest/Reference/TypeScript/
https://fastify.dev/docs/latest/Reference/Type-Providers/
https://fastify.dev/ecosystem/
https://github.com/fastify/fastify-swagger
https://github.com/fastify/fastify-swagger-ui

## Drizzle + Neon
https://orm.drizzle.team/docs/overview
https://orm.drizzle.team/docs/get-started/neon-new
https://orm.drizzle.team/docs/get-started/neon-existing
https://orm.drizzle.team/docs/tutorials/drizzle-with-neon
https://neon.com/docs

## Railway
https://docs.railway.com/
https://docs.railway.com/services
https://docs.railway.com/variables
https://docs.railway.com/variables/reference
https://docs.railway.com/guides/express
https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime
https://docs.railway.com/cli/deploy
https://docs.railway.com/quick-start

## Cloudflare Pages
https://developers.cloudflare.com/pages/
https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
https://developers.cloudflare.com/pages/configuration/

## Vite / Vitest
https://vite.dev/guide/
https://vitest.dev/guide/

## TanStack Query
https://tanstack.com/query/latest/docs/framework/react/overview
https://tanstack.com/query/latest/docs/framework/react/react-native

## React Hook Form
https://react-hook-form.com/get-started

## Zod
https://zod.dev/

## styled-components
https://styled-components.com/docs

## React Router
https://reactrouter.com/

## Turborepo
https://turborepo.com/docs

## npm workspaces
https://docs.npmjs.com/cli/using-npm/workspaces

## GitHub Actions
https://docs.github.com/actions

---

# 38. SOURCE USAGE RULES

Before implementing a subsystem:
1. read current official docs
2. confirm APIs/package names are current
3. prefer official docs over old blogs/StackOverflow
4. record architecture decisions in ADRs
5. if this prompt conflicts with current official docs, document discrepancy, propose smallest architecture-preserving change, and follow current official behavior

HealthKit: Apple docs authoritative; real-device testing mandatory for background delivery. If a wrapper conflicts with required capability, replace/extend wrapper rather than weakening requirements.

---

# 39. FIRST TASKS FOR COPILOT CLI

Start by doing ONLY:
1. inspect current repo
2. if empty, initialize monorepo skeleton
3. create architecture/data-model/sync/deployment docs + ADR skeletons
4. propose dependency list using latest stable versions verified from official docs
5. propose SQL/Drizzle entity diagram
6. propose API resource map
7. create detailed phase checklist
8. identify HealthKit bridging uncertainty
9. do not choose random HealthKit package
10. research HealthKit options and create ADR first
11. then scaffold Phase 1
12. run lint/typecheck/tests/builds
13. report failures
14. do not claim phase complete until checks pass

Do not create fake production implementations that silently return hardcoded data. For native features not yet wired, create explicit interface + clearly named fake provider for development/tests.

---

# 40. PHASE REPORT FORMAT

After each phase report:

## Completed
## Architecture decisions
## Files added/changed
## Commands run
## Test results
- lint
- typecheck
- unit/API/web/mobile tests
- build
## Remaining risks
## Next phase

Do not drift into unrelated scope.

---

# 41. ARCHITECTURAL NORTH STAR

This is not another workout spreadsheet. It is a flexible training system where the program describes intent, the session stores reality, sets scale dynamically, history is permanent, Apple Health removes duplicate manual entry, MyFitnessPal nutrition flows through HealthKit, mobile is the trusted bridge to on-device data, the API is the shared contract, web/mobile are independent clients, daily snapshots self-heal through reconciliation, the DB is securely multi-user, and infrastructure stays inexpensive/simple for MVP.

Prioritize correctness, data ownership, UX, and maintainability over cleverness. Build the simplest architecture satisfying these constraints without painting the product into a corner.
