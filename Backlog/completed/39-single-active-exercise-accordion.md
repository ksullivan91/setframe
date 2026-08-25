# Story 39 — Use Single-Active Exercise Accordion Behavior During Workout Logging

## User Story

As a user moving from one exercise to the next, I want the exercise I was just working on to collapse when I begin interacting with another exercise so that the workout stays compact and focused without requiring manual cleanup.

## Problem Statement

Collapsible sections help only if users do not accumulate many open exercises.

However, implementing this literally on DOM `blur` would be fragile because focus changes constantly between controls inside the same exercise.

## UX / Product Intent

Use a **single-active exercise** model.

An exercise remains expanded while interaction stays within it.

When the user intentionally interacts with another exercise:
- collapse the previous exercise,
- expand the new one,
- re-evaluate the previous exercise's derived completion state.

### What counts as switching

Examples:
- tapping another exercise header,
- focusing an input belonging to another exercise,
- choosing an action inside another exercise.

Do not collapse merely because:
- keyboard closes,
- focus moves between controls in the same exercise,
- a modal opens from the current exercise,
- browser focus temporarily changes.

Users can still manually collapse the active exercise.

## Acceptance Criteria

- [ ] Mobile workout uses a single-active exercise accordion.
- [ ] Interacting with another exercise collapses the previous one.
- [ ] Newly selected exercise expands.
- [ ] Moving between controls inside the same exercise does not collapse it.
- [ ] Opening a modal/action from the current exercise does not unexpectedly collapse it.
- [ ] Previous exercise completion state is re-evaluated after leaving it.
- [ ] Story 38 owns completion logic; blur does not.
- [ ] Manual collapse remains available.
- [ ] Switching exercises does not lose unsaved input.
- [ ] No viewport instability or horizontal overflow is introduced.
- [ ] Sticky actions from Story 36 do not obscure the newly active exercise.
- [ ] Keyboard/screen-reader behavior remains predictable.
- [ ] Mobile app and mobile web are equivalent.

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


## Copilot Steering Document

Do **not** implement this as a simple `onBlur` collapse.

Track an active session-exercise id, e.g.:

`activeExerciseId: string | null`

When interaction targets another exercise:
1. preserve/persist prior local state,
2. update active exercise,
3. collapse previous,
4. expand next.

For web focus events, inspect containment/related target rather than treating every blur as departure.

Touch behavior must not depend solely on focus.

Story 38 owns completion calculation; this story only ensures the latest derived state is displayed when the exercise becomes inactive.

If needed, use minimal scroll-into-view behavior with proper scroll margin so Story 36's sticky action surface does not cover the newly active section.

### Scope boundary

Do not create a global accordion system, change the program editor, or make blur itself the completion mechanism.
