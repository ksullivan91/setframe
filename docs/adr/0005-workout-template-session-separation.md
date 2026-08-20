# ADR 0005: Workout Template / Session Separation (Plan vs. Reality)

Status: Proposed (this is a non-negotiable product principle from the
master spec, documented here as a formal ADR per spec §31). Date:
2026-08-20.

## Context

A workout template represents intent (what the user plans to do); a
workout session represents fact (what the user actually did). Users will
edit templates over time (reorder exercises, change target reps, swap
progression rules) without wanting that edit to silently rewrite the
historical record of past sessions.

## Decision

Model these as fully separate entities with **no shared mutable state**:

- `workout_template` / `workout_template_exercise` — intent, freely
  editable, versioned via `program_version` when a program-level change is
  significant enough to warrant a new effective period.
- `workout_session` / `workout_exercise_log` / `workout_set` — fact,
  append-mostly. A session references its originating `template_id`
  (nullable, since ad hoc sessions are allowed) purely for traceability,
  never for live rendering of historical data.
- At session-start time, the exercise name and full prescription are
  **copied** into `workout_exercise_log.exercise_name_snapshot` and
  `.prescription_snapshot`. Rendering a past session always reads these
  snapshot fields, never joins back to the live `workout_template_exercise`
  row.
- Sets are modeled as independent rows (`workout_set`), never as fixed
  columns (`set1Weight`, `set2Weight`, ...), so any number of sets — added,
  removed, or deviating from the plan — requires no schema change and no
  loss of historical shape.

## Rationale

- This is the single most important modeling decision in the product per
  the master spec (§1.1–§1.3): getting it wrong (e.g., a live foreign-key
  join from session to template for exercise name/prescription) would mean
  editing a template retroactively changes how old sessions display,
  silently corrupting historical data users rely on for progression
  tracking.
- Snapshotting at the row level (rather than, say, a single JSON blob of
  "the whole workout as performed") keeps the data queryable — per-set
  history, volume, and 1RM calculations in `packages/domain` need to query
  individual `workout_set` rows across sessions/exercises directly.

## Consequences

- Every session-start operation must perform an explicit snapshot copy
  (exercise name + prescription) — this is business logic that belongs in
  `packages/domain`/the API layer, not something the database enforces
  structurally; API tests must specifically verify that editing a template
  after a session exists does not alter that session's rendered data
  (master spec §20, API test list).
- Ad hoc deviations (extra sets, skipped exercises, substituted exercises,
  reordering within a session) are all just additional/modified rows in
  `workout_exercise_log`/`workout_set` — no special-casing needed in the
  schema, only in the API's validation of what transitions are allowed
  once a session is `completed` vs. `in_progress`.
