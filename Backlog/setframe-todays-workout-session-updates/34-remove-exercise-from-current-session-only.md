# Story 34 — Allow Removing an Exercise From the Current Workout Session Only

## User Story

As a user in an active workout, I want to remove an exercise from **today's session only** so that I can adapt to changing conditions without altering the reusable workout template in my training program.

## Screenshot / Gym-Test Evidence

The screenshots show an active workout containing **Outdoor Cycle**, planned for `5 mi / 30 min`.

During the workout, weather conditions changed and the user needed to cancel the cycling portion.

The user was able to remove the set, leaving the exercise card in this state:

- `Outdoor Cycle`
- `Planned: 5 mi / 30 min`
- `No sets logged yet — add the first set to start recording actual performance.`

There is currently no obvious action to remove the **exercise itself** from the active session.

The desired behavior is explicitly session-scoped:
- remove Outdoor Cycle from **today's workout**,
- keep Outdoor Cycle in the saved workout template/program,
- future occurrences of the workout should still include it.

## Problem Statement

Setframe already allows a live workout to diverge from the planned template through set-level editing and adding exercises, but it does not provide the inverse operation at the exercise level.

This creates an asymmetry:

- Add an exercise to today's session: supported.
- Remove a set from today's session: supported.
- Remove an exercise from today's session: not supported.

Real workouts are adaptive. Equipment can be unavailable, weather can change, fatigue can alter the plan, or the user may intentionally skip a movement.

The user should not need to edit the underlying program just to reflect what happened today.

## UX / Product Intent

Add an exercise-level action to active workout sessions:

`Remove from today's workout`

This action must operate on the **session instance**, not the workout template.

### Recommended interaction

Expose exercise actions through the existing exercise-level overflow/action area where possible.

Suggested menu:

- Move up/down where relevant
- Edit / session-specific options where relevant
- **Remove from today's workout**

Avoid a permanently visible destructive button on every exercise card.

### Confirmation behavior

If the exercise has **no logged sets**, removal can be lightweight:

`Remove Outdoor Cycle from today's workout?`

Supporting copy:

`This only changes today's session. Outdoor Cycle will stay in the workout template.`

If the exercise **has logged sets**, do not silently discard data.

Offer a more explicit confirmation, for example:

`Remove exercise and its 2 logged sets from today's workout?`

Explain that:
- session data for those sets will be removed,
- the program/workout template remains unchanged.

If product policy prefers preserving logged history, an alternative is:
- mark exercise as skipped,
- preserve sets/history,
- exclude it from completion metrics.

Copilot must inspect the existing session/history model before choosing between hard session deletion and a skipped/session-removed state.

### After removal

The exercise should disappear from the active session list.

If useful, show a brief toast:

`Outdoor Cycle removed from today's workout.`

If the app supports undo safely:

`Undo`

Undo should restore the session exercise and its session-scoped plan/state without affecting the program template.

## Acceptance Criteria

- [ ] Active workout exercise cards expose an action to remove the exercise from the current session.
- [ ] The action clearly communicates that it affects **today only**.
- [ ] Removing an exercise does not remove it from the saved workout template.
- [ ] Removing an exercise does not remove it from the parent program.
- [ ] Future scheduled occurrences of the workout still include the exercise.
- [ ] If the exercise has no logged sets, removal is simple and intentional.
- [ ] If the exercise has logged sets, the user receives explicit confirmation before data is removed or skipped.
- [ ] Existing session data is not silently lost.
- [ ] Session summary totals update correctly after removal.
- [ ] Completion/review screens reflect the actual exercises performed in the session.
- [ ] Progress/history calculations do not treat a removed session exercise as completed.
- [ ] Removing one exercise does not disturb set state for other exercises.
- [ ] A success confirmation is shown after removal.
- [ ] Undo is supported if it can be implemented safely with the existing session model.
- [ ] Mobile web and mobile app expose equivalent session-only removal behavior.
- [ ] Behavioral tests verify the underlying workout template remains unchanged.

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

Treat this as a **session override** capability.

Do not implement it by deleting the exercise from the user's workout template.

### First audit

Trace the domain relationships between:

- Program
- Workout template
- Workout exercise / planned exercise
- Workout session
- Session exercise
- Logged set

Determine whether an active session already has a materialized copy of planned exercises or whether the UI is rendering directly from the template plus session data.

That distinction determines the safest implementation.

### Preferred domain behavior

The active session should be able to represent:

`planned exercise exists in template`
+
`exercise omitted/removed for this session`

Possible models include:
- deleting a session-exercise instance while retaining template reference,
- storing a `removed` / `skipped` override,
- storing a session-level exclusion list.

Use the smallest model consistent with existing architecture.

### Important distinction: remove vs skip

Inspect existing Rest Day / skip semantics.

An exercise removed because of weather or availability may be better represented internally as `skipped` if historical context matters.

However, the user-facing action can still be:

`Remove from today's workout`

Do not expose implementation terminology unnecessarily.

### Logged-set safety

If logged sets exist, never silently delete them.

If removal means deletion:
- require confirmation,
- recalculate volume/summary/PR state.

If removal means skipped:
- decide whether prior logged sets can coexist with skipped status; likely not.

### Summary calculations

After removal, verify:
- exercise count,
- sets logged,
- volume,
- duration/distance totals,
- PR calculations,
- completion summary.

### Regression scenario

1. Program contains Recovery Day A.
2. Recovery Day A contains Outdoor Cycle.
3. Start today's Recovery Day A.
4. Remove Outdoor Cycle from today's session.
5. Finish workout.
6. Review completed workout: Outdoor Cycle is absent/skipped according to product semantics.
7. Open Training → Recovery Day A: Outdoor Cycle still exists.
8. Start a future Recovery Day A: Outdoor Cycle appears again.

### Scope boundary

Do not add program-template deletion.
Do not redesign the entire active workout card.
Do not automatically remove exercises merely because all sets were deleted.

This story is specifically about **intentional session-only exercise removal**.
