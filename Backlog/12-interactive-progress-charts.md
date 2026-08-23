# Story 12 — Introduce Interactive, Time-Range Aware Progress Charts

## User Story

As a user reviewing my progress, I want to interact with charts across meaningful time ranges so that I can inspect specific dates, compare recent periods, and understand trends instead of seeing unexplained bars.

## Screenshot / Gym-Test Evidence

The screenshots show solid purple progress bars occupying much of several cards. They do not expose historical points, dates, comparison values, or interaction. The desired richer graph experience should be closer to the exploratory patterns found in Apple Health and MyFitnessPal, without copying either product.

## Problem Statement

Progress should become an exploratory surface. Users should be able to switch meaningful time ranges, inspect individual points, understand units and dates, compare current behavior with history, and see trends without reconstructing data from session cards.

## UX / Product Intent

Create a reusable Setframe chart system. Support appropriate time ranges (for example 1W, 1M, 3M, 6M, 1Y, All), point inspection on touch/hover, line charts for continuous measures, columns for weekly totals, and dots for individual check-ins. Do not add charts everywhere; only where a series helps answer a real question. Provide accessible text summaries/data fallback and no color-only encoding.

## Acceptance Criteria

- [ ] Reusable chart abstraction exists across Progress use cases.
- [ ] Users can change visible date range where sufficient data exists.
- [ ] Tap/hover exposes exact date/value/units.
- [ ] Scale and units are understandable.
- [ ] Charts work at narrow mobile widths.
- [ ] Empty/one-point states do not render misleading trends.
- [ ] Loading reserves chart space appropriately.
- [ ] Screen-reader users receive equivalent textual meaning.
- [ ] Mobile web and mobile app interactions are parity-reviewed.

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

Evaluate existing chart dependencies before adding a library. Do not introduce a large package without justification. Use a library-agnostic series contract: timestamp/date, value, optional metadata. Keep calculations outside rendering components. Test single-point, sparse dates, multi-point, range switching, empty state, and tooltip formatting.

## Product / UX Inspiration

Apple Health is useful inspiration because it organizes health data into historical views/highlights and surfaces meaningful trends. MyFitnessPal is useful inspiration because users can open historical measurement data and change the visible time frame. Use these as interaction references, not designs to copy.

Sources:
- Apple Health: https://support.apple.com/guide/iphone/get-started-with-health-iphcae7451f3/26/ios/26
- Apple Health trends/sharing: https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/26/ios/26
- MyFitnessPal measurement history: https://support.myfitnesspal.com/hc/en-us/articles/360032624431-How-do-I-record-my-weight-and-other-measurements
- MyFitnessPal Today/Progress: https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Your-Today-tab