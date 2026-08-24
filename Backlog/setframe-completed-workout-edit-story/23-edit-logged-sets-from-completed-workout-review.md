# Story 23 — Edit Logged Sets from Completed Workout Review

## User Story

As a user reviewing a completed workout, I want to correct mistakes in the sets I logged so that accidental entry errors do not permanently distort my workout history, progress metrics, PRs, or estimated strength.

## Screenshot / Gym-Test Evidence

Screenshot 1 shows the active workout logging experience for **Barbell Deadlift**, where several sets were entered during the session.

Screenshots 2 and 3 show the completed workout/history view for the same exercise and session. The recorded workout includes:

- Set 1: 135 lb × 8
- Set 2: 135 lb × 8
- Set 3: 185 lb × 8
- Set 4: 225 lb × 4
- Set 5: 275 lb × 3
- Set 6: 275 lb × 3
- Set 7: 275 lb × 3
- Set 8: **55 lb × 8**

The final set was entered incorrectly during the workout. There is currently no clear way to edit that completed set after the session has been finished.

Because Progress derives metrics from historical workout data, this kind of mistake can distort:
- session volume,
- exercise history,
- top-set calculations,
- estimated 1RM,
- PR calculations,
- future trend charts.

The user explicitly noted that mistakes are inevitable because there is a lot to enter during a workout.

## Problem Statement

Workout logging happens under physical and cognitive load. Users may be:
- fatigued,
- moving between sets,
- handling equipment,
- entering numbers quickly,
- using the app with one hand,
- dismissing the keyboard between sets.

Entry mistakes should therefore be treated as an expected workflow, not an edge case.

Setframe currently allows users to correct a set while the workout is active, but once the workout is completed, historical set data becomes effectively immutable from the user-facing review flow.

This creates two problems:

1. **Loss of trust in history**
   - Users can see incorrect data but cannot correct it.

2. **Downstream analytics corruption**
   - A single incorrect weight/reps value can affect volume, PRs, estimated 1RM, strength trends, and progress summaries.

## UX / Product Intent

Allow users to correct logged workout data from the completed workout review/history experience.

The primary mental model should be:

> I completed this workout, but I can still correct what I recorded.

The completed workout should remain clearly marked as completed. Editing historical values should **not** reopen the workout or change it back into an active session.

### Recommended interaction

In completed workout review:

- each set should have an edit affordance,
- tapping Edit should allow correction of fields relevant to that set's prescription type,
- saving should update the historical record,
- derived metrics should recalculate,
- the user should remain in the completed-review context.

For a strength `Sets + reps` exercise, editable fields may include:
- set type,
- weight,
- reps,
- RPE where applicable.

For other prescription types, use the same prescription-aware field rules defined elsewhere in Setframe.

### Do not expose irrelevant fields

Editing a completed cycling activity should not suddenly expose weight/reps.

Use the shared prescription representation model.

### Consider a lightweight edit mode

On mobile, avoid turning every completed set into an always-visible form.

Preferred pattern:

Completed state:

`Set 8   55 lb × 8   ⋯`

Overflow or Edit action:

`Edit set`

Then show a focused edit sheet / inline edit state.

This keeps historical review scannable while still allowing correction.

### Preserve provenance

Setframe does not need to make the user feel punished for editing history, but edits should be auditable internally where practical.

If the data model supports it, preserve:
- original created timestamp,
- updated timestamp,
- whether the set was edited after workout completion.

This is useful for debugging and future sync/conflict resolution.

Do not display a scary “modified” warning unless there is a real product need.

## Acceptance Criteria

