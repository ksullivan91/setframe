# Time in heart-rate zones, as a trend

**Status:** Design. Nothing implemented.
**Companion to:** `docs/design/log-dashboard.md` (Trends tab), architecture §5
(the reconcile pipeline this rides on).
**Existing code:** `packages/domain/src/heart-rate-zones.ts`,
`apps/mobile/src/healthkit/HealthKitAdapter.ts#getWorkoutHeartRate`.

The ask: track time spent in zones 1–5 over 30 and 90 days, and eventually
years. Scoped to **active minutes only** — not the whole clock.

---

## 1. Where the data comes from

HealthKit has **no time-in-zone metric**. Apple shows zones in the Fitness
app and does not export them. Every number here is computed by us from raw
`HKQuantityTypeIdentifierHeartRate` samples.

Most of the machinery already exists, built for the post-workout heart-rate
card:

| Piece | Where | Note |
|---|---|---|
| Raw sample query for any window | `HealthKitAdapter.getWorkoutHeartRate(start, end)` | Window-based; the name is narrower than the function |
| Zone boundaries from a model | `zoneBands(model)` | `{ restingBpm, maxBpm }` → five bands |
| Attribution of time to zones | `timeInZone(series, bands, { maxGapSeconds })` | Already caps the gap between samples |
| Max-HR estimate | `estimateMaxHeartRate(ageYears, observedMax)` | Age from HealthKit, refined by observation |

So this is not a new capability. It is the same computation, run per day
instead of per workout, and persisted.

---

## 2. Why we cannot query this at read time

The Watch samples heart rate every few minutes at rest and every few
seconds during activity — hundreds to a few thousand samples a day, so
roughly a few hundred thousand a year. That is fine for one workout and
impossible to re-query on every chart render, let alone for a multi-year
range.

The pipeline that already exists is the answer: aggregate once per day
during reconciliation, store the aggregate, chart the aggregate. Same shape
as every other metric in `daily_activity_summary`, written by the same
foreground sweep.

---

## 3. Store a histogram, not zone minutes

**This is the load-bearing decision.**

Zone boundaries are derived, not measured. They come from resting heart
rate — which drifts as fitness changes — and a max-HR estimate, which moves
as you age. Persisting *"42 minutes in Zone 3"* freezes that number under
whichever model applied on the day it was computed. A year later the series
silently compares this month's zones against last year's under different
boundaries, and it cannot be corrected: the raw samples are long gone.

Persist **minutes per heart-rate bucket** instead, and make zones a *view*
computed at read time from the current model. Changing the model re-slices
all of history at once, consistently.

At 5 bpm buckets from 40–220 that is 36 numbers per day: roughly 26 KB per
user per year. The storage argument does not exist; the correctness argument
decides it.

It also means any future zone scheme — three-zone polarised, Karvonen
versus %max, a lactate-threshold anchor — is a read-time question rather
than a re-backfill.

---

## 4. What "active minutes" means

Scoping to active periods removes the problem that sleep and desk time
dominate the clock and bury the training signal. It also retires a subtler
issue: `timeInZone` caps attribution at 60 seconds between samples, which is
correct for densely-sampled activity and would have discarded nearly all
passive time — so an all-day chart would have silently measured only the
active parts anyway, while claiming to measure everything.

**One decision to confirm.** Two defensible definitions of "active":

| Definition | Catches | Misses |
|---|---|---|
| **Apple Exercise Time** (`HKQuantityTypeIdentifierAppleExerciseTime` sample windows, intersected with HR) — *recommended* | Every brisk period Apple counts, including a hard walk you never started a workout for | Nothing much; it is Apple's own definition of active |
| **Recorded workouts** (`HKWorkout` windows) | Only what you deliberately started | A 45-minute run you forgot to record disappears entirely |

Exercise Time is recommended: it matches the phrase, and its samples carry
start/end dates that intersect cleanly with heart-rate samples. Workouts are
the simpler fallback if the intersection proves awkward on device.

---

## 5. Schema sketch

One JSONB column on the row that already exists per `(user_id, local_date)`.
A separate table would double the write path for 36 numbers and buy nothing;
`source_provenance` on the same table is the precedent.

```sql
-- packages/database/drizzle/00NN_heart_rate_histogram.sql  (hand-written)
ALTER TABLE daily_activity_summary
  ADD COLUMN active_hr_histogram jsonb;
```

