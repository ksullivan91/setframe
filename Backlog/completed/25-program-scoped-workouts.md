# Story 25 — Scope Workouts to the Selected Program

## User Story

As a user managing a training program, I want the Workouts tab to show only workouts that belong to the selected program so that unrelated workout templates do not clutter or confuse program editing.

## Screenshot / Product-Test Evidence

The current Training experience exposes the user's workouts broadly.

Now that users can create multiple programs, the user expects that workouts should only appear in the current program if they were:
- created through that program's guided setup, or
- explicitly added to that program afterward.

The screenshot shows Schedule listing multiple workouts, but the interface does not communicate whether these are global workouts or workouts specifically associated with the current program.

## Problem Statement

A global workout library and a program-specific workout list are two different concepts.

If every workout ever created appears in every program:
- program boundaries become meaningless,
- Schedule becomes cluttered,
- users can accidentally assign unrelated workouts,
- novice users may not understand whether editing a workout changes another program.

The product needs an explicit program-to-workout relationship.

## UX / Product Intent

Treat workout templates as reusable entities that can be associated with one or more programs, unless the existing domain model intentionally makes them program-owned.

For the Training UI:

### Workouts tab

Show:
- workouts already included in the selected program,
- an explicit action to add another workout to that program.

Do **not** automatically show every global workout in the main program workout list.

### Add workout to program

Provide a dedicated flow such as:

`+ Add workout`

Then offer:
- choose from existing workout templates,
- create a new workout,
- optionally duplicate/copy an existing workout if supported later.

Selecting an existing workout should create a program association, not silently clone it unless the domain model requires copies.

### Guided setup

Any workout created during guided setup should automatically be associated with the program being built.

### Removing from a program

Removing a workout from a program should remove the association, not necessarily delete the underlying workout template.

If the workout is scheduled within that program, explain and resolve those schedule references before removing it.

### Avoid accidental cross-program edits

Audit whether workout templates are shared references or program-specific copies.

If shared:
- editing the workout should clearly communicate that changes affect every program using it.

If product intent is program-specific customization:
- use copies/overrides explicitly rather than surprising shared mutation.

Do not decide this implicitly in UI code.

## Acceptance Criteria

- [ ] Workouts tab shows only workouts associated with the selected program.
- [ ] Guided Setup-created workouts are automatically associated with the program being created.
- [ ] Users can explicitly add an existing workout template to the selected program.
- [ ] Users can create a new workout from within the selected program context.
- [ ] Newly created workouts are associated with the selected program immediately.
- [ ] Removing a workout from a program removes the association rather than globally deleting the workout unless the user chooses a separate delete action.
- [ ] Scheduled references are handled safely before a workout is removed from a program.
- [ ] Schedule only offers workouts associated with that program.
- [ ] Global/custom workout templates not associated with the program do not appear in the main Workouts/Schedule lists.
- [ ] Shared-vs-copied workout edit semantics are explicitly defined and tested.
- [ ] Mobile web and mobile app use identical program/workout association semantics.

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

Before implementation, inspect the data model.

Determine whether:
- `Workout` currently belongs directly to a Program,
- there is already a join/association table,
- workouts are global per user,
- guided setup stores program ownership,
- schedule references workout ID only or program-workout association ID.

Do not solve this by frontend filtering alone if the backend model does not preserve membership.

Preferred conceptual model if workouts are reusable:

`Program`
`ProgramWorkout`
`WorkoutTemplate`

where ProgramWorkout expresses membership/order and WorkoutTemplate contains reusable content.

However, fit the implementation to the current architecture; do not introduce a large schema rewrite without need.

Audit deletion semantics carefully.

Add tests for:
1. Program A contains Upper A,
2. Program B contains Lower B,
3. select Program A,
4. verify only Upper A appears,
5. add Lower B explicitly,
6. verify it now appears in Program A,
7. remove Lower B from Program A,
8. verify Lower B still exists for Program B/global library where appropriate.
