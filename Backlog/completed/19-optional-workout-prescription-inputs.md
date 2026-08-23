# Story 19 — Make Planned Prescription Values Optional During Program Creation

## User Story

As a user creating a workout, I want sets, reps, duration, distance, and other planned prescription values to be optional so that I can build the workout structure first and fill in exact targets later.

## Screenshot / Beta-Test Evidence

The beta tester explicitly asked that sets/reps and the other representation-specific inputs be optional while creating a workout.

This is especially relevant for novice users who know which exercises they intend to perform but do not yet know exact targets.

## Problem Statement

Guided Setup can force programming decisions too early. Exercise selection and prescription are separate decisions, and the user should be able to defer exact targets.

## UX / Product Intent

Allow exercises to be added with a representation type but no exact planned target.

Examples:
- `Barbell Back Squat — Sets + reps` with sets/reps blank.
- `Mobility — Duration` with duration blank.
- `Outdoor Cycle — Distance + duration` with both blank.

Use intentional summaries such as:
- `No target set`
- `Open prescription`
- `Planned: —`

Do not manufacture `0 × 0`, `0 min`, or `0 mi`.

Actual workout logging must still work when no planned values exist.

## Acceptance Criteria

- [ ] Exercises can be added without exact prescription values.
- [ ] Representation type remains valid with null/empty planned values.
- [ ] Missing planned values are stored as absence/null, not zero sentinels.
- [ ] Summaries do not show fake `0 × 0` values.
- [ ] Preview and active-session screens render a clear no-target state.
- [ ] Actual session logging works with no planned target.
- [ ] Existing workouts with planned values are unchanged.
- [ ] Validation distinguishes omitted values from invalid values.
- [ ] All supported representation types follow the same optional-planning principle unless explicitly documented otherwise.
- [ ] Web and mobile use identical semantics.
- [ ] Tests cover creation, preview, logging, and history with no planned target.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Any user-facing web change is also implemented in the mobile application.
- Mobile web and mobile app are compared for behavioral and visual parity.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch-target, and screen-reader behavior are considered.
- Existing historical user data is preserved unless a migration is explicitly required.
- Behavioral tests cover the important user-visible outcomes; do not rely only on snapshots.
- Type checking, linting, relevant tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Coordinate this with the shared prescription model from Story 09.

Inspect backend/database constraints and frontend validation for:
- non-null defaults,
- zero sentinels,
- required request DTO fields.

Prefer true nullable/optional semantics.

Do not make performed-set values optional just because planned values are optional.

Audit all consumers of planned values:
Guided Setup, full editor, preview, active workout, Today summary, completed workout, History, and Progress.
