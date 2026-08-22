# Story 03 — Allow Exercise Correction During Guided Setup

## User Story

As a user building a workout, I want to remove or correct exercises before finishing the program so that mistakes do not force me to complete setup and repair the program afterward.

## Screenshot / Gym-Test Evidence

Screenshot 3 shows duplicate Barbell Incline Press entries after the accidental add. There is no visible remove/edit control in the guided setup step, so the duplicate could not be corrected until after the entire program was created.

## Problem Statement

Guided setup currently allows users to create errors but not recover from them. This violates user-control expectations and makes a setup mistake unnecessarily expensive.

## UX / Product Intent

Each exercise already added to the workout should provide lightweight correction controls inside Guided Setup.

At minimum:
- remove exercise
- edit its simple prescription if that is already supported by the underlying model
- preserve ordering
- provide undo for removal when feasible

Keep the guided experience simple. Do not turn it into the entire advanced workout editor; users can still switch to the full editor for advanced changes.

## Acceptance Criteria

- [ ] Every exercise listed in Guided Setup can be removed before the program is completed.
- [ ] Removing an exercise updates the visible list immediately.
- [ ] A mistaken removal can be undone where technically reasonable.
- [ ] The user can correct the basic prescription without leaving Guided Setup if the data model supports it.
- [ ] Removal does not delete the exercise from the global exercise library.
- [ ] Duplicate exercises can be corrected before advancing to Schedule.
- [ ] Controls are touch-friendly and accessible on mobile.
- [ ] Web and mobile app provide equivalent correction capabilities.


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

Inspect whether Guided Setup stores draft workout-template exercises immediately on the backend or in client draft state. Implement correction against the same source of truth.

Do not use destructive red/pink prominence for routine removal if undo is available; a compact overflow or remove affordance is preferable.

The exercise list itself should be the dominant content. Avoid adding another row of large buttons that recreates the clutter being fixed in Story 01.
