# Story 53 — Surface Write Failures in the Mobile Workout Logger

## User Story

As a user logging sets on my phone in a gym with poor signal, I want a failed
save to tell me it failed so that I do not walk away believing I logged work
that was never recorded.

## Problem Statement

`apps/mobile/app/(tabs)/training.tsx` — the active workout logger, the screen
where training is actually recorded — declares **six mutations and handles
errors on none of them**:

| Mutation | `onError` | Web equivalent |
|---|---|---|
| `deleteSetMutation` | none | `'Could not remove set.'` |
| `addSetMutation` | none | `'Could not add set.'` |
| `saveSetMutation` | none | inline retry indicator |
| `addExerciseMutation` | none | `'Could not add exercise.'` |
| `createExerciseMutation` | none | — |
| `finishMutation` | none | `'Could not finish workout.'` |

Each is `useMutation({ mutationFn, onSuccess: refreshSession })`. When the
request fails, `onSuccess` does not run, nothing else is registered, and the
UI simply does not change. **A failed save is pixel-identical to a successful
one.**

`apps/mobile/app/(tabs)/today.tsx:320` has the same omission on
`startWorkoutMutation`, where web shows
`'Could not open workout.'` with a `'Retry now'` action.

This is not a cosmetic gap. The realistic failure is a phone on gym wifi or
a dead cellular corner: the user logs a set, sees no change, assumes it
saved, and continues. The set is gone. Tapping "Finish workout" on a failed
request leaves the session `in_progress` indefinitely with no indication why.

### Web's contrast is deliberate and already built

`apps/web/src/pages/WorkoutSessionPage.tsx` does two things mobile does not:

1. Four of its mutations carry an `onError` that raises a toast.
2. `saveSetMutation` — the highest-frequency write — is wrapped in
   `useAsyncStatus()` with a `lastMutationRef`, rendering an
   `AsyncStatusIndicator` with a working **Retry** (lines 425-426, 595-597,
   814-815). A failed save is both visible and recoverable without
   re-entering the values.

**Mobile already has the components for this.** `src/components/Toast.tsx`
supports `actionLabel`/`onAction` and its own docstring cites "§15's offline
'retry failed writes' requirement". `today.tsx` already uses it for rest-day
errors. The logger simply never adopted it.

## UX / Product Intent

A write that fails must say so, and — for set saves specifically — must be
retryable without retyping. Values the user entered are never discarded on
failure.

Silence is the specific thing being fixed. An error state that merely logs to
the console is not a fix.

## Acceptance Criteria

- [ ] Every mutation in the mobile workout logger surfaces a visible error.
- [ ] `startWorkoutMutation` in `today.tsx` surfaces a visible error.
- [ ] A failed set save keeps the user's entered values available for retry.
- [ ] Set save offers an explicit retry that does not require re-entry.
- [ ] A failed "Finish workout" leaves the session usable and says what
      happened, rather than appearing to do nothing.
- [ ] Error copy names the action that failed, matching web's wording where
      an equivalent exists.
- [ ] Errors are announced to screen readers, not conveyed by colour alone.
- [ ] Tests cover at least: failed set save shows an error, and retry after a
      failure succeeds without re-entering values.

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

## Claude Steering Document

Reuse `src/components/Toast.tsx`; do not introduce a second notification
mechanism. `today.tsx` shows the established local-state pattern
(`const [toast, setToast] = useState(...)` plus a conditional `<Toast/>`),
and `training.tsx` already holds a `toast` state variable for other purposes
— check before adding another.

Consider whether mobile should gain an equivalent of web's `useAsyncStatus`.
Web's version earns its complexity on `saveSetMutation` specifically, because
that write is frequent and re-entering a set is genuinely costly. A toast is
sufficient for the other five. Do not port the abstraction wholesale if a
toast covers the case — but do not leave set save without retry either.

### Do not paper over the failure

Resist optimistic UI here. Showing a set as saved and reconciling later is
strictly worse than the current behaviour in the gym-signal scenario: it
actively asserts a false success. If offline queueing is wanted, that is a
separate, larger story and should be raised as one rather than smuggled in.

### Scope

`saveSetMutation` on web also lacks an `onError` — it relies on the async
status indicator instead. That is a deliberate design, not an oversight;
mirror the *outcome* (visible failure, working retry), not the absence of the
handler.
