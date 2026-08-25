# Story 48 — Build the Universal Progress Time-Range and Interaction Model

## User Story
As a user reviewing my progress, I want to switch between meaningful time ranges and inspect individual values directly on charts so that I can understand short-term variation and long-term trends without being forced into one arbitrary period.

## Product Intent
The requested Apple Health / MyFitnessPal inspiration was not “put a month label over the existing graph.” The core interaction is that the **user controls the temporal lens**.

A week answers a different question than six months. Data aggregation, labels, summary text, and scale must change with the selected range.

## Time-Range Control
Create one reusable segmented control.

Recommended initial options:

**W | M | 3M | 6M | Y | All**

If the team chooses an Apple-like `D/W/M/6M/Y`, document which metrics actually benefit from Day. The critical requirement is real range semantics.

Persist the selected range during normal Progress interaction rather than resetting after every chart action.

## Aggregation Rules
Aggregation belongs to metric definitions, not the chart vendor.

Examples:

### Body weight
- Week: individual check-ins.
- Month: individual points, optional trend overlay when enough data exists.
- 3M/6M: daily or weekly representative values depending density.
- Year: weekly averages/medians may improve readability.
- All: intentional aggregation/downsampling.

### Sessions
- Week: daily session counts.
- Month+: weekly counts when appropriate.

### Training volume
- Week: daily volume.
- Month+: weekly totals.

Do not use one bucket size for all ranges.

## Calendar Semantics
Define Setframe's week model once.

The current product copy references sessions completed “since Monday,” so Monday–Sunday appears to be the intended model. Centralize and test it.

Do not show a multi-week plot while summarizing only “this week” unless the UI explicitly distinguishes those concepts.

## Chart Interaction

### Tap / scrub
Users should be able to:
- tap a point/bar,
- ideally drag/scrub across the plot,
- inspect the selected period/value.

Use large invisible interaction regions rather than requiring users to hit tiny marks.

### Stable selected-value area
Do not rely only on floating tooltips.

Example:

**Aug 25**  
**168.6 lb**

or

**Aug 18–24**  
**2 sessions**

This is more robust on mobile and more accessible.

## Axis Behavior
Use metric-specific rules.

- Body weight: dynamic non-zero Y range with sensible padding.
- Counts/volume bars: normally zero baseline.
- Never use one global axis rule for every metric.

## Acceptance Criteria
- [ ] Shared time-range selector exists.
- [ ] Range selection changes actual queried/aggregated data.
- [ ] X-axis/date labeling changes appropriately by range.
- [ ] Summary copy reflects the selected displayed period.
- [ ] Week-start policy is centralized and tested.
- [ ] Every interactive chart supports datum selection.
- [ ] Touch hit regions are larger than rendered marks.
- [ ] Selected detail remains visible without hover.
- [ ] Drag/scrub is supported where the chosen chart technology reasonably allows it.
- [ ] Y-axis behavior is metric-specific.
- [ ] Range state does not unexpectedly reset.
- [ ] Sparse data produces useful states instead of misleading interpolation.
- [ ] Screen readers can access chart title, period, summary, and selected value.
- [ ] No range creates horizontal overflow.

## Product-wide Definition of Done

- Mobile-first responsive web.
- Matching user-facing behavior in the mobile application.
- Mobile web and mobile app reviewed side-by-side.
- GitHub reviewer validates implementation/code quality.
- Figma reviewer validates design parity.
- Loading, empty, success, disabled, degraded-data, and error states handled where applicable.
- Keyboard, focus, touch-target, VoiceOver/screen-reader, reduced-motion, and color-contrast behavior considered.
- Behavioral tests cover important user-visible outcomes.
- Existing historical data and metric semantics are preserved unless explicitly changed.
- Typecheck, lint, relevant tests, and production build pass.
- No unrelated scope creep.
- Validate narrow mobile widths and desktop/full-width layouts.
- Explicitly test horizontal overflow and sticky-navigation regressions on mobile Safari.


## Copilot / Claude Steering Document

Build this as shared infrastructure, not repeated chart-specific controls.

Create equivalents of:
- `ProgressRange`
- `TimeRangeSelector`
- shared date-window calculation,
- shared bucketing utilities,
- shared selected-datum state.

Keep raw data separate from presentation aggregation.

Do not fake missing points. Missing data is missing, not zero.

Create deterministic fixtures for:
- four days,
- four weeks,
- four months,
- one year,
- gaps,
- Sunday/Monday boundary cases,
- multiple measurements.

Completion screenshots must prove that changing range materially changes the visualization and summary.
