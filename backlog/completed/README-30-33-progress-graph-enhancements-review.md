# Setframe Product Backlog — Progress Graph Enhancement Pass

## Purpose

This pack translates the latest Progress-page review plus the supplied MyFitnessPal and Apple Health reference screenshots into scoped Setframe work.

The goal is **not** to copy either product visually.

The references highlight interaction principles that fit Setframe well:

- clear time-range controls,
- explicit date context,
- start/current/change summaries,
- direct point/bar inspection,
- charts that explain themselves before interaction,
- deliberate use of color,
- mobile-first detail presentation.

## Stories

30. [Keep Progress Tooltips Inside the Mobile Viewport](./30-progress-tooltip-viewport-containment.md)
31. [Add Time-Range Controls and Make Chart Periods Explicit](./31-progress-time-range-controls-and-period-semantics.md)
32. [Redesign Body Weight Progress Around Clear Historical Context](./32-body-weight-progress-chart-redesign.md)
33. [Create a Consistent Interactive Chart Detail Pattern Across Progress](./33-progress-chart-detail-and-interaction-system.md)

## Recommended Implementation Order

### Foundation
**30 → 31 → 33**

1. Fix viewport-safe overlay/help behavior.
2. Establish correct time-period semantics and reusable range selection.
3. Establish a reusable selected-data interaction pattern.

### Metric redesign
**32** should build on 31 and 33.

Body weight is the strongest first example because the desired questions are clear:
- Where did I start?
- Where am I now?
- How much did I change?
- What happened over this period?

## Important Product Decision: Week Boundaries

The screenshots surfaced a real semantics issue.

Before polishing charts, Setframe needs one consistent definition of a week for:
- Sessions per week,
- Weekly volume,
- Weight summaries,
- Streaks,
- Consistency.

Do not let individual chart components independently decide Monday–Sunday vs Sunday–Saturday.

Use the user's locale/calendar preference if the product already supports it; otherwise choose and document a single Setframe standard.

## Reference Design Principles

### From the supplied MyFitnessPal screenshots

Useful ideas:
- summary values beside the chart,
- direct Start / Current / Change framing,
- compact cards that remain understandable without interaction,
- restrained but meaningful color.

### From the supplied Apple Health screenshots

Useful ideas:
- D / W / M / 6M / Y style segmented range selection,
- selected point/value callout,
- clear date/range context,
- crosshair/selection guide,
- chart detail pages that explain the metric below the visualization.

Setframe already has strong educational `?` tooltips. Keep them.

The next step is making the graphs themselves communicate enough context that the tooltip explains **how the metric works**, not basic facts the chart should already show.

## Product-wide Direction

A Setframe Progress chart should answer three levels of questions:

1. **At a glance:** What happened?
2. **On inspection:** Exactly when and how much?
3. **With help:** How is this metric calculated and how should I interpret it?

These stories are designed around that hierarchy.
