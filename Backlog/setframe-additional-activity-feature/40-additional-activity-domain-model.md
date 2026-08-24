# Story 40 — Introduce the Additional Activity Domain Model

## User Story
As a user who sometimes performs movement outside my scheduled training session, I want Setframe to understand the difference between my planned workout and supplemental activity so that my day can reflect what I actually did without corrupting program adherence, workout counts, streaks, or training history.

## Product Context and Intent
Setframe needs three distinct concepts:

### Scheduled workout
A session expected by the active program, such as Upper B, Lower A, or Recovery Day A. It drives program adherence, scheduled-session completion, and workout streaks.

### Additional activity
Intentional movement outside the formal program schedule, such as post-meal walks, yoga, mobility, foam rolling, light cycling, stretching, or other recovery movement.

### Ad hoc workout
A substantial unscheduled training session the user intentionally wants treated like a real workout, such as an unexpected second lifting session.

This story establishes the distinction without building the full ad hoc workout flow.

## Problem Statement
Without a distinct activity concept, Setframe risks inflating workout counts, breaking streak/adherence semantics, forcing users to create permanent templates for incidental movement, and treating a 10-minute walk as equivalent to a lifting session.

## Domain Requirements
Introduce an explicit `AdditionalActivity` model capable of storing:
- id
- user id
- local calendar date
- start timestamp when known
- end timestamp or duration
- activity type
- source (`manual`, `apple_health`, future sources)
- optional title/name
- duration
- optional distance and unit
- optional calories if sourced externally
- optional notes
- optional external source identifier / dedupe key
- created/updated timestamps

Suggested initial activity types:
- Walk
- Yoga
- Mobility
- Foam rolling
- Outdoor cycle
- Indoor cycle
- Run
- Stretching
- Other

Additional Activity belongs to a day, not to the workout template.

## Acceptance Criteria
- [ ] Additional Activity is distinct from a scheduled workout session.
- [ ] It never mutates a program or workout template.
- [ ] It does not count as a completed scheduled workout by default.
- [ ] It can store type, date/time, duration, optional distance, source, and notes.
- [ ] Manual and Apple Health sources are supported.
- [ ] Stable external identifiers/dedupe keys are supported.
- [ ] Multiple activities can exist on one day.
- [ ] Existing workout history is unchanged.
- [ ] Scheduled-session metrics do not silently start counting Additional Activities.
- [ ] A day with 1 scheduled workout + 3 Additional Activities still reports 1 scheduled workout.

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


## Copilot / Claude Steering Document
Treat this as a domain-boundary story.

Audit Program, Workout template, Scheduled workout instance, Workout session, Exercise, Set, Today completion, Progress session counts, Streaks, and History.

Prefer explicit naming such as `AdditionalActivity` or `ActivityEntry`, not `WorkoutLite` or `ExtraWorkout`.

Preserve local-calendar-day semantics; do not group solely by UTC date.

Design for Apple Health dedupe now by including source and external identifier, but do not build Apple discovery in this story.

Document which metrics remain scheduled-workout-only: adherence, workout streak, scheduled session completion, and Sessions per week if that metric currently means scheduled training.

Do not build the UI, recurring routines, or reinterpret historical workouts in this story.
