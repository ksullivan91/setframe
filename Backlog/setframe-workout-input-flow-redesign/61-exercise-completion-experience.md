# Story 61 — Create an Automatic, Celebratory Exercise-Completion Experience

## User Story
As a user finishing an exercise, I want Setframe to clearly and positively acknowledge that accomplishment and move me forward so completing an exercise feels rewarding rather than like another form state.

## Screenshot / Gym-Test Evidence
The current complete treatment adds completion copy into an already crowded exercise header. It is technically informative but emotionally flat.

The Today-page completed-workout card demonstrates a much better direction: green success styling, stronger visual hierarchy, useful summary metrics, and an unmistakable sense that something was accomplished.

## Problem Statement
Workout logging is effort. If Setframe asks the user to enter detailed data, completion moments should return a small amount of delight and momentum.

The current exercise state does not visually separate “still working” from “finished.”

## Completion Rule
An exercise is complete when **all required fields for all required/logged sets are valid and persisted/optimistically accepted according to representation semantics**.

Examples:
- weighted sets + reps: required weight where applicable + reps,
- bodyweight reps: reps,
- duration: duration,
- distance + duration: both required values,
- optional RPE must never block completion.

Completion must use one shared domain rule, not ad hoc UI checks.

## UX / Product Intent

### Automatic transition
When the final required set becomes complete:
1. immediately update exercise progress,
2. transition exercise to completed styling,
3. collapse Detailed Sets automatically,
4. leave a compact completed summary visible.

### Completed visual direction
Use the completed-workout card as inspiration, scaled down appropriately.

Possible treatment:
- subtle mint/green tinted surface,
- green border/accent,
- check icon with a small contained celebratory motion,
- exercise title remains prominent,
- concise summary such as `3 sets · 115 lb × 6` or representation-specific equivalent,
- optional `Completed` label only if it adds clarity rather than clutter.

The whole card should communicate completion visually; do not depend on another text badge.

### Motion
Use restrained motion:
- quick check transition,
- subtle background/border transition,
- no confetti storm.

Respect reduced-motion preferences.

### Reopening
Completed exercises remain expandable/editable.

If the user changes data so the exercise no longer satisfies completion requirements, return it to incomplete state gracefully.

## Acceptance Criteria
- [ ] One shared completion function/domain rule exists per representation.
- [ ] Optional fields such as RPE do not block completion.
- [ ] Final successful set causes the exercise to collapse automatically.
- [ ] Completed exercise has a visually distinct green/success treatment.
- [ ] Treatment is more than a small text label.
- [ ] Completed summary is concise and representation-aware.
- [ ] Completion animation respects reduced motion.
- [ ] Completed exercise can be reopened and edited.
- [ ] Editing required data back to invalid/incomplete removes completed state correctly.
- [ ] Optimistic completion reconciles correctly if a save fails.
- [ ] Screen readers announce completion state change without excessive repetition.
- [ ] Figma reviewer validates the state as meaningfully rewarding without becoming visually noisy.

## Definition of Done
Apply the product-wide Definition of Done from this pack's README.

## Copilot / Claude Steering Document

Do not implement completion solely with CSS against `savedSetCount === plannedSetCount` unless that exactly matches the domain semantics.

Create a reusable domain function, conceptually:

```ts
isSessionExerciseComplete(exercise, sets, representation)
```

The same rule should power:
- the exercise card,
- progress counts,
- session summary,
- future analytics.

### Completion card content
Avoid dumping all set details into the collapsed state. Favor a compact summary plus an `Edit/View sets` affordance.

### Delight principle
The success state should feel like progress, not like an alert. Use the Today-page Workout Complete visual language as a reference family, not as a literal copy.
