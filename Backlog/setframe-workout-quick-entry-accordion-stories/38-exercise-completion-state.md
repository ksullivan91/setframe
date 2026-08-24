# Story 38 — Add Exercise-Level Completion State Based on Required Set Data

## User Story

As a user moving through a workout, I want each exercise section to clearly show when all required data for its sets has been completed so that I can quickly see what is finished and what still needs attention.

## Product Intent

Once all required actual inputs for all relevant sets are valid and committed, the exercise should show a clear completed state.

Use green semantically, but restrained:
- green check,
- subtle green tint/border,
- `Complete` status.

Avoid making the entire workout page a wall of green.

## Completion Semantics

Completion must be derived from the representation.

Examples:
- Sets + reps: all required actual fields valid and logged/saved.
- Duration: duration valid and logged.
- Distance + duration: distance, unit, and duration valid and logged.
- Optional fields such as RPE do not block completion unless configured as required.

A prefilled but unsaved set must not count as complete if Setframe requires explicit saving.

Completion must be re-evaluated whenever data changes.

## Acceptance Criteria

- [ ] Each exercise has an incomplete/complete state.
- [ ] Only required fields determine completion.
- [ ] Optional fields do not block completion unless configured as required.
- [ ] Planned/template values alone cannot create false completion.
- [ ] Unsaved data does not count if explicit save is required.
- [ ] Complete state uses restrained green semantics.
- [ ] Completion does not rely on color alone.
- [ ] Incomplete state can show `x of y sets complete`.
- [ ] Clearing/invalidating data returns the exercise to incomplete.
- [ ] Removing a set/exercise recalculates completion.
- [ ] Session summary remains consistent.
- [ ] Logic is shared across mobile web/app.
- [ ] Tests cover supported representation types.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile app.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, success, empty, disabled, and error states handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior considered.
- Existing historical data preserved unless explicitly migrated.
- Behavioral tests cover important user-visible outcomes.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.


## Copilot Steering Document

Completion is a **derived domain state**, not a UI boolean toggled on accordion close.

Create/reuse authoritative functions conceptually like:

`isSetComplete(set, representation)`  
`isExerciseComplete(sessionExercise)`

Blur/collapse may trigger a UI refresh, but must not be what causes completion.

If persistence is required:
- show saving,
- mark complete only after success,
- remain incomplete on error.

### Scope boundary

Do not add achievements, alter streak logic, or mark the whole workout complete from this state.
