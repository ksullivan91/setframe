# Story 06 — Replace Start/Resume State with Completed Workout Review

## User Story

As a user who has completed today's workout, I want Today to clearly celebrate and summarize completion instead of still offering Start/Resume actions so that the page reflects reality and gives me closure.

## Screenshot / Gym-Test Evidence

Screenshot 6 shows a completed workout review card lower on Today while the page still allows the user to start the scheduled workout. The workout was already completed, but the actionable training card did not transition to a completed state.

## Problem Statement

Today is displaying mutually contradictory states: `workout complete` and `start workout`. This can create duplicate sessions and makes completion feel visually unimportant.

## UX / Product Intent

After today's scheduled workout is completed:
- remove/deactivate Start Workout and Resume Workout actions for that completed session
- remove the global in-progress banner for that session
- move the completed workout review into the primary workout position near the top of Today
- give the completed state a positive semantic treatment
- use a subtle opaque/translucent green surface with green border/accent, not a saturated green CTA
- show useful completion metrics such as exercises, sets, total volume, completion time, and `Review completed workout`
- preserve an intentional path to start a separate ad-hoc workout only if the product supports that as a distinct action

## Acceptance Criteria

- [ ] A completed scheduled workout cannot be started/resumed again from Today.
- [ ] The in-progress banner disappears when that workout session is completed.
- [ ] The completed workout review occupies the primary training area near the top of Today.
- [ ] The completed card uses accessible semantic success styling with sufficient contrast.
- [ ] Green is used as completion/status semantics, not as a new generic primary-button color.
- [ ] `Review completed workout` opens the correct completed session.
- [ ] Reloading the page preserves the completed state.
- [ ] Creating a separate workout, if supported, is clearly distinct from restarting the completed scheduled workout.
- [ ] Web and mobile app transition through scheduled → in progress → completed states consistently.


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

Model this as a state-machine problem, not a CSS-only change.

Audit how Today derives:
- scheduled workout
- active/in-progress workout
- completed session for current local date

Define precedence explicitly. A completed session for the scheduled workout must win over the scheduled `not started` state.

Use the existing green success language already present for completed checkmarks/sync where possible. The card should feel rewarding but remain consistent with Setframe's restrained visual system.

Add regression tests for start → resume → finish → reload → completed review.
