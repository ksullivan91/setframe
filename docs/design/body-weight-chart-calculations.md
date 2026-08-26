# Body weight chart — exact calculations

Story 49 asks for the arithmetic behind the reference chart to be written
down, because Stories 50+ inherit this interaction grammar. Everything here
lives in `packages/domain` and is consumed identically by
`apps/web/src/pages/ProgressPage.tsx` and `apps/mobile/app/(tabs)/progress.tsx`.

## Selected range

`rangeOptions`/`windowForRange` (`progress-range.ts`) resolve a range to a
window ending at the user's local date:

| Range | Window | Bucket |
| --- | --- | --- |
| `W` | current Sunday–Saturday week | day |
| `M` | trailing 30 days | day |
| `3M` | trailing 90 days | week |
| `6M` | trailing 180 days | week |
| `Y` | trailing 365 days | week |
| `ALL` | first check-in → today | adaptive (day/week/month) |

`W` is the *current* calendar week, not a trailing 7 days, so it agrees with
the "since Sunday" copy used elsewhere. Week boundaries are Sunday-anchored
ISO weeks (`weekStartOf`), the same definition the rest of the product uses.

Bucketing targets 7–30 marks. `ALL` widens the bucket as history grows so a
three-year chart does not draw a thousand marks.

A range whose window predates the first check-in is **disabled**, not hidden,
with a title explaining why — the option silently not existing reads as a bug.

## Start / current / change

Computed from the raw check-ins *actually visible in the selected range*, not
from a fixed "current week":

- **Start** — value of the first visible mark.
- **Current** — value of the last visible mark, with its date.
- **Change** — `current − start`, rendered with an explicit ↑/↓ and the unit.

Changing the range therefore changes all three. This is deliberate: a "change"
that ignores the selected range is the specific dishonesty the story was
written against.

## Bucket aggregation

Within a bucket, raw weight is averaged (`aggregation: 'mean'`). A bucket with
no check-ins is `null` — **missing, never zero**. A zero would draw the line to
the floor and imply a weight of nothing.

Because a mark at 3M and longer is a *mean over a period*, it is labelled with
the period rather than a single date (`formatBucketPeriod`) and its sample
count is named (`describeBucketValue`):

- day bucket, one check-in → `Aug 24` (no parenthetical; a day *is* one reading)
- week bucket → `May 25–31`, `average of 7 check-ins`
- a lone reading in a week → `the only check-in that week`

Labelling a weekly mean with a bare date told the user they weighed that value
on a morning they may never have logged.

## Trend (smoothing)

`computeWeightTrend` (`weight-trend.ts`) uses an **EWMA with α = 0.1** — the
Hacker's Diet default. Each reading moves the trend a tenth of the distance
toward it, so a real change surfaces over roughly three weeks while a single
salty meal does not.

The trend is **withheld** until there are at least
`minimumCheckInsForTrend = 5` check-ins spanning enough time
(`sufficiency: 'none' | 'establishing' | 'ready'`). Below that the chart draws
real points only (`pointsOnly`) and says how much more data is needed. No trend
is ever manufactured from two mornings.

`direction` is unvalenced (`rising | falling | steady`). Whether a gain is good
depends on a goal the chart does not know.

## Weekly average and week-over-week

The week summary shows the latest week's `average`, `low`, and `high`.

`weekOverWeekChange` appends `± N vs previous week`, and **withholds it** in
two cases where it would lie:

1. **Non-adjacent weeks.** Bridging a gap and labelling it "vs previous week"
   attributes weeks of drift to seven days.
2. **Either week below `minimumCheckInsForWeekComparison = 2` check-ins.** A
   one-reading "average" makes the change mostly a function of which morning
   the user happened to step on the scale.

## Axis

`zeroBased={false}` with `minimumSpan={4}` (lb). The axis fits the data rather
than starting at zero — a 0–200 axis makes a 4 lb cut invisible — but the
minimum span stops a 0.2 lb overnight wiggle from filling the frame and
reading as a collapse. The trend is scaled against the combined raw+trend
domain so both sit on one axis.

## Accessibility

Both platforms render a text equivalent of every mark: web as a visually
hidden `<table>`, mobile as a `chart-table` view carrying the whole summary in
its `accessibilityLabel`. Measured and derived values are **separate labelled
columns** (`Period | Measured | Trend`), so the raw/trend distinction survives
without colour. Where the smoothed series has not started yet the cell reads
`no trend yet` rather than borrowing its neighbour's value, and the trend
column is omitted entirely when no trend is drawn.

## Verification

Captured at 390px against `dev:mock` (150 seeded daily check-ins), signed in
as the design-review account:

| Range | Marks | Start → Current | Change |
| --- | --- | --- | --- |
| W | 2 | 180.0 → 180.2 | ↑ 0.2 lb |
| M | 32 | 181.1 → 180.2 | ↓ 0.9 lb |
| 3M | 14 | 183.8 → 180.1 | ↓ 3.7 lb |
| 6M | 23 | 186.0 → 180.1 | ↓ 5.9 lb |
| Y | disabled (only ~5 months of history) | | |
| ALL | 23 | 186.0 → 180.1 | ↓ 5.9 lb |

No horizontal overflow at any range. Day ranges label marks with bare dates;
week ranges label them with spans and sample counts. The sparse state (2
check-ins) draws points only, omits the trend column, withholds the
week-over-week line, and explains that smoothing needs about a week of data.

**Not yet done:** mobile was verified by test, not visually — the app is not
installed on the booted simulator and a native build was out of scope for this
pass. The Figma design review is also still open.
