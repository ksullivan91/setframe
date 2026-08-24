# Story 33 — Create a Consistent Interactive Chart Detail Pattern Across Progress

## User Story

As a user exploring Progress charts, I want every chart to reveal exact values and period context in a consistent way so that I can inspect my data without guessing what a bar, point, or line represents.

## Screenshot / Product-Test Evidence

Current Setframe charts include helper text such as:
- `Select a bar to see its period and value.`
- `Select a point to see its date and value.`

This is a good direction, but charts still provide limited persistent context.

The reference screenshots show useful interaction patterns:
- Apple Health displays a selected value with an exact date and a vertical guide.
- MyFitnessPal places clear summary values beside mini charts.
- Both use color intentionally while neutral grays carry structure/background.

Setframe's Sessions per week and Weekly volume charts currently show isolated bars with minimal labeling, making it hard to identify exact week/date ranges without interaction.

## Problem Statement

A chart should work at three levels:

1. **At a glance** — what metric, what period, what takeaway?
2. **On inspection** — exact value and exact date/range.
3. **With help** — how the metric is calculated and interpreted.

Setframe already handles level 3 well through its detailed `?` tooltips. The missing work is strengthening levels 1 and 2.

## UX / Product Intent

Create a reusable chart-detail interaction pattern.

### Persistent context

Each chart should provide, where meaningful:
- metric title,
- unit,
- active date range,
- short period summary,
- enough x-axis labels to orient the user.

### Selected value

When a point/bar is selected:
- visually emphasize it,
- show exact value,
- show exact date or period,
- optionally show a guide/crosshair,
- keep the detail in a stable area of the card.

Examples:

Sessions per week:
`Aug 17–23`
`2 sessions`

Weekly volume:
`Aug 17–23`
`8,535 lb`

### Current/incomplete periods

Clearly distinguish the current incomplete week from completed periods.

Do not rely only on color.

Use semantic text such as `Current week` where useful.

### Color system

Use color intentionally:
- Setframe brand color for ordinary historical series,
- green for current/recovery/success semantics where appropriate,
- neutral gray for gridlines, empty periods, comparison rails.

Do not add many unrelated colors just for visual variety.

### Metric-specific chart types

Do not force every metric into the same chart:
- Sessions/week: bars.
- Weekly volume: bars.
- Body weight: points/line.
- Strength/e1RM: points/line.
- Duration/distance: choose based on comparison value.

Shared interaction should remain consistent across chart types.

## Acceptance Criteria

- [ ] Every interactive Progress chart exposes exact value plus exact date/period on selection.
- [ ] Selected detail is presented in a stable viewport-safe area.
- [ ] Selection has a clear visual state that does not rely on color alone.
- [ ] Current/incomplete week is labeled semantically, not only by color.
- [ ] Sessions per week shows exact week range and session count when selected.
- [ ] Weekly volume shows exact week range and volume when selected.
- [ ] Body weight shows exact date and weight when selected.
- [ ] Strength/history charts use the same selected-detail conventions where applicable.
- [ ] Charts include enough x-axis context without overcrowding.
- [ ] Units are shown consistently.
- [ ] Empty zero-value periods remain visible when absence is meaningful.
- [ ] Chart colors use existing design tokens and preserve accessible contrast.
- [ ] Touch targets for bars/points are usable even when the visual mark is small.
- [ ] Keyboard/screen-reader equivalents are available on web where feasible.
- [ ] Mobile web and mobile app interactions remain conceptually aligned.

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

Build this as a **shared chart interaction layer**, not separate ad hoc click handlers.

Inventory each Progress visualization and classify it:
- point/line,
- bar,
- range,
- metric card without chart.

Identify whether the current chart library supports:
- active index,
- crosshair/reference line,
- touch/drag selection,
- custom axes,
- accessible descriptions.

Normalize selected datum state around:
- index/date key,
- display label,
- value,
- unit,
- period start/end if aggregated.

Do not leak chart-library-specific event objects into product components.

On mobile, enlarge hit areas independently from visual mark size.

If drag-to-inspect is supported, consider it for line charts, but tap selection is sufficient for initial scope.

Persistent summary and selected detail must derive from the same displayed data series.

Provide a text equivalent for accessibility.

### Scope boundary

Do not add advanced pinch-to-zoom or panning.
Do not add a second charting library unless the existing one cannot satisfy core requirements.
Do not redesign the entire Progress information architecture.
