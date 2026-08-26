# ADR 0010: Adopt d3 as headless chart math, keep the SVG renderers

Status: Accepted. Date: 2026-08-25.
Amends: ADR 0008 (Charting Technology for the Progress Experience).

## Context

ADR 0008 decided to keep hand-rolled SVG and extend it. Stories 48–51 did
that, and the result was rejected: *"These charts really aren't much better
… They are not rich."* The direction that followed
(`docs/design/progress-visualization-direction.md`) calls for stacked
composition by movement pattern, small multiples of per-lift estimated 1RM
sharing one axis, superposed planned-versus-actual, and an annotation layer
for PRs — against a page that must stay identical on web and mobile.

ADR 0008 named this exact trigger for its own revision:

> If Progress later needs a genuinely rich vocabulary … this ADR should be
> revisited rather than stretched. The bet is that Setframe needs *three
> metrics rendered exceptionally well*, not a chart library.

That bet is now lost on its own terms. Three metrics rendered well is
precisely what shipped, and it is not what the product needs.

## The distinction ADR 0008 did not draw

ADR 0008 evaluated three options and all of them were **chart component**
libraries — things that own rendering. It concluded, correctly, that a
React Native renderer cannot run on web, so adopting one forfeits parity by
construction and regresses accessibility from a real shipped standard.

That reasoning is sound and still holds. But it silently treated "charting
library" as one category, when there are two:

| | Owns rendering | Runs on both platforms | Touches the DOM |
|---|---|---|---|
| **Component libraries** (Victory Native XL, ECharts, Recharts, Nivo) | yes | no — native or web, never both | yes/canvas |
| **Headless math** (`d3-scale`, `d3-shape`, `d3-array`, `d3-time`) | **no** | **yes — pure functions** | **no** |

`d3-shape` does not draw anything. It takes an array of numbers and returns
an SVG path string. That string is consumed identically by DOM
`<path d="…">` and by `react-native-svg`'s `<Path d="…">`. `d3-scale` maps
a domain to a range and returns a number. `d3-array` reduces and bisects.
None of them import a document.

This was verified, not assumed — the modules were installed and exercised
in plain Node with no DOM present: time scales produced calendar-sensible
ticks, `scaleLinear().nice()` produced round domains, `line().curve()`
emitted a valid path string, and `stack()` produced correct stacked series.

## Decision

**Adopt `d3-scale`, `d3-shape`, `d3-array`, `d3-time` and `d3-time-format`
as dependencies of `packages/domain` only. Keep both SVG renderers exactly
as they are.**

Specifically:

- The d3 modules are a dependency of `@setframe/domain`. **Neither app
  depends on d3 directly**, and no renderer imports it.
- `packages/domain` exposes chart math as plain data — numbers, tick
  arrays, and SVG path `d` strings. Its public surface stays
  framework-free, exactly as CLAUDE.md requires.
- `apps/web` keeps native `<svg>`; `apps/mobile` keeps `react-native-svg`.
  Both already ship; neither changes.
- The DOM-touching d3 packages — `d3-selection`, `d3-transition`,
  `d3-axis`, `d3-zoom`, `d3-brush` — are **excluded by policy**. They are
  the reason "d3" has a reputation for being DOM-bound, and none of them
  are needed to compute geometry.

### Why this is not a reversal of ADR 0008

Every rationale ADR 0008 gave survives intact:

1. **Parity stays structural.** One math implementation in
   `packages/domain`, unit-tested once, consumed by two renderers. d3 makes
   that module more capable; it does not add a second source of truth.
2. **Accessibility is untouched.** The visually-hidden text-equivalent
   table, focusable labelled marks, and `aria-live` readout all live in the
   renderers, which do not change. This is the point on which every
   component library failed, and headless math does not put it at risk.
3. **No native binary module.** No Skia, no Reanimated, no prebuild or
   dev-client consequence. These are pure-JS packages.
4. **Chart token semantics stay ours.** No vendor palette exists to
   reinterpret `chart.raw` / `chart.trend`.
5. **Aggregation stays out of vendor configuration.** Story 47's own
   requirement. Bucketing and metric definitions remain domain code; d3 is
   used *below* them, for scales and paths, never to decide what a week is.

What changes is only rationale 6 — dependency minimalism. Five small
pure-JS packages are added where ADR 0008 added zero.

### What we get that hand-rolling was not going to deliver

The direction document's views need, concretely: stacked series layouts,
band scales with correct padding, calendar-aware tick selection across six
ranges, `nice()` domain rounding, monotone curve interpolation that does
not overshoot, and bisection for scrub hit-testing. Every one of these is a
solved, well-tested algorithm with sharp edges. ADR 0008's own honest
counterweight predicted the cost of owning them:

> Every future chart type — range/band, annotations, stacked series — is
> ours to build, and the pointer-capture pitfall above shows hand-rolled
> interaction has sharp edges a mature library would have smoothed.

Story 50 then paid that cost in public: a y-axis that read "0, 1, 1"
because 0.5 rounds to 1 is exactly the bug `scaleLinear().nice()` does not
have.

## Consequences

- `packages/domain` gains a chart layer built on d3, unit-tested in
  isolation with vitest, returning only plain data.
- **Jest is the integration risk, not Metro.** These packages are ESM-only
  with `"type": "module"` and ship untranspiled `src/*.js`. Metro (RN 0.86
  / Expo 57) and Vite handle that; Jest does not by default, and
  `apps/mobile`'s `jest-expo` preset must whitelist `d3-*` in
  `transformIgnorePatterns` or every mobile suite importing the chart layer
  fails to parse. This has bitten this repo before — the
  `lucide-react-native` mapping made eight suites unrunnable and reported
  it as a *configuration error*, not a test failure.
- `chart-geometry.ts`'s `buildLineChart` / `buildColumnChart` stay until
  their callers migrate, then are removed — two geometry models must not
  coexist, the same rule applied to `filterByRange` in Story 48.
- ADR 0008 remains the record for why **component** libraries are rejected.
  That conclusion is unchanged and should not be re-litigated; this ADR
  narrows its scope to the category it actually examined.
