# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Setframe is a multi-user fitness training + Apple Health sync platform: a
Fastify REST API, a React/Vite web app, and an Expo/React Native iOS app,
sharing TypeScript types end-to-end via a Zod schema package. The full
product/architecture spec is `github-copilot-fitness-app-master-prompt.md`
(36 numbered sections — non-negotiable product principles, target stack,
domain model, API design, phased implementation plan) and the design-system
spec is `setframe-branding-figma-mcp-copilot-prompt.md`. `docs/architecture.md`,
`docs/data-model.md`, `docs/api.md`, `docs/dependencies.md`, and `docs/adr/*`
are the living design record — keep them in sync with implementation
decisions as work progresses. Note some docs are stamped "Phase 0
Draft"/"Proposed" but describe what is actually implemented; check the
real schema/routes when a doc and the code disagree (e.g. `workout_template`
in `docs/data-model.md`/ADR 0005 was superseded by `day_type` — see below).

## Commands

Turborepo + npm workspaces, run from the repo root (each also works scoped
to one workspace via `--filter` or `npm run <script> --workspace=<name>`):

```bash
npm run dev         # turbo run dev (all apps, persistent/uncached)
npm run build        # turbo run build
npm run lint          # turbo run lint (web + mobile only; no root eslint config)
npm run test           # turbo run test
npm run typecheck       # turbo run typecheck
```

Single test file / single test, per workspace (vitest projects use `run`,
not watch, by default — add `--watch` for TDD):

```bash
npm run test --workspace=@setframe/api -- src/routes/exercises.test.ts
npm run test --workspace=@setframe/web -- src/pages/TodayPage.test.tsx
npm run test --workspace=@setframe/domain -- src/training-trends.test.ts -t "some test name"
npm run test --workspace=@setframe/mobile -- SetRow.test.tsx   # jest, not vitest
```

Other per-workspace commands:

```bash
apps/api:      npm run dev --workspace=@setframe/api    # tsx watch, needs .env (DATABASE_URL, CLERK_*)
apps/web:      npm run dev:mock --workspace=@setframe/web  # Vite + MSW mocks, no live API needed
packages/database: npm run db:generate --workspace=@setframe/database  # drizzle-kit generate, after schema edits
                    npm run db:migrate --workspace=@setframe/database   # requires real DATABASE_URL
```

Git hooks (Copilot-based pre-commit review) are opt-in per clone:
```bash
scripts/setup-hooks.sh
```

## Architecture

### Workspace layout

```
apps/api        Fastify REST API (Railway)
apps/web        React 19 + Vite SPA (Cloudflare Pages)
apps/mobile     Expo/React Native iOS app (expo-router)
packages/schemas       Zod schemas — single source of truth for shapes, imported by api/web/mobile/domain
packages/domain        Pure, framework-free business logic (1RM, volume, PR detection, trends, chart geometry) — unit tested in isolation
packages/database       Drizzle ORM schema + migrations, Neon Postgres driver
packages/config         Typed env parsing (Zod) shared by apps
packages/design-tokens   Colors/spacing/typography tokens shared by web + mobile themes
packages/api-client      Intended generated/typed client (currently a stub — apps/web and apps/mobile each hand-roll a thin fetch wrapper in `src/lib/api-client.ts` instead; see TODO comment there)
```

Deployment: Cloudflare Pages (web) + Railway (Fastify API, `apps/api`) +
Neon Postgres (branch-per-environment), auth via Clerk. Mobile is the sole
on-device HealthKit bridge — web never touches HealthKit. Explicitly no
GraphQL/tRPC/Redis/Kafka/microservices/Kubernetes (see ADR 0003, 0004,
architecture.md §7) — one Fastify service + one Postgres instance is a
deliberate constraint, not an oversight.

### Auth model (ADR 0002)

Both clients authenticate via Clerk and send a bearer token. The API's
`authPlugin` (`apps/api/src/plugins/auth.ts`) verifies every request in a
pre-handler, resolves `clerk_user_id` → internal `user.id` (lazily
provisioning a `user` row on first sight), and attaches `request.userId`.
**Every route must scope its queries by `request.userId`, never by an id
supplied in the request body/query** — this is the load-bearing security
invariant of the whole API; there is no per-route authorization layer
beyond it.

### Plan vs. reality (ADR 0005) — the core domain modeling decision

Read ADR 0005 before touching program/workout schema or routes. Training
intent and workout fact are modeled as fully separate entities with no
shared mutable state:

- **Intent** (freely editable): `training_program` → `program_version` →
  `program_schedule_slot` assigns reusable `day_type` rows (with their
  ordered `day_type_exercise` + JSON `prescription`) into a schedule,
  either block mode (`cycle_length_weeks` set) or perpetual mode (null).
  `schedule_override` lets a user swap a specific date's day type ad hoc.
  (Note: `day_type`/`day_type_exercise` are the current schema — they
  replaced the `workout_template`/`workout_template_exercise` naming still
  used in `docs/data-model.md` and ADR 0005's prose; the *separation
  principle* ADR 0005 documents still holds exactly, only the table names
  changed.)
- **Fact** (append-mostly): `workout_session` → `workout_exercise_log` →
  `workout_set`. At session-start, exercise name and prescription are
  **copied** into snapshot fields on the log row. Rendering a past session
  always reads the snapshot, never live-joins back to `day_type_exercise`.
  Editing a template later must never change how an old session renders.
- Sets are independent rows, never fixed columns (`set1Weight`, ...) — any
  number of sets, of any `setType` (`warmup|working|top|backoff|drop|
  failure|bodyweight|timed|distance`), requires no schema change.
