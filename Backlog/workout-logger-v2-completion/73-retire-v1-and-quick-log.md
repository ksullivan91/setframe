# Story 73 — Retire v1 and Remove Quick Log

**Priority: P1, and last in the pack.** Do not start this until 69 and 70
have landed — v1 must not be deleted while v2 is still missing operations v1
had.

## Part 1 — delete v1

| Platform | File |
|---|---|
| Web | `apps/web/src/pages/WorkoutSessionPage.tsx` (+ its test) |
| Web | `apps/web/src/components/ExerciseWorkCard.tsx` (+ its test) |
| Mobile | `apps/mobile/src/screens/WorkoutSessionScreenV1.tsx` |
| Mobile | `apps/mobile/app/session-summary.tsx` |

Both v1 screens are already unrouted. `session-summary` is still linked from
**Progress** in two places (`(tabs)/progress.tsx`) for historical sessions —
repoint those at `/workout/[sessionId]`, which renders the completed state,
before deleting it.

Then rename the v2 files to drop the suffix: versioning was a scaffold for the
transition, not a permanent name.

Tests to delete with the pages:

- `apps/web/e2e/functional/story-42-regression.spec.ts` — already
  `describe.skip`, and every assertion is against v1's accordion UI.
- The v1 sections of `apps/mobile/src/__tests__/WorkoutSessionScreen.test.tsx`.

**`ExerciseWorkCard` is the React Aria disclosure.** ADR 0011 notes it becomes
unnecessary for the active session once an exercise costs ~264px. Deleting it
also drops the `react-aria-components` dependency if nothing else uses it —
check before removing from `package.json`.

## Part 2 — remove Quick Log

**Decided: v2 has no Quick Log and will not get one.** v2 addresses the same
need differently — `PREVIOUS` copies last session into a row, and rows commit
on blur — so the per-set cost Quick Log existed to amortise is much lower.

17 files reference it. Remove in this order, so nothing is broken between
steps:

1. **Clients** — falls out with v1 above.
2. **Domain** — `packages/domain/src/quick-log.ts` and its test, plus the
   export in `index.ts`. Helpers: `quickLogFields`, `supportsQuickLog`,
   `quickLogTargets`, `isQuickLogComplete`, `describeQuickLogAction`,
   `plannedQuickLogSeed`.
3. **Schemas** — the quick-log request/response in
   `packages/schemas/src/workout.ts`.
4. **API** — `POST /v1/workout-exercise-logs/:id/quick-log` in
   `workout-sessions.ts`, and its tests.
5. **Mocks** — the handler and `mockControl.setQuickLog` /
   `quickLogBehaviour` in `mock-control.ts`. Check whether any remaining spec
   uses the delay/fail behaviour for something else first.
6. **The skipped test** — `core-flows.spec.ts`'s quick-log case, whose comment
   asks for exactly this decision. Delete it and the comment together.

### Sequencing caveat

Removing the API endpoint breaks any client still calling it. Web always
serves the latest bundle; a **mobile build in the wild could be stale**. With
one real user this is fine, but ship the client removal first and the endpoint
second rather than in one deploy.

## Acceptance criteria

1. `grep -ri "quicklog\|quick-log\|quick log"` across `apps/` and `packages/`
   returns nothing outside `Backlog/` and `docs/`.
2. No route renders a v1 screen, and no file name carries a `V1`/`V2` suffix.
3. Progress's two links open the v2 logger's completed state.
4. Full suite green: `npx turbo run typecheck test`, plus the Playwright
   functional project.
5. `docs/design/workout-logging-*.md` and ADR 0011 updated where they refer to
   v1 existing alongside v2.
