# Story 18 — Make Workout Creation and Correction Obvious in Guided Setup

## User Story

As a user building multiple workouts in Guided Setup, I want to clearly understand that I can create more than one workout and remove or rename mistakes so that I can recover from misunderstanding without abandoning setup.

## Screenshot / Beta-Test Evidence

Screenshot 1 shows the Workouts step after multiple items have been created.

Beta feedback:

> “Small addition of the add workout highlight disappearing. I initially thought I was only able to create one workout.”

The same user accidentally created workout entries that were actually exercise names and could not remove those mistaken workout entries from the Workouts step.

## Problem Statement

The creation affordance becomes visually weaker after the first workout is added, which can imply setup is complete. At the same time, the wizard does not provide enough recovery when users create the wrong objects while learning the hierarchy.

## UX / Product Intent

Keep **+ Add workout** persistently discoverable.

Once workouts exist:
- prioritize the workout list,
- keep `+ Add workout` clearly actionable,
- allow rename,
- allow remove,
- allow selection for the next step,
- provide undo for removal where practical.

Do not require switching to the full editor to correct setup mistakes.

If a workout already contains exercises, clearly explain consequences before removal.

## Acceptance Criteria

- [ ] `+ Add workout` stays visibly available after the first workout.
- [ ] Users can create multiple workouts without discovering a hidden action.
- [ ] Workouts can be renamed during Guided Setup.
- [ ] Workouts can be removed before setup completion.
- [ ] Removing a workout does not delete unrelated global exercises.
- [ ] Consequences are explained if workout-specific exercise associations will be removed.
- [ ] Undo is provided where technically reasonable.
- [ ] Selected vs unselected workout states are visually clear.
- [ ] Selection does not make Add Workout look disabled.
- [ ] Mobile controls are touch-friendly and not hover-dependent.
- [ ] Web and mobile app behavior match.

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

Audit Step 2 state and styling for:
- workout creation,
- selected workout,
- created-but-unselected workout,
- disabled/loading Add Workout.

Identify why the Add Workout affordance loses prominence after creation.

Do not make every card bright purple. Preserve hierarchy:
- selected item = selected-state treatment,
- primary creation action = clear CTA,
- existing items = quieter list/cards.

Use a compact overflow or inline edit treatment for Rename/Remove rather than adding multiple large buttons.

Regression flow:
1. create first workout,
2. verify Add Workout remains available,
3. create second workout,
4. rename second,
5. remove first,
6. verify selection and next-step behavior remain valid.
