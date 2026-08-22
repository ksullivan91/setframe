# Story 04 — Redesign Responsive Workout-to-Day Scheduling

## User Story

As a user assigning workouts to my week, I want the schedule editor to remain readable and easy to tap on a phone so that I can configure my program without clipped labels or cramped day pills.

## Screenshot / Gym-Test Evidence

Screenshot 4 shows the weekly day pills compressed into one horizontal row. `Unassigned` is clipped/truncated, the selected workout wraps, and the seven-day layout is too dense for the available mobile width.

## Problem Statement

The desktop-oriented seven-column interaction does not translate to mobile. The current UI sacrifices legibility and tap confidence to keep every day visible at once.

## UX / Product Intent

Use a mobile-first schedule interaction rather than shrinking seven desktop columns.

Preferred mobile direction:
- show the currently selected workout clearly
- list the seven days vertically, or use a two-column responsive list/grid
- each day row/card displays the assigned workout or `Rest / Unassigned`
- tapping a day assigns the currently selected workout
- assigned days can be cleared or changed without relying on tiny pills

Desktop may retain a week-grid if it remains readable, but behavior and terminology must match mobile.

## Acceptance Criteria

- [ ] No day label or assignment value is clipped at supported mobile widths.
- [ ] All seven days are comfortably tappable without horizontal scrolling.
- [ ] The currently selected workout is visually clear.
- [ ] A user can assign, change, and clear a day with obvious feedback.
- [ ] Assigned workout names wrap gracefully or truncate intentionally with accessible full text.
- [ ] The layout adapts appropriately between mobile and desktop rather than simply scaling the same grid.
- [ ] Keyboard and screen-reader users can understand selected workout and assigned day state.
- [ ] Mobile web and mobile app use equivalent scheduling behavior.


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

First inspect the schedule data model and current click semantics. Preserve the existing assignment behavior unless a change is required for clarity.

Do not use horizontal scrolling as the default solution for seven days on mobile.

Consider a vertical mobile editor such as:
`Sunday — Upper B`
`Monday — Rest`
etc.

Compare mobile web and mobile app side-by-side with the Figma reviewer before closing this story.
