# Story 36 — Keep Active Workout Session Actions Reachable During Long Workouts

## User Story

As a user logging a long workout, I want **Add exercise** and **Finish workout** to remain easy to reach while I am deep in the session so that I do not have to scroll through many completed exercises and sets just to perform a session-level action.

## Screenshot / Gym-Test Evidence

The screenshot shows the active **Workout session** page with two session-level actions placed directly beneath the page title:

- `Add exercise`
- `Finish workout`

This layout works near the beginning of a workout.

However, both the user and a beta tester completed large workouts and found it inconvenient to scroll all the way back to the top of a long session to:

- add an unplanned exercise,
- finish the workout.

The problem becomes more noticeable as Setframe succeeds at supporting larger, more detailed workout sessions because each exercise can contain multiple large set cards.

## Problem Statement

`Add exercise` and `Finish workout` are **session-level actions**, but they are positioned like page-header actions.

Their importance does not disappear as the user scrolls.

During a workout, the user's attention is normally near the exercise/set currently being performed. Requiring navigation back to the top introduces unnecessary physical and cognitive friction.

At the same time, permanently duplicating two large buttons throughout the interface could:
- consume too much mobile screen space,
- compete with Setframe's bottom navigation,
- obscure active set controls,
- make `Finish workout` too easy to trigger accidentally.

## UX / Product Intent

Move session-level actions into a **persistent but compact workout action surface** that remains available throughout the session.

### Recommended mobile pattern: sticky workout action bar

Use a compact sticky action bar immediately **above Setframe's bottom navigation** while a workout is active.

Suggested structure:

`+ Add exercise`      `Finish workout`

Hierarchy:
- `Add exercise` = secondary / outlined action
- `Finish workout` = primary action

The bar should:
- remain visible as the user scrolls through exercises,
- be visually distinct from the global app navigation,
- use safe-area spacing correctly,
- avoid covering the final set/card content,
- disappear after the workout is completed.

### Do not simply stack another large navigation row

The action surface should be noticeably more compact than the current header buttons.

The goal is persistent reachability, not permanent visual dominance.

### Page header

Once persistent actions exist, simplify the workout page header.

Recommended:

**Workout session**  
`Monday, August 24`

Do not retain redundant full-size Add Exercise / Finish Workout buttons at the top unless desktop usability testing shows duplication is helpful.

### Finish confirmation

Because `Finish workout` becomes persistently reachable, protect against accidental completion.

If the existing product already confirms finishing, preserve that behavior.

If it does not, use a lightweight confirmation when needed:

**Finish workout?**

`You logged 7 exercises and 24 sets. You can review the workout after finishing.`

Actions:
- `Finish workout`
- `Keep training`

If there are incomplete/planned exercises, the dialog may mention them without forcing completion.

### Desktop / wide web

Do not force a mobile bottom bar onto desktop if a better persistent layout exists.

Recommended desktop options:
- sticky top action region within the workout content column, or
- compact sticky action rail/header aligned to the session content.

The semantic hierarchy must remain the same:
- Add exercise = supporting action
- Finish workout = primary session action

## Acceptance Criteria

- [ ] `Add exercise` remains reachable without scrolling back to the top of a long active workout.
- [ ] `Finish workout` remains reachable without scrolling back to the top of a long active workout.
- [ ] On mobile, session-level actions use a compact persistent surface above the global bottom navigation.
- [ ] The persistent action surface does not cover workout content.
- [ ] The final exercise/set can be fully scrolled above the persistent controls.
- [ ] Safe-area insets are respected on iOS devices.
- [ ] The persistent action surface does not cause horizontal scrolling.
- [ ] The persistent action surface does not conflict with Setframe's bottom navigation.
- [ ] `Add exercise` retains secondary visual hierarchy.
- [ ] `Finish workout` retains primary visual hierarchy.
- [ ] Finishing cannot occur accidentally from a stray tap; existing confirmation behavior is preserved or improved.
- [ ] The persistent controls disappear once the workout has been completed.
- [ ] The controls behave correctly while modals, keyboards, dropdowns, and toasts are shown.
- [ ] Opening Add Exercise from the sticky action surface preserves all current workout data.
- [ ] Desktop/wide web has an equivalent persistent session-action solution appropriate to the larger layout.
- [ ] Mobile web and mobile app implement equivalent behavior and hierarchy.
- [ ] Figma reviewer validates that the persistent controls are useful without becoming visually dominant.
- [ ] GitHub reviewer validates that the implementation does not duplicate session-action logic unnecessarily.

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

