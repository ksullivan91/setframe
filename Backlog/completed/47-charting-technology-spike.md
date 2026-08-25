# Story 47 — Charting Technology Spike and Shared Visualization Architecture

## User Story
As the Setframe product team, we need a charting foundation capable of rich, responsive, accessible interaction across web and mobile so Progress can become a core product experience rather than a collection of static bars.

## Product Intent
The requirements should drive the chart technology — not the other way around.

Required capabilities:
- selectable time ranges,
- real period-dependent aggregation,
- interactive point/bar inspection,
- line, point, bar, and range charts,
- responsive mobile behavior,
- selected datum state,
- gesture-friendly interaction,
- accessibility,
- web/mobile parity,
- future overlays such as average, trend, baseline, annotations.

## Required Evaluation

### Existing implementation
Document:
- current library/custom SVG approach,
- interaction limitations,
- native/mobile story,
- accessibility support,
- maintenance burden.

### React Native ECharts / ECharts
Evaluate because it offers:
- rich chart vocabulary,
- touch/gesture interactions,
- SVG/Skia native rendering,
- potentially reusable configuration between web and native.

### Victory Native XL + suitable web counterpart
Evaluate because it offers:
- native performance,
- Skia/Reanimated/Gesture Handler,
- extensive customization.

Other project-compatible options may be considered, but Claude must explain why.

## Required Prototype
Do not choose based only on README files.

Prototype the same mock dataset on web/mobile web and native mobile and demonstrate:
- line chart,
- bar chart,
- selected point/bar,
- tap inspection,
- drag/scrub if supported,
- time-range swap,
- responsive width,
- 50–100 points,
- accessibility approach.

## Decision Matrix
Score candidates on:
- web/mobile parity,
- touch quality,
- time-series capability,
- accessibility,
- responsive sizing,
- performance,
- customization,
- ecosystem/maintenance,
- dependency cost.

Do not select a library only because it is already installed.

## Acceptance Criteria
- [ ] Current chart technology and limitations are documented.
- [ ] At least two viable alternatives are evaluated.
- [ ] Real web + native prototypes exist.
- [ ] Prototype demonstrates interaction, not only rendering.
- [ ] Time-range swapping is demonstrated.
- [ ] Accessibility strategy is documented.
- [ ] Decision matrix is committed.
- [ ] One approach is recommended.
- [ ] Migration impact is documented.
- [ ] Shared Setframe chart abstraction is proposed.
- [ ] No production redesign is bundled into the spike unless separately approved.

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

Timebox this story. It is a decision spike, not a 36-hour rewrite.

Aim for semantic Setframe primitives such as:
- `TimeRangeSelector`
- `ProgressLineChart`
- `ProgressBarChart`
- `SelectedDatum`
- `ChartSummary`
- `ChartEmptyState`

Keep aggregation/business logic out of vendor chart configuration.

Suggested chart-ready model:

```ts
type ProgressSeries<TMeta = unknown> = {
  period: ProgressPeriod;
  points: Array<{
    timestamp: string;
    value: number;
    meta?: TMeta;
  }>;
};
```

Apple's chart guidance treats interaction and day/week/month/year switching as part of effective chart design. Treat those as product requirements, not optional polish.

Deliver:
- ADR/technology decision,
- matrix,
- prototypes,
- screenshots/video,
- recommendation,
- migration plan.