- [ ] A user can edit a logged set after the workout has been completed.
- [ ] Editing a historical set does **not** reopen or reactivate the workout session.
- [ ] The completed workout remains in completed state after edits.
- [ ] Editable fields are determined by the exercise prescription type.
- [ ] Strength sets allow correction of weight, reps, set type, and RPE where supported.
- [ ] Non-strength activities do not expose irrelevant strength fields.
- [ ] Saving an edit updates the completed workout review immediately.
- [ ] Edited values persist after page/app reload.
- [ ] Session volume recalculates after a set edit.
- [ ] Top-set calculations recalculate after a set edit.
- [ ] Estimated 1RM recalculates after a set edit where applicable.
- [ ] PR state recalculates using the corrected historical data.
- [ ] Progress/history screens reflect the corrected data without requiring manual cleanup.
- [ ] Editing a value to blank/invalid state is prevented according to the representation's validation rules.
- [ ] Cancel leaves the original historical set unchanged.
- [ ] Failed API updates preserve the user's attempted edit and show a useful retry/error state.
- [ ] Duplicate save requests are prevented while an update is in progress.
- [ ] Mobile web and mobile app provide equivalent edit capability.
- [ ] Editing controls are accessible, touch-friendly, and keyboard-operable where applicable.

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

Treat this as a **historical data correction workflow**, not as a reopening-workout feature.

### Before coding

Audit the completed-workout/history architecture:

- completed session entity
- performed exercise records
- performed set records
- current API update capabilities
- whether sets are immutable after session completion
- derived metric calculations
- PR calculations
- Progress query/cache invalidation
- History query/cache invalidation
- mobile/web shared models

Determine whether an API already exists for updating a performed set.

If an update endpoint exists, reuse it.

If not, add the smallest safe API capability needed to update an existing performed set without changing session completion state.

### Do not mutate the workout template

A completed-session correction must update the **performed set**, not the reusable workout template.

For example:

Correcting:

`Lower A → Deadlift → Set 8 → 55 lb → 275 lb`

must not change the planned prescription for future Lower A workouts.

### Recalculate derived data

After a historical set changes, identify every derived value that depends on it.

At minimum inspect:

- session total volume
- exercise top set
- estimated 1RM
- weight PR
- rep PR
- exercise strength trend
- weekly volume
- completed workout summary
- Progress cards/charts

Do not patch each UI independently if these values come from shared domain calculations.

Invalidate/recompute the authoritative derived data and then refresh consumers.

### Coordinate with Story 10 — PR correctness

Historical editing must use the corrected PR calculation rules.

If a set that previously caused a PR is edited downward:
- stale PR state must disappear.

If an edited set now establishes a valid PR:
- the correct PR state should appear.

Do not persist stale PR badges independently of the corrected set.

### Coordinate with Story 09 — prescription-aware inputs

The edit UI should use the same shared field definition as active logging.

Do not create a separate “historical edit” field matrix.

Examples:

**Sets + reps**
- weight
- reps
- set type
- optional RPE

**Distance + duration**
- distance
- unit
- duration
- optional RPE if supported

**Duration**
- duration
- relevant optional fields

### Recommended mobile UX

Prefer a compact review row/card and a focused edit state.

Example:

`Set 8`
`55 lb × 8`
`[•••]`

Then:

`Edit set`

Open:
- a bottom sheet,
- modal,
- or inline editor,

using the same stable mobile-overlay primitives from Story 20.

Do not render every completed set as a large editable form by default. The review screen should remain easy to scan.

### Data integrity

If updates are optimistic:
- preserve previous value for rollback,
- show clear save/error state,
- avoid temporary incorrect Progress calculations if the mutation fails.

If server-derived metrics are authoritative:
- refresh them after mutation.

If client-derived metrics are authoritative:
- recalculate from the updated set immediately.

### Regression test based on the actual gym scenario

Create a completed Deadlift session containing:

- 135 × 8
- 135 × 8
- 185 × 8
- 225 × 4
- 275 × 3
- 275 × 3
- 275 × 3
- 55 × 8

Then:

1. open completed workout review,
2. edit the final set from `55 × 8` to the intended value,
3. save,
4. verify completed state is unchanged,
5. verify the set displays the corrected value,
6. reload,
7. verify correction persists,
8. verify volume/top set/e1RM/PRs reflect the corrected data,
9. verify the reusable workout template was not modified.

Also test:
- Cancel,
- invalid input,
- API failure,
- editing a non-strength prescription,
- editing/deleting a record that previously affected a PR.

### Scope boundary

This story is about **correcting performed historical data**.

Do not expand it into:
- full workout restructuring,
- changing the scheduled workout,
- editing the program template,
- reopening completed sessions,
- redesigning History,
- broad analytics redesign.

Those can be separate stories if needed.
