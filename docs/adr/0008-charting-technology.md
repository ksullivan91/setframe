# ADR 0008: Charting Technology for the Progress Experience

Status: Accepted, **amended by ADR 0010** (2026-08-25). Its rejection of
chart *component* libraries stands unchanged and should not be re-litigated;
ADR 0010 narrows this decision to the category it actually examined, and
adopts d3's headless maths modules inside `packages/domain` — no renderer
changes, no new runtime dependency in either app.

Date: 2026-08-25.

## Context

The Progress experience rebuild (`Backlog/setframe-progress-experience-rebuild/`,
stories 46–51) raises Progress from static reporting to a core product
surface. Story 47 requires that "the requirements should drive the chart
technology — not the other way around," and names the capabilities the
rebuild depends on: selectable time ranges, real period-dependent
aggregation, interactive point/bar inspection, line/point/bar/range charts,
responsive mobile behaviour, selected-datum state, gesture-friendly
interaction, accessibility, web/mobile parity, and headroom for future
overlays (average, trend, baseline, annotations).

### What exists today

Charts are hand-rolled on SVG. All geometry lives in
`packages/domain/src/chart-geometry.ts` (`buildLineChart`,
`buildColumnChart`), which returns plotted points, SVG path strings, axis
ticks and the plot rect. Two renderers consume that identical output:
`apps/web/src/components/Charts.tsx` (native `<svg>`) and
`apps/mobile/src/components/Charts.tsx` (`react-native-svg`). No charting
library is involved.

Strengths, measured against exactly what stories 48–50 need most:

- **Parity is structural, not maintained by discipline.** One geometry
  implementation, unit-tested once in `packages/domain`, consumed by both
  renderers. Web and mobile cannot drift because there is only one source
  of truth for where a mark goes.
- **Accessibility is unusually strong.** Every chart emits a
  visually-hidden `<table>` text equivalent; each mark is a focusable
  `role="button"` with an aria-label; Enter/Space selects; an `aria-live`
  region announces the readout. Nothing is locked behind a pointer gesture.
