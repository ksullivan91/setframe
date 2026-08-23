# Setframe Product Backlog — Progress Experience Review

## Purpose

This folder converts the Progress-screen usability review into individually implementable stories with Copilot steering guidance. The goal is to move Progress away from ambiguous full-width bars and toward a clear, interactive, historically grounded analytics experience.

## Key UX Finding

The current purple bars look polished but often have **no interpretable denominator, scale, axis, target, or comparison baseline**. When more than one observation exists, additional full bars can appear without communicating the relationship between values.

A progress visualization must answer a question. If 100% has no defined meaning, do not use a progress bar.

## External Product Inspiration

### Apple Health
Apple Health organizes data into historical views/highlights and surfaces meaningful trends. Use this as inspiration for showing change over time, not as a design to copy.

### MyFitnessPal
MyFitnessPal lets users open historical measurement data and change visible time ranges. Its current Today/Progress model separates overview from deeper data views.

Sources:
- https://support.apple.com/guide/iphone/get-started-with-health-iphcae7451f3/26/ios/26
- https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/26/ios/26
- https://support.myfitnesspal.com/hc/en-us/articles/360032624431-How-do-I-record-my-weight-and-other-measurements
- https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Your-Today-tab

## Stories

11. [Reframe Progress Around Questions Users Actually Want Answered](./11-progress-information-architecture.md)
12. [Introduce Interactive, Time-Range Aware Progress Charts](./12-interactive-progress-charts.md)
13. [Replace Body-Weight Bars with a Meaningful Weight Trend](./13-body-weight-trend-chart.md)
14. [Turn Sessions, Streak, Consistency, and Weekly Volume into Comparable Trends](./14-training-consistency-and-volume-trends.md)
15. [Make Progress Metrics Respect Exercise / Prescription Type](./15-prescription-aware-progress-metrics.md)
16. [Make Progress Charts Drillable into the Underlying History](./16-progress-drilldown-and-cross-navigation.md)

## Suggested Implementation Order

### Phase 1 — Semantics / architecture
**Story 11 → Story 15**

First define what Progress is trying to communicate and which metrics are valid for each prescription type. Story 15 depends conceptually on active-workout Story 09.

### Phase 2 — Visualization foundation
**Story 12**

Build one reusable chart/range/interaction system before implementing one-off charts.

### Phase 3 — High-value charts
**Story 13 → Story 14**

Body weight is the clearest time-series use case. Then replace sessions/streak/weekly-volume bars with historical comparisons.

### Phase 4 — Exploration
**Story 16**

Once charts are reliable, connect them to History/session detail.

## Product Principle

**Do not visualize a number simply because a chart component exists.**

Each visualization must make at least one of these easier to understand:
- direction
- magnitude
- comparison
- distribution
- consistency
- relationship over time

If it does none of those, use clear text instead.
