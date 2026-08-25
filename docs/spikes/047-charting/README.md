# Story 47 — charting technology spike

Decision and full reasoning: **[ADR 0008](../../adr/0008-charting-technology.md)**.
Recommendation: keep the hand-rolled SVG architecture and extend it.

## What's here

| File | Purpose |
|---|---|
| `build-prototype.ts` | Generates the harness from the **real** `@setframe/domain` geometry over a deterministic 500-day fixture (realistic noise, multi-day gaps via a run-length model). Precomputes geometry for every range via the same `buildLineChart`/`buildColumnChart` calls production makes. |
| `prototype-incumbent.html` | Generated harness — line chart with pointer-capture scrub, bar chart with tap, range selector, stationary readout. |
| `drive-prototype.mjs` | Drives the harness in real Chrome via Playwright and asserts the interactions stories 48–49 require. |
| `evidence/` | Screenshots from the driven run. |
| `apps/mobile/src/spikes/047/ScrubLineChart.tsx` | Native prototype — same shared geometry, `react-native-svg` + `Gesture.Pan` scrub, stationary readout. Imported by no screen. |
| `apps/mobile/src/__tests__/ScrubLineChartSpike.test.tsx` | Render-level verification of the native prototype (5/5). |

## Reproduce

```bash
npx tsx docs/spikes/047-charting/build-prototype.ts
node docs/spikes/047-charting/drive-prototype.mjs   # needs playwright, see below
npm run test --workspace=@setframe/mobile -- ScrubLineChartSpike
```

**`playwright` is not a dependency of any workspace.** It was resolved from
the ambient `node_modules` when this spike ran. On a clean checkout install
it first (`npm i -D playwright -w @setframe/web`, or `npx playwright@latest`),
or the driver exits with `ERR_MODULE_NOT_FOUND`. It was deliberately not
added to `package.json`: this is throwaway spike tooling, and
`Backlog/WAIT-automated-visual-and-e2e-testing.md` records that browser-test
infrastructure is a separate, deferred decision rather than something a
spike should quietly land.

The browser binary is resolved in this order: `$CHROME_PATH`, then
`./node_modules/.bin/print-chrome-path`, then the default macOS Chrome
location. Playwright's own bundled Chromium is not downloaded in this
workspace.

## Result

9/9 checks pass:

- long ranges are **not** aggregated — 1W=8, 1M=28, 3M=76, 6M=143, 1Y=284, **ALL=383** marks
- scrub produces 16 distinct readout values across one desktop drag
- the readout stays stationary throughout (0.0px movement)
- keyboard arrows move selection
- range swap changes the rendered mark count (1W=9 marks, ALL=384)
- bar tap updates the readout
- no horizontal overflow at 390px
- a **real touch drag** (`pointerType: touch`, dispatched via CDP) scrubs
- vertical page scroll still works, so `touch-action: pan-y` arbitrates correctly

The mark-count row is the Story 48 evidence: `filterByRange` trims a window
but never re-buckets, so mark count grows without bound with history.
`evidence/02-desktop-range-all.png` shows 383 marks collapsing into a smear
that hides a real 9.4 lb decline.

> An earlier 120-day fixture asserted "6M/1Y/ALL render identical counts"
> instead. That was **vacuous** — all three windows covered the whole
> series, so equal counts followed by construction and would have held even
> for a correct implementation. The fixture is now longer than the longest
> range so the check can actually fail.

## Two findings worth carrying into Story 48

1. **Never re-render the chart during scrub.** Replacing the SVG on
   `pointermove` destroys the element holding pointer capture and kills the
   drag after one frame. Build the plot once per range; mutate only a
   persistent selection layer. The prototype failed on this before it
   passed, and the fix is visible in `build-prototype.ts` (`paintSelection`).
2. **Bucketing belongs to metric definitions, not the chart.** The density
   at 3M (71 daily marks) and at 390px is a legibility failure no renderer
   can fix.

## Scope

Spike only — no production code was changed. Native touch quality was not
observed for any candidate (no device/simulator available); see ADR 0008
"Not verified".