- **Scale decisions are explicit.** The y-domain is chosen per metric —
  `zeroBased: true` for counts and totals, a padded non-zero domain for
  body weight — which Story 48 requires directly ("Never use one global
  axis rule for every metric").

Gaps:

- **No drag/scrub gesture.** Tap and keyboard selection exist; continuous
  scrub does not. This is the largest capability gap against stories 48–49.
- **No range/band chart type.** Line and column only.
- **Range switching does not re-aggregate.** `filterByRange` trims a
  trailing window; it never changes bucket size.

## Evidence gathered

A prototype was built at `docs/spikes/047-charting/` driven by the **real**
`@setframe/domain` geometry (not a reimplementation), over a deterministic
**500-day** fixture with realistic noise and multi-day gaps (a two-state
run-length model, so absences arrive as holidays rather than scattered
single-day holes), and driven in real Chrome via Playwright
(`drive-prototype.mjs`, 9/9 checks passing).

The fixture is deliberately longer than the longest offered range. An
earlier 120-day fixture made the aggregation check *vacuous* — 6M, 1Y and
ALL all covered the whole series, so equal counts followed by construction
and would have held even for an implementation that aggregated correctly.
That is worth recording because it nearly became this ADR's headline
evidence.

Two findings materially shaped this decision.

**1. Scrub is not the hard problem it appeared to be.** A continuous
pointer-capture scrub over the existing geometry produced 16 distinct
readout values across one desktop drag, with the readout provably
stationary (0.0px movement) throughout. At a 390px viewport a **real touch
drag** — dispatched via CDP so the events carry `pointerType: "touch"`
rather than Playwright's synthetic mouse pointers — produced 8 distinct
values, and vertical page scrolling still worked, so `touch-action: pan-y`
arbitrates scrub against scroll correctly on web. The interaction layer is
roughly forty lines and required no new dependency.

There is one sharp edge worth recording, because it cost the prototype a
failing run before it passed: **re-rendering the chart on every
`pointermove` destroys the element holding pointer capture**, which kills
the drag after its first frame. The fix is to build the plot once per range
and mutate only a persistent selection layer. Any implementation of story
48/49 must follow that split.

**1b. The native side needs no setup work.** A native prototype
(`apps/mobile/src/spikes/047/ScrubLineChart.tsx`, verified at render level by
`apps/mobile/src/__tests__/ScrubLineChartSpike.test.tsx`, 5/5 passing) drives
the same shared `buildLineChart` output through `react-native-svg` with a
`Gesture.Pan().minDistance(0)` scrub, using only dependencies the app already
ships. Its marks were asserted to land on the exact coordinates the shared
geometry produces, so the parity claim is tested rather than assumed. Two
incidental findings: gesture-handler v3's `GestureDetector` throws without a
`GestureHandlerRootView` ancestor, and `apps/mobile/app/_layout.tsx`
**already mounts one** — so adopting scrub on mobile requires no
bootstrapping change.

**2. The aggregation gap is a domain problem, and no vendor fixes it.**
Marks rendered per range over the 500-day fixture:

| Range | 1W | 1M | 3M | 6M | 1Y | ALL |
|---|---|---|---|---|---|---|
| Marks rendered | 8 | 28 | 76 | 143 | 284 | **383** |

Because `filterByRange` trims a window but never re-buckets, mark count
grows without bound with history length: `ALL` draws one mark per logged
day. `evidence/02-desktop-range-all.png` shows the result — 383 marks
collapse into an unreadable smear in which a real 9.4 lb decline is
invisible. A correct implementation would switch to weekly or monthly
buckets for long ranges, holding the count roughly constant.

That is a metric-definition problem, not a rendering one. Swapping charting
libraries would leave it exactly where it is — which is why Story 48 puts
bucketing in `packages/domain`.

## Options considered

| Option | Web/mobile parity | Touch quality | Time-series | Accessibility | Responsive | Performance | Customization | Ecosystem | Dependency cost |
|---|---|---|---|---|---|---|---|---|---|
| **A. Extend the hand-rolled SVG architecture** | **Structural** — one geometry module feeds both renderers | Scrub verified in real Chrome, desktop + 390px; mobile has `react-native-gesture-handler` already | Real date x-axis and per-metric y-domain already implemented | **Best available** — visually-hidden table, focusable marks, aria-live; fully under our control | `ResizeObserver` + viewBox, verified no overflow at 390px | Plain SVG, ~95 marks; no runtime layout engine | Total — every scale decision is ours | We maintain it | **Zero new packages** |
| **B. Victory Native XL + a web counterpart** | **Forfeited by construction** — native-only, so web needs a *different* library and a second config | Strong on native (Skia/Reanimated/Gesture Handler) | Good | Skia canvas has no accessible DOM; the current a11y implementation would be rebuilt or lost | Good | Strong native | Extensive | Formidable, active | `react-native-reanimated` + `@shopify/react-native-skia` (both absent), **plus** an unrelated web library |
| **C. React Native ECharts / ECharts** | One config vocabulary, but two renderers with different backends | Good | Rich | Canvas/Skia rendering; a11y would regress from today's baseline | Good | Heavy core | Rich, but within vendor idiom | Large, active | `@shopify/react-native-skia` + `echarts` + `zrender` (~330KB gz core before tree-shaking) |

Peer requirements were verified against the registry rather than READMEs:
`victory-native@41.26.0` requires `react-native-reanimated >=3.0.0` and
`@shopify/react-native-skia >=1.2.3 <3.0.0`;
`@wuba/react-native-echarts@3.1.1` requires `@shopify/react-native-skia`,
`echarts` and `zrender`. Mobile currently has
`react-native-gesture-handler@3.2.1` and `react-native-svg@15.15.5`, and
has **neither** Skia nor Reanimated.

## Decision

**Keep the hand-rolled SVG architecture and extend it** (Option A), adding
a shared gesture/selection layer and real aggregation in
`packages/domain`.

Rationale:

1. **The capability that appeared to justify a rewrite is already
   achievable.** Scrub — the single biggest gap — was demonstrated on the
   existing geometry, on both viewports, with zero new dependencies.
2. **The remaining gaps are not vendor-shaped.** Real per-range
   aggregation and calendar-week semantics are metric-definition problems;
   the point-count table above shows a library swap would not touch them.
   Story 47 itself says to keep "aggregation/business logic out of vendor
   chart configuration."
3. **Parity is the property we can least afford to lose.** Victory Native
   XL is native-only, so adopting it means two libraries, two configs and
   two sets of behaviour to keep in sync — the precise failure mode
   `packages/domain` exists to prevent (CLAUDE.md, "Frontend structure").
4. **Every alternative regresses accessibility.** Canvas and Skia render no
   accessible DOM. Today every mark is a focusable, labelled control and
   every chart has a text-equivalent table. That is a real, shipped
   standard, and Story 47's DoD requires VoiceOver/screen-reader behaviour
   be considered.
5. **Dependency cost is not neutral here.** ADR 0003 and 0004 record
   deliberate stack minimalism. Options B and C each add native binary
   modules to an Expo app that currently needs neither, with the
   prebuild/dev-client consequences that follow.
6. **The chart-token semantics stay ours.** `chart.raw` (accent purple) =
   what you logged, `chart.trend` (success green) = the signal underneath
   it. No vendor palette gets to reinterpret that.

### Honest counterweight

This decision is not free. Every future chart type — range/band,
annotations, stacked series — is ours to build, and the pointer-capture
pitfall above shows hand-rolled interaction has sharp edges a mature
library would have smoothed. If Progress later needs a genuinely rich
vocabulary (candlesticks, brush-and-zoom, linked crossfilter views), this
ADR should be revisited rather than stretched. The bet is that Setframe
needs *three metrics rendered exceptionally well*, not a chart library.

## Consequences

- Story 48 builds the aggregation and range model in `packages/domain`
  (bucketing, calendar-week semantics, window math) — not in any renderer.
- Story 48 also adds the shared selection/scrub layer to both renderers,
  following the build-once/mutate-selection split proven above.
- No new runtime dependency is added for charting on either platform.
- `filterByRange` is superseded by range-aware bucketing; it should be
  removed once nothing calls it, so two range models never coexist.
- `availableRanges` currently returns `[]` when a series spans less than
  the shortest offered range, and `RangeSelector` renders `null` below two
  options — which is why the review reported the controls as "not
  implemented." Story 48 must decide deliberately whether a range that
  shows all available data is hidden or shown-and-disabled.

## Proposed shared abstraction

Story 47 asks for semantic Setframe primitives with business logic kept out
of chart configuration. Proposed shape, to be built by Story 48:

```ts
/** Ranges are calendar-aware, not day-count windows. */
type ProgressRange = 'W' | 'M' | '3M' | '6M' | 'Y' | 'ALL';

/** What a metric definition returns — already bucketed for the range. */
type ProgressSeries<TMeta = unknown> = {
  range: ProgressRange;
  /** The window actually displayed, for summary copy. */
  window: { start: string; end: string };
  /** How the range was bucketed, so the UI can label honestly. */
  bucket: 'day' | 'week' | 'month';
  points: Array<{
    /** Bucket start, `YYYY-MM-DD` local. */
    localDate: string;
    /** `null` is missing, never zero. */
    value: number | null;
    /** e.g. partial current period, rest week. */
    meta?: TMeta;
  }>;
};
```

Components (per platform, geometry shared):

- `TimeRangeSelector` — segmented control over `ProgressRange`.
- `ProgressLineChart` / `ProgressBarChart` — render a `ProgressSeries`;
  own no aggregation.
- `SelectedDatum` — the stationary readout; the only place selection is
  presented. Deliberately not a floating tooltip.
- `ChartSummary` — start/current/change for the selected window.
- `ChartEmptyState` — sparse and no-data states, which must not be
  papered over with interpolation.

Metric definitions (`bodyWeightSeries`, `sessionSeries`, `volumeSeries`)
live in `packages/domain` and own bucketing, so a chart never decides what
a week means.

## Not verified

The mobile app is not deployed to a device or simulator in this
environment, so **no native touch *feel* was observed for any option**,
including the recommended one. What the native prototype does establish is
structural, not experiential: the component mounts, the gesture surface
attaches, and the marks land on the shared geometry's exact coordinates.
Frame rate, gesture responsiveness and scroll-vs-scrub conflict are all
unmeasured.

Two specific risks follow. First, the prototype's pan handler runs
`.runOnJS(true)` and calls `setState` per update — fine for ~100 points in
principle, but the ALL range now renders 383 marks, and if a device shows
jank the fix is a Reanimated shared value driving the selection layer,
which *would* add `react-native-reanimated` as a dependency and partially
erode rationale 5. (Story 48's aggregation work should cap mark count well
below that, which reduces the risk but does not remove it.) Second,
scrub-versus-scroll arbitration is verified **on web only**
(`touch-action: pan-y`); the React Native equivalent needs
`Gesture.Pan().activeOffsetX()` tuning against the enclosing ScrollView and
is not exercised at render level at all.

Story 48 must validate scrub on real hardware before Story 49 inherits the
interaction grammar. If native feel does not hold up, amend this ADR rather
than quietly omitting the interaction — the pack is explicit that missing
interaction is evidence to change technology, not permission to drop it.