```ts
// packages/schemas/src/apple-health.ts
export const heartRateHistogramSchema = z.object({
  /** Self-describing, so a stored row needs no external constants to read. */
  bucketWidthBpm: z.number().int().positive(),   // 5
  minBpm: z.number().int().positive(),           // 40
  /** Minutes in each bucket, ascending from `minBpm`. Index i covers
   *  [minBpm + i*width, minBpm + (i+1)*width). */
  minutes: z.array(z.number().nonnegative()),    // 36 entries → 40–220
  /** How this row was computed, so a rule change is detectable rather than
   *  silently mixed into the series. */
  attribution: z.object({
    source: z.enum(['exerciseTime', 'workouts']),
    maxGapSeconds: z.number().int().positive(),
    version: z.number().int().positive(),
  }),
});
```

Recording *how* a row was made is deliberate. When the attribution rule
changes — and it will, the first time someone's Watch drops samples oddly —
rows computed under the old rule are identifiable and re-derivable, rather
than quietly averaged in with the new ones.

**No new totals column.** Active minutes is the sum of the array; storing it
alongside creates two sources of one truth.

---

## 6. The reconcile payload

One optional field on the day payload that already exists:

```ts
// AppleHealthDay
activeHeartRateHistogram: heartRateHistogramSchema.nullable().optional(),
```

The client computes it in the same pass that reads the day's other metrics,
and the existing upsert writes it. Idempotency is unchanged: the same day
re-read produces the same histogram, and the full-column set already lets a
value return to null.

Completeness (`deriveDayStatus`) needs no change — a day with heart-rate
data is a day with measurements.

---

## 7. Reading it back as a trend

Zones are sliced at read time. **The model lives on the device**: the server
has no date of birth and no max-HR estimate, and giving it one would mean
storing new personal data to answer a question the client can already
answer.

So `GET /v1/trends` takes the model as query parameters and returns five
ordinary series:

```
GET /v1/trends?from=&to=&restingBpm=54&maxBpm=186
```

```ts
export const trendMetricKeys = [
  ...,
  'zone1Minutes', 'zone2Minutes', 'zone3Minutes', 'zone4Minutes', 'zone5Minutes',
] as const;
```

Five keys rather than a new stacked-series type: it needs no change to
`TrendSeries`, no change to the route's shape, and the client stacks them.
A first-class stacked series would be cleaner and can come later without
re-storing anything — which is the point of holding histograms.

Slicing every day under *today's* model is the behaviour we want, not a
compromise: it is what makes a two-year chart internally comparable.

**Omit the parameters, omit the series.** A user whose resting or max HR
cannot be established gets no zone series rather than a series computed from
a guess.

---

## 8. Backfill

Thirty days, through the pipeline built for the other trends
(`useHealthReconciler`, `planReconcileDays`) — no new mechanism. The first
run already reaches back 30 days; this rides along.

Heart-rate histograms are the most expensive thing that sweep will do: 30
days of raw samples rather than 30 statistics queries. Worth measuring on
device before widening the window. Years of history are available from
HealthKit and are a later, chunked, one-off job — not something to fold into
a foreground sweep.

---

## 9. How we would know it is right

The honest check is external: pick two or three recorded workouts and
compare our zone minutes against what Apple's own Fitness app shows for the
same sessions. Unit tests can only prove the attribution matches our own
arithmetic.

Cases worth a test each:

- A watch removed mid-day — a long gap must not attribute hours to the last
  reading.
- A day with activity but no heart-rate data (phone-only walk) — histogram
  absent, not all-zeroes.
- Buckets at the boundaries: a sample exactly on a zone edge, and one above
  220.
- A model change re-slicing the same stored histogram — the same day yields
  different zone minutes and the same total.

---

## 10. Open questions

1. **Exercise Time or recorded workouts** (§4). Recommended: Exercise Time.
2. **Bucket width.** 5 bpm is proposed. 1 bpm is 180 numbers a day and still
   trivial; it only matters if zone edges ever want sub-5-bpm precision.
3. **Whether Trends' cards suit a stacked chart at all** — every existing
   card is a single line with a latest value and a change. Five stacked
   series is a different object, and may want its own card design rather
   than five cards.
