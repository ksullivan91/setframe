# Story 14 — Turn Sessions, Streak, Consistency, and Weekly Volume into Comparable Trends

## User Story

As a user reviewing training consistency, I want to see how often and how much I have trained across recent weeks so that I can understand whether my routine is becoming more or less consistent.

## Screenshot / Gym-Test Evidence

Screenshots show Sessions this week, Current streak, and Weekly volume as large full purple bars, while Consistency (last 8 weeks) contains essentially one dot plus summary text. The values are understandable, but the visuals do not show the multi-week pattern they claim to summarize.

## Problem Statement

Consistency should show behavior over time. Weekly volume is also a discrete time series. Users need to know whether 8,005 lb is higher or lower than recent weeks, not see a full bar with no scale. Streak is a summary metric and may not need its own giant chart.

## UX / Product Intent

Create a coherent Training consistency section. Use an 8–12 week column chart for completed sessions, a separate weekly volume series for valid strength volume, and show current/longest streak as supporting summary text or badges. Only show target lines if the user has a configured target.

## Acceptance Criteria

- [ ] The 8-week view visually includes multiple weeks, including zero-session weeks.
- [ ] Current week is distinguishable.
- [ ] Current/longest streak are visible without meaningless full bars.
- [ ] Weekly volume shows historical totals and comparison context.
- [ ] Volume excludes non-load activities.
- [ ] No full bar is shown without a defined denominator.
- [ ] One-session users get a graceful sparse-data state.
- [ ] Weekly bucketing is consistent across web/mobile.
- [ ] Charts use the shared interactive system.

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

Audit definitions for completed session, week boundaries, streak, and weekly volume. Document rules before visualization changes. Make aggregation a domain/service concern. Use prescription semantics from active-workout Story 09 when deciding which sets contribute to load volume.

