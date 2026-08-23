# Story 11 — Reframe Progress Around Questions Users Actually Want Answered

## User Story

As a user reviewing my fitness progress, I want the Progress screen to clearly answer how my training, body weight, consistency, and performance are changing so that I can understand what is working without decoding ambiguous cards.

## Screenshot / Gym-Test Evidence

Screenshots 1–6 show the current Progress experience as a vertical series of cards such as Sessions this week, Current streak, Weekly volume, Consistency (last 8 weeks), Body weight, exercise-specific estimated 1RM, and Recent completed sessions. Several cards contain large solid purple bars with no axis, target, legend, scale, or comparison baseline. When more than one value is available, multiple full bars can appear side-by-side, but their meaning is still unclear.

## Problem Statement

The Progress page exposes metrics without enough context to answer the user's real questions: Am I training more or less consistently? Is body weight trending up or down? Is strength improving? Is weekly training volume changing? How does this week compare with recent weeks? Which exercises are progressing? A full-width bar is useful only when the user understands what 100% means. If there is no explicit goal or scale, it reads as decoration rather than information.

## UX / Product Intent

Redesign the Progress information architecture around **trends and comparisons**, not isolated values. Recommended structure: Overview, Training, Strength, Body weight. Do not create tabs solely because this prompt lists sections; use the hierarchy that best fits the existing codebase and mobile navigation. The screen should progressively answer summary → trend → detail.

## Acceptance Criteria

- [ ] Every visualization or bar has an explicit meaning, scale, comparison, or goal.
- [ ] Decorative full-width bars with no interpretable baseline are removed or replaced.
- [ ] The first viewport communicates at least one meaningful trend rather than only raw totals.
- [ ] Current values remain available alongside trend context.
- [ ] Training, strength, body weight, and consistency concepts are clearly distinguished.
- [ ] Invalid metrics for an exercise type are not displayed.
- [ ] Recent completed sessions remain easy to find.
- [ ] Sparse-data states do not fabricate trends.
- [ ] Mobile web and mobile app use the same metric semantics.
- [ ] Desktop uses extra space intentionally without becoming a dashboard of unrelated cards.

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

Before coding, inventory every metric currently returned to Progress and identify its data source, calculation, date range, whether a goal exists, whether it is a point-in-time metric or trend, valid prescription types, and minimum data required. Create a Progress domain/view-model layer with explicit concepts such as current value, comparison value, delta, date range, series, units, and insufficient-data state. Avoid component-level business calculations that could drift between web and mobile.

