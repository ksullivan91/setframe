# Setframe Product Backlog — Completed Workout Data Correction

## Purpose

This pack adds a single story from real gym usage: users need to correct mistakes after a workout has already been completed.

Workout entry happens quickly and under fatigue, so correction is a normal workflow rather than an exceptional administrative action.

## Story

23. [Edit Logged Sets from Completed Workout Review](./23-edit-logged-sets-from-completed-workout-review.md)

(Numbered 23, not 21 — 21 was already taken by the completed
rest-day-scheduling story; renumbered on import to avoid collision.)

## Dependencies / Coordination

This story should coordinate with:

- **Story 09 — Prescription-aware session fields**
  - historical edit fields should use the same representation model.

- **Story 10 — PR calculation**
  - corrected historical values must recalculate PR state.

- **Story 12+ Progress work**
  - corrected historical data must propagate into charts/trends.

- **Story 20 — Mobile overlay stability**
  - if editing uses a mobile sheet/modal, use the shared stable overlay primitive.

## Product Principle

Completed does not mean immutable.

Users should be able to correct what they recorded without reopening the workout or changing the reusable program template.
