# Story 08 — Add Any Exercise Directly During an Active Workout

## User Story

As a user in the middle of a workout, I want to add any existing or custom exercise without leaving the workout session so that I can adapt my training in real time without losing focus or navigating through Training first.

## Screenshot / Gym-Test Evidence

Screenshot 1 shows the **Add exercise** modal inside an active workout. The selector displays **No more exercises available** unless the user first leaves the session, navigates to Training, selects a workout, selects an exercise there, then returns to Today and reopens the add-exercise flow.

During gym testing, this made the mid-session add feature effectively dependent on unrelated setup state outside the active workout.

## Problem Statement

An active workout is where spontaneous training changes happen. The user may add an accessory lift, substitute a movement, add cardio, or perform something that was not in the planned template.

The current flow violates that mental model by making the session depend on Training-page state. It also risks losing user focus during a live workout.

The active workout should have its own complete Add Exercise flow and should not depend on a previously selected workout-template exercise.

## UX / Product Intent

Redesign the active-session Add Exercise experience around one self-contained interaction.

The user should be able to:

1. Open **Add exercise** from the active workout.
2. Search the canonical exercise catalog.
3. Select any existing exercise not already filtered out for a legitimate product reason.
4. Create a custom exercise if the desired movement is not in the catalog.
5. Configure the exercise's appropriate prescription/session representation.
6. Add it to the **current session only** by default.
7. Continue logging without leaving the workout.

If adding an exercise to the session should optionally update the reusable workout template, that must be a separate explicit action later and must never happen silently.

## Acceptance Criteria

- [ ] The active workout Add Exercise flow no longer depends on Training-page selection state.
- [ ] Opening Add Exercise loads/searches the canonical exercise catalog directly.
- [ ] The user can add any valid preloaded exercise during the active session.
- [ ] The user can create and immediately add a custom exercise without leaving the session.
- [ ] Creating a custom exercise uses a clear **Create & add** style interaction rather than multiple ambiguous CTAs.
- [ ] Adding an exercise affects the current workout session only by default.
- [ ] Existing logged sets remain intact when another exercise is added.
- [ ] The newly added exercise appears in the correct position/order and is immediately loggable.
- [ ] Duplicate submissions are prevented during API loading.
- [ ] Catalog loading, empty, and error states are distinct and clear.
- [ ] Mobile web and mobile app support the same mid-session add behavior.
- [ ] The workflow does not require navigation away from the active workout.


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

Before coding, trace the existing Add Exercise modal from the active workout and identify why its exercise options depend on Training-page selection state.

Audit:
- exercise query/source
- query keys/cache
- workout-template selection state
- active-session state
- filtering logic
- custom-exercise mutation
- session-exercise mutation

Do not fix this by passing the currently selected Training exercise into the modal. The modal must become independent.

Reuse the canonical exercise-search/creation logic used elsewhere in Setframe so Guided Setup, Training editor, and active-session Add Exercise do not diverge into three separate implementations.

Add a regression test for the exact gym failure:
1. begin a workout
2. do not visit Training
3. open Add Exercise
4. search/select a canonical exercise
5. add it successfully
6. verify all previously logged session data remains intact

Also test custom exercise creation directly from the active session.
