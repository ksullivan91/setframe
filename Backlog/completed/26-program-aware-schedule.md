# Story 26 — Make Scheduling Program-Aware

## User Story

As a user editing a program schedule, I want to assign only workouts that belong to that program so that the weekly schedule always represents the selected training plan and cannot accidentally mix workouts from other programs.

## Screenshot / Product-Test Evidence

The screenshot shows the Schedule tab with:
- a selected workout selector,
- workout pills such as Upper B, Lower A, Recovery Day A,
- day assignments.

Once multiple programs exist, this screen needs explicit program context. Otherwise a workout from another program may appear as a scheduling option simply because it exists in the user's account.

## Problem Statement

Schedule is not a global calendar of every workout template. It is the weekly structure of one specific training program.

Without program scoping:
- unrelated workouts can be assigned,
- users cannot tell which plan they are editing,
- activating a program may produce ambiguous Today behavior,
- future program switching can retain stale schedule selections.

## UX / Product Intent

Make Schedule operate strictly within the selected program context.

The Schedule tab should:
- display the selected/active program context,
- offer only workouts associated with that program,
- preserve each program's independent schedule,
- allow switching program context without mixing assignments.

When the active program changes, Today should immediately resolve against the newly active program's schedule.

If a workout is removed from a program:
- remove or explicitly resolve its schedule assignments for that program.

If no workouts exist in the selected program:
- show an empty state that directs the user to Workouts:
  `Add a workout to this program before building its schedule.`

Do not show global workout templates directly in Schedule.

## Acceptance Criteria

- [ ] Schedule only lists workouts associated with the selected program.
- [ ] Each program retains its own independent schedule.
- [ ] Switching selected program updates the Schedule view correctly.
- [ ] Switching active program updates Today according to the new active program schedule.
- [ ] Removing a program-workout association safely clears/resolves that program's assignments.
- [ ] Schedule cannot reference a workout that is no longer part of the program.
- [ ] Empty state directs users to add workouts to the program before scheduling.
- [ ] Previously selected workout UI state does not leak between program contexts.
- [ ] Mobile web and mobile app behave identically.
- [ ] Existing single-program users are migrated/handled without losing schedules.

## Product-wide Definition of Done

Every story in Setframe must satisfy these rules before it is considered done:

- The feature is implemented **mobile-first** and is fully responsive on web.
- Any user-facing behavior added or changed on web is also implemented in the **mobile application**.
- Mobile web and mobile app are reviewed side-by-side for behavioral and visual parity.
- The change is reviewed with the **GitHub reviewer** for implementation/code quality.
- The change is reviewed with the **Figma reviewer** for visual/design parity.
- Loading, success, empty, disabled, and error states are handled where applicable.
- Keyboard, focus, touch target, and screen-reader behavior are considered for interactive controls.
- Existing historical user data is not mutated or lost unless the story explicitly requires a migration.
- Automated tests cover the important user-visible behavior; do not rely only on snapshots.
- Type checking, linting, relevant unit/integration tests, and production build pass.
- No unrelated redesign or refactor is bundled into the story.


## Copilot Steering Document

Audit the current schedule model:
- whether schedule rows reference Program,
- whether they reference Workout directly,
- whether current selected-workout state persists across tabs/programs,
- how Today resolves the schedule.

Ensure every schedule assignment is unambiguously tied to one program.

If legacy assignments predate multi-program support, create a safe compatibility/migration strategy:
- map existing schedule to the user's existing/default program,
- do not drop assignments.

Invalidate/reset UI selection state when changing program context so a workout from Program A cannot remain selected while editing Program B.

Coordinate closely with Story 24 and Story 25.
