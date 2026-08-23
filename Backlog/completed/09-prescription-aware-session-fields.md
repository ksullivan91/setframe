# Story 09 — Render Workout-Session Inputs Based on Prescription Type

## User Story

As a user logging a workout, I want each exercise to show only the fields that make sense for its prescription type so that strength, timed, distance, cardio, and bodyweight activities are fast and intuitive to log.

## Screenshot / Gym-Test Evidence

Screenshots 2–7 show set cards rendering the same large collection of inputs regardless of exercise type:

- Type
- Weight
- Reps
- RPE
- Duration
- Distance
- Distance unit

For a normal **Sets + reps** lift such as Neutral Grip Pull-ups or Overhead Press, duration and distance fields are irrelevant.

For **Outdoor Cycle**, which was intended as a distance/duration activity, the session still presented strength-oriented fields such as set type, weight, reps, and RPE.

Screenshot 8 shows the available prescription types:
- Sets + reps
- Timed sets
- Duration
- Distance + duration
- Distance
- Bodyweight reps

## Problem Statement

The session logger currently reflects a generic database/set model instead of the user's selected exercise representation.

This creates visual overload, unnecessary scrolling, and confusing validation requirements. It also risks invalid or meaningless data, such as requiring weight and reps for a bike ride.

The prescription type should determine which inputs are visible, required, optional, and summarized.

## UX / Product Intent

Create a centralized prescription/representation schema that drives both programming and workout-session logging.

At minimum, support the currently exposed prescription types:

### Sets + reps
Show:
- set type where applicable
- weight
- reps
- RPE if supported/optional

Hide:
- duration
- distance
- distance unit

### Timed sets
Show:
- set type where applicable
- duration
- optional RPE if appropriate

Only show weight if weighted timed work is intentionally supported by the product model.

### Duration
Show:
- duration
- optional RPE / notes if supported

Do not require reps, distance, or weight by default.

### Distance + duration
Show:
- distance
- distance unit
- duration
- optional RPE if appropriate

Do not require sets/reps/weight by default.

### Distance
Show:
- distance
- distance unit
- optional RPE if appropriate

### Bodyweight reps
Show:
- reps
- optional RPE
- set type if meaningful

Do not require external weight by default.

The exact field matrix should be driven from one shared configuration/source of truth rather than scattered `if` statements across web and mobile.

## Acceptance Criteria

- [ ] Each prescription type renders only fields relevant to that representation.
- [ ] Sets + reps no longer displays duration/distance fields by default.
- [ ] Duration/distance activities no longer require strength-only fields such as weight or reps unless the representation explicitly supports them.
- [ ] Validation rules match the visible fields.
- [ ] Hidden irrelevant fields are not submitted with misleading default values.
- [ ] Existing historical workout data remains readable.
- [ ] Editing an existing session with older data does not silently discard stored values.
- [ ] Planned values and actual values remain comparable using the correct units/metrics for each representation.
- [ ] Session summaries calculate only metrics that make sense for the exercise type.
- [ ] The same representation rules are used in program creation, full editor, active workout, and mobile app.
- [ ] Mobile layouts reduce vertical height significantly for simple Sets + reps exercises.
- [ ] Tests cover all currently supported prescription types.


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

Before coding, audit the data model for exercise prescription/representation and determine whether fields are:
- nullable columns on one generic set record
- separate models
- serialized configuration
- inferred from exercise/template metadata

Create a shared representation definition rather than duplicating logic.

For example, use a concept similar to:

`PrescriptionDefinition`
- `type`
- `fields`
- `requiredFields`
- `optionalFields`
- `units`
- `summaryFormatter`
- `validation`

The exact implementation should fit the existing architecture.

Do not create a breaking migration unless necessary. Prefer compatibility with existing persisted session data.

Audit every place that consumes prescription type:
- Guided Setup
- Training full editor
- workout preview
- active session
- completed workout review
- history
- progress calculations

This story should fix the active-session UI first, but the model must be shared so web/mobile and future pages do not drift.