Treat this as a **session-level action placement and reachability** story.

Do not merely make the existing header `position: sticky` without evaluating how it interacts with:
- large page title,
- Safari browser chrome,
- Setframe bottom navigation,
- safe areas,
- keyboard,
- modals,
- toast notifications.

### Recommended architecture

Separate the **actions themselves** from their presentation.

There should be one source of truth for:
- add-exercise action,
- finish-workout action,
- loading/disabled states,
- confirmation behavior.

Then render those actions in the appropriate responsive container.

Conceptually:

`WorkoutSessionActions`
- AddExerciseAction
- FinishWorkoutAction

Presentation:
- mobile → sticky bottom session-action bar above app nav,
- desktop → sticky header/action region.

Do not maintain separate business logic for header and sticky versions.

### Sticky positioning

On mobile, account for the height of Setframe's persistent bottom navigation.

The session action bar should sit above it rather than underneath it.

Use existing design tokens / layout variables if available rather than hard-coded navigation heights.

Where supported, include:

`env(safe-area-inset-bottom)`

through the shared layout system.

### Content clearance

Add sufficient bottom padding to the scrollable workout content so the final controls/card are not hidden beneath:
- session action bar,
- app bottom nav,
- device safe area.

Do not solve this by arbitrary large padding values. Derive spacing from actual component heights/tokens where possible.

### Scroll behavior

The sticky action surface must remain stable while:
- scrolling long workouts,
- adding/removing sets,
- adding/removing exercises,
- toasts appear,
- a modal opens/closes.

It must not contribute to the horizontal-overflow bug covered by Story 35.

### Finish state

Audit:
- active,
- saving,
- finishing,
- completed.

While finishing:
- disable repeated finish requests,
- show visible loading state,
- prevent duplicate completion API calls.

After completion:
- remove the persistent action surface,
- transition to the completed/review state.

### Add Exercise state

While Add Exercise is opening/loading:
- preserve workout session state,
- avoid duplicate modal instances,
- preserve the user's scroll position when the modal closes.

### Responsive guidance

Do not assume desktop needs the same bottom-fixed presentation.

For wide screens, a sticky action row near the content header is likely more natural.

The requirement is **persistent reachability**, not identical geometry.

### Accessibility

- Buttons need clear accessible names.
- Sticky controls must remain in a sensible keyboard focus order.
- Do not trap focus in the sticky bar.
- Confirmation dialog must manage focus correctly.

### Behavioral tests

Cover:

1. Start a workout with many exercises/sets.
2. Scroll near the bottom.
3. Add Exercise is still accessible.
4. Add an exercise.
5. User returns to approximately the same session position.
6. Scroll near the bottom.
7. Finish Workout is still accessible.
8. Finish confirmation appears if applicable.
9. Complete workout.
10. Sticky session actions disappear.

Also test:
- small iPhone viewport,
- mobile browser chrome expanded/collapsed,
- keyboard open/closed,
- no horizontal overflow.

### Scope boundary

Do not redesign individual exercise/set cards.
Do not alter program-template editing.
Do not make global Setframe navigation sticky in a new way.
Do not add unrelated workout controls to the action bar.

This story is specifically about keeping **session-level actions reachable during long workouts**.
