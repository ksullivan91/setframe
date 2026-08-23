# Story 13 — Replace Body-Weight Bars with a Meaningful Weight Trend

## User Story

As a user tracking morning weigh-ins, I want to see my weight change over time with individual check-ins and a useful trend so that I can distinguish daily fluctuation from actual direction.

## Screenshot / Gym-Test Evidence

Screenshots show body weight represented by one or two full purple bars. With one entry, the bar communicates no scale. With two check-ins, two equally full bars appear while text reports a delta such as -1.8 lb over 2 check-ins. The text is useful; the bars do not visually encode the change.

## Problem Statement

Body weight is inherently a time series. A bar filled to 100% does not communicate whether 166.8 lb is higher, lower, stable, or close to a goal. Multiple full bars are actively confusing.

## UX / Product Intent

Replace the bars with an interactive line/point chart. Plot each check-in by local date, show exact values as points, show current value and selected-range delta, and optionally add a rolling average/trend line only after enough observations exist. For one check-in, show the point and say more data is needed. For two, show the actual two-point change without overclaiming a long-term trend.

## Acceptance Criteria

- [ ] Body weight is displayed as a dated time series.
- [ ] One check-in does not imply a trend.
- [ ] Two check-ins display their actual difference and dates.
- [ ] Selected-range delta is correct.
- [ ] Smoothing only appears after an explicit minimum data threshold.
- [ ] Raw measurements stay visible.
- [ ] Units follow user settings.
- [ ] Same-day/date rules match the Morning Weight date-scoping story.
- [ ] Mobile web and mobile app match.

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

Reuse Story 12 chart infrastructure. Define smoothing algorithm outside chart components. Use the same canonical timezone/date rules as Today. Test 1 point, 2 points, skipped days, range calculations, unit formatting, and timezone boundaries.

