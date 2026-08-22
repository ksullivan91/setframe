# Story 01 — Simplify Guided Setup Exercise Addition

## User Story

As a user building a workout in Guided Program Setup, I want one clear exercise-addition flow so that I always understand whether I am selecting an existing exercise, creating a custom exercise, or adding the selected exercise to the workout.

## Screenshot / Gym-Test Evidence

Screenshots 1–3 show five controls/actions compressed into the same small area: exercise selector, prescription selector, custom-exercise input, Create exercise, and Add to Upper B. During gym testing, typing a custom exercise name and then pressing **Add to Upper B** added the previously selected Barbell Incline Press again because the old dropdown selection remained active.

## Problem Statement

The interface currently exposes multiple competing actions and maintains stale selection state. A user can believe they are adding the custom exercise they just typed while the application actually adds the previously selected catalog exercise. This creates duplicate workout data and destroys trust in the builder.

## UX / Product Intent

Redesign this step around a single primary intent: **Add an exercise to this workout**.

Recommended interaction:
1. Start with a searchable exercise picker.
2. Selecting an existing exercise proceeds to its prescription configuration.
3. If the exercise is not found, expose **Create custom exercise** as a secondary branch.
4. Creating a custom exercise should use a single **Create & add** action and immediately add that newly created exercise to the workout.
5. Clear stale selector/custom-input state after successful addition.
6. The currently selected catalog exercise must never silently win over newly entered custom-exercise text.
7. Keep the default/simple prescription fast; advanced prescription details can remain progressively disclosed.

## Acceptance Criteria

- [ ] The guided setup no longer presents separate competing **Create exercise** and **Add to workout** actions for the same custom-exercise intent.
- [ ] A user can clearly distinguish selecting an existing exercise from creating a custom exercise.
- [ ] Creating a custom exercise adds that exact exercise to the current workout in the same flow.
- [ ] Typing a custom exercise cannot accidentally add a previously selected catalog exercise.
- [ ] After an exercise is added, stale selection/input state is cleared or intentionally updated.
- [ ] Duplicate submission is prevented during API loading.
- [ ] Error states preserve the user's entered exercise name.
- [ ] The interaction works consistently on mobile web, desktop web, and mobile app.
- [ ] The mobile layout does not stack multiple large CTAs into a confusing cluster.


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

Before coding, inspect the current Guided Setup exercise-step component, selector state, custom exercise mutation, and `Add to workout` handler. Identify why catalog selection persists while custom text is entered.

Do not patch this by merely clearing one field on click. Fix the interaction model so there is one unambiguous source of truth for the exercise being added.

Prefer progressive disclosure:
- `Add exercise`
- search/select existing
- `Create custom exercise` only when needed
- configure prescription
- confirm add

Reuse existing exercise APIs and data models where safe. Avoid creating a second exercise-creation implementation that diverges from the full editor.

Add behavior-focused tests reproducing the gym failure: select Exercise A, type custom Exercise B, then follow the custom-add flow; only Exercise B may be added.
