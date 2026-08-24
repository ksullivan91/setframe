# Story 31 — Add Time-Range Controls and Make Chart Periods Explicit

## User Story

As a user reviewing my progress, I want to switch between meaningful time ranges such as week, month, six months, and year so that I can understand both recent behavior and longer-term trends without guessing what period a graph represents.

## Screenshot / Product-Test Evidence

The current Setframe charts present data without a strong, consistent time-range control.

The supplied Apple Health references use compact segmented controls such as Day / Week / Month / 6 Months / Year and update both the chart and its date/range context.

The supplied MyFitnessPal references also provide period-specific summaries beside lightweight charts.

The Setframe screenshots reveal ambiguity around week boundaries. A Body weight card shows a current weekly range that does not include the immediately preceding Sunday, suggesting a Monday–Sunday aggregation while the user expected Sunday–Saturday. The chart can also show points spanning a different period than the summary beneath it.

## Problem Statement

Setframe currently risks mixing:
- chart display window,
- aggregation period,
- summary period,
- week-boundary semantics.

Users should not need to infer what dates are shown or whether a headline statistic summarizes the visible graph or a different hidden period.

## UX / Product Intent

Introduce a consistent chart time-range control and make the displayed period explicit.

### Recommended initial ranges

Use a compact segmented control inspired by the references, adapted to each metric:

`W | M | 3M | 6M | Y`

or, where daily resolution is genuinely useful:

`D | W | M | 6M | Y`

Do not force every metric to support meaningless ranges.

### Explicit date context

Every chart should communicate its active period, e.g.:
- `Aug 18–24`
- `Last 12 weeks`
- `Mar–Aug 2026`

The summary beneath/above the chart should summarize the same visible period unless explicitly labeled otherwise.

### Week boundary

Choose one consistent rule for Setframe.

Prefer:
- user's locale/calendar preference if already supported, otherwise
- a documented Setframe standard.

Do not silently use different week definitions in different features.

### Adaptive chart density

Changing range should alter x-axis density/aggregation:
- week: days,
- month: dates/weeks,
- 3M/6M: weekly points/bars,
- year: monthly or downsampled values.

## Acceptance Criteria

- [ ] Progress charts expose a clear time-range selector where multiple time scales are useful.
- [ ] Active range is visually obvious.
- [ ] Each chart communicates the actual dates/period displayed.
- [ ] Summary statistics describe the visible period or are explicitly labeled otherwise.
- [ ] Week boundaries are consistent across Sessions per week, Body weight, Weekly volume, streak/consistency logic, and other weekly aggregations.
- [ ] The week-boundary rule is documented in code/product logic.
- [ ] Changing range updates chart data, labels, and summary values together.
- [ ] X-axis label density adapts to the selected range.
- [ ] Empty/sparse data states remain understandable at every supported range.
- [ ] Mobile controls are touch-friendly and do not cause horizontal page overflow.
- [ ] Mobile web and mobile app expose equivalent range behavior.
- [ ] Behavioral tests cover boundary dates, especially Sunday/Monday transitions.

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

This story is UX plus **time-domain correctness**.

For every existing Progress chart, document:
- raw data source,
- aggregation unit,
- current date range,
- week-start rule,
- timezone used for grouping,
- summary statistic window.

Pay particular attention to Body weight, Sessions per week, and Weekly volume.

Use the user's configured/local timezone consistently when assigning records to calendar days/weeks.

Do not group timestamps by UTC date if Today is based on local calendar dates.

Prefer a reusable chart-range model containing:
- range key,
- start date,
- end date,
- aggregation grain,
- axis formatting.

Create test data on Sunday night, Monday morning, month-end, and month-start to verify grouping.

### Scope boundary

Do not add arbitrary pinch-to-zoom or chart panning.
Do not redesign every Progress metric card in this story.
Do not implement ranges unsupported by meaningful domain data.
