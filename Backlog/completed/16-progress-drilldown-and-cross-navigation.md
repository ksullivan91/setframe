# Story 16 — Make Progress Charts Drillable into the Underlying History

## User Story

As a user exploring a trend, I want to tap a point, week, exercise, or session and inspect the underlying records so that Progress helps me understand why a metric changed.

## Screenshot / Gym-Test Evidence

The current Progress screen shows summary cards and Recent Completed Sessions, but there is little visible relationship between summary metrics and the exact records that produced them. Richer charts will be much more useful if users can move from what changed to what happened.

## Problem Statement

Progress should connect summary → trend → underlying record. Examples: tap a body-weight point to see that check-in context; tap a weekly-volume column to see contributing sessions; tap an exercise trend point to open that session/exercise history; tap a recent completed session to open the completed workout.

## UX / Product Intent

Use existing History/session detail surfaces for drill-down. Preserve selected range/filter context when navigating back where practical. Accessibility users must be able to reach the same details without chart gestures.

## Acceptance Criteria

- [ ] Chart selections expose date/value context.
- [ ] Users can navigate from selected points/periods to relevant history/detail.
- [ ] Weekly aggregates identify contributing sessions.
- [ ] Exercise trend drill-down preserves exercise context.
- [ ] Recent completed sessions are clearly actionable.
- [ ] Back navigation preserves Progress context where practical.
- [ ] No duplicate detail implementation is created.
- [ ] Mobile web/mobile app behavior matches.
- [ ] Accessible fallback navigation exists.

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

Reuse existing History/session-detail routes. Do not create chart-specific duplicate detail screens. Preserve filter/date-range context in route/app state where architecture supports it. Test point selection, aggregate selection, exercise navigation, back navigation, missing/deleted underlying records, and accessibility fallback.