- PR flags (`isPrWeight`, `isPrReps`) are computed server-side on
  create/update of a set, scoped to `working`/`top`/`backoff` sets only.

### Prescription shapes

A `prescription` (on `day_type_exercise`, and snapshotted onto
`workout_exercise_log`) is a discriminated union keyed by `kind`
(`sets_reps | top_set_backoff | per_side | timed | distance | duration |
distanceDuration | bodyweight_reps`) — see `docs/data-model.md` §3.1 for
the full shape and `packages/schemas/src/workout.ts` for the Zod source of
truth. `packages/domain/src/prescription-fields.ts` and
`prescription-summary.ts` derive UI-facing fields/labels from it; both
`apps/web/src/lib/prescription.ts` and `apps/mobile/src/lib/prescription.ts`
build on top. Starting a session from a template pre-fills set
type/target reps/duration/distance from the prescription but leaves weight
blank; extra ad hoc sets can always be added.

### Health sync correctness model

Background HealthKit delivery is a freshness optimization only, never the
correctness mechanism. Every mobile foreground event must re-run
reconciliation: refresh today, fully re-query yesterday until it's
`complete`, re-read a rolling window of recently-completed days
(self-healing for late Watch/HealthKit/MyFitnessPal writes), and reconcile
any older `missing|partial|stale|error` date. One normalized payload per
foreground event is sent to `POST /v1/integrations/apple-health/reconcile`,
which UPSERTs by `(user_id, local_date)` — resending the same payload must
never change the stored result (idempotent, no delta application). See
`docs/architecture.md` §5 and `apps/mobile/src/healthkit/HealthKitAdapter.ts`.

Every daily record stores `local_date` (calendar day, not UTC) + the
`timezone` that defined that day + UTC timestamps for underlying events,
to survive DST/travel/late writes correctly.

Source-of-truth split: workouts are always our DB; imported metrics
(steps, HR, activity rings, imported weight) are authoritative from
HealthKit and stored as a normalized snapshot with provenance, never raw
samples; manually-entered metrics (weight, BP, notes) live in our DB and
coexist with an imported HealthKit value — the UI shows deterministic
source precedence, never silent overwrite. Nutrition is MyFitnessPal →
Apple Health → HealthKit read only; there is no direct MFP integration.

### API shape

Fastify + `fastify-type-provider-zod`: every route's schema is a Zod
schema (from `packages/schemas` where shared, or route-local), giving
runtime validation and static types from one definition. Errors are a
uniform `ApiError` (`apps/api/src/lib/errors.ts`) → `{ error: { code,
message, requestId } }`, thrown from handlers and formatted by the global
error-handler plugin. Routes are registered in `apps/api/src/app.ts`; see
`docs/api.md` for the full resource map. `packages/api-client` is meant to
replace the hand-rolled fetch wrappers in `apps/web`/`apps/mobile` once
filled in — check whether it's still a stub before assuming it's usable.

### Frontend structure

Both `apps/web` and `apps/mobile` independently implement the same
component/screen set against the shared `packages/domain` +
`packages/schemas` + `packages/design-tokens` — there is no shared UI
component package; component logic (e.g. `Charts.tsx`, `SetRow.tsx`,
`WeekScheduleEditor.tsx`) is duplicated per-platform by design (very
different rendering primitives: styled-components/DOM vs. React Native
views). When changing behavior that exists on both platforms, check both
`apps/web/src` and `apps/mobile/src` for a parallel implementation.
`packages/domain`'s pure functions (chart geometry, progress formatting,
trend calculation) exist specifically so the math is unit-tested once and
consumed identically by both renderers.

Web routing is centralized in `apps/web/src/App.tsx` (react-router,
Clerk `SignedIn`/`SignedOut` gate). Mobile routing is file-based
(`expo-router`) under `apps/mobile/app/`, with the tab shell under
`app/(tabs)/` and auth-gating in `app/(tabs)/_layout.tsx`.

### Database

Drizzle ORM schema lives in `packages/database/src/schema/*.ts` (one file
per domain area, barrel-exported from `schema/index.ts`), targeting Neon
Postgres via `@neondatabase/serverless`'s HTTP driver (no persistent pool —
`createDb()` is cheap to call and doesn't eagerly connect). Migrations are
generated with `db:generate` into `packages/database/drizzle/` and must be
committed; `db:migrate` requires a real `DATABASE_URL` and should not be
run against a placeholder. All primary keys are UUIDs; every user-owned
table has a `user_id` FK that every query must scope by.

## Conventions

- Conventional Commits (`{type}: {description}`, types: `feat|fix|chore|
  docs|ci|refactor|style|test`).
- TypeScript strict mode everywhere (`tsconfig.base.json`:
  `strict` + `noUncheckedIndexedAccess`), ESM (`"type": "module"`)
  throughout.
- `docs/adr/` — check for an existing ADR before making a stack/topology/
  modeling decision that would warrant one; add a new one for decisions of
  similar weight (auth provider, hosting, a non-obvious schema separation,
  a scope boundary like ADR 0007).
- `backlog/` — open work items live at the folder root; shipped ones move
  to `backlog/completed/`. Each batch of stories has an accompanying
  `README-{range}-{review-name}.md` describing the review it came from.

## Interaction preferences (from `.github/copilot-instructions.md`)

- Ask clarifying questions when scope is ambiguous — batch them, don't ask
  one at a time.
- Prefer brevity; skip preamble.
- Nothing beyond the currently active phase (per the master prompt's
  phased plan, §27) should be implemented without explicit sign-off.
