/**
 * The temporal lens for Progress: which window a chart shows, and at what
 * resolution.
 *
 * This module exists because the previous model conflated the two. Its
 * `filterByRange` trimmed a trailing day-count window and stopped there —
 * every range rendered the same bucket size, so a longer range simply drew
 * more marks. Measured over a 500-day fixture during Story 47's spike, mark
 * counts ran 8 / 28 / 76 / 143 / 284 / **383**: the `ALL` range drew one
 * mark per logged day, and a real 9.4 lb decline disappeared into an
 * unreadable smear (`docs/spikes/047-charting/evidence/02-desktop-range-all.png`).
 *
 * A range therefore carries two decisions, not one:
 *   1. the **window** — which dates are in view, and
 *   2. the **bucket** — what one mark represents inside it.
 *
 * Both live here rather than in a renderer, so web and mobile cannot
 * disagree about what a week is (ADR 0008: geometry and aggregation are
 * shared; only drawing is per-platform).
 *
 * Two rules hold throughout:
 *
 * - **Ranges are calendar-aware, not day counts.** "3 months ago" means the
 *   same calendar day three months back, not `today - 91`. The old constants
 *   drifted against real months by up to three days.
 * - **Missing is missing.** A bucket with no observations yields `null`, and
 *   `null` is never coerced to zero. Zero means "you logged nothing"; null
 *   means "we do not know". For body weight the distinction is the whole
 *   metric, and for counts it is the difference between a rest week and a
 *   week the data never arrived for.
 */

import { isoWeekStart } from './training-trends';
import { formatDateRangeLabel, formatWeekRange } from './progress-format';
import type { SeriesPoint } from './chart-geometry';

/** Selectable windows, ordered shortest to longest as the control renders them. */
export type ProgressRange = 'W' | 'M' | '3M' | '6M' | 'Y' | 'ALL';

export const progressRanges: readonly ProgressRange[] = ['W', 'M', '3M', '6M', 'Y', 'ALL'] as const;

/** What a single mark represents. Chosen per range, never global. */
export type ProgressBucket = 'day' | 'week' | 'month';

export interface ProgressWindow {
  /** Inclusive `YYYY-MM-DD`. */
  start: string;
  /** Inclusive `YYYY-MM-DD`. */
  end: string;
}

export interface ProgressPoint<Meta = unknown> {
  /** Bucket start, `YYYY-MM-DD` local. For a week bucket this is its Monday. */
  localDate: string;
  /** `null` is missing, never zero. */
  value: number | null;
  /** How many raw observations fell in this bucket. `0` for an empty bucket. */
  sampleCount: number;
  meta?: Meta;
}

export interface ProgressSeries<Meta = unknown> {
  range: ProgressRange;
  /** The window actually displayed, so summary copy can name it honestly. */
  window: ProgressWindow;
  /** How the range was bucketed, so the UI can label what a mark means. */
  bucket: ProgressBucket;
  points: ProgressPoint<Meta>[];
}

/** How raw observations inside one bucket collapse to a single value. */
export type BucketAggregation = 'mean' | 'sum' | 'count' | 'last';

const MS_PER_DAY = 86_400_000;

function toUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

function toLocalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Calendar-day difference, `b - a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / MS_PER_DAY);
}

/** First of the month containing `localDate`. */
export function monthStart(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

/**
 * Subtracts calendar months, clamping to the last valid day.
 *
 * `2026-03-31` minus one month is `2026-02-28`, not a rolled-over
 * `2026-03-03` — which is what naive `setUTCMonth` arithmetic produces and
 * why a "3M" window could silently start in the wrong month.
 */
export function subtractMonths(localDate: string, months: number): string {
  const date = toUtc(localDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return toLocalDate(date);
}

/**
 * Bucket size per range.
 *
 * Chosen so a chart holds roughly 7–30 marks whatever the range — enough to
 * show shape, few enough that each remains a touch target. This is the rule
 * the old model lacked entirely.
 */
export function bucketForRange(range: ProgressRange, spanDays: number): ProgressBucket {
  switch (range) {
    case 'W':
    case 'M':
      return 'day';
    case '3M':
    case '6M':
      return 'week';
    case 'Y':
      return 'week';
    case 'ALL':
      // A short history is still best read day by day; only once it outgrows
      // a chart's worth of weeks is monthly aggregation the honest summary.
      if (spanDays <= 31) return 'day';
      if (spanDays <= 400) return 'week';
      return 'month';
  }
}

/**
 * The date window a range covers, ending at `endLocalDate` (normally today).
 *
 * `W` is the current Monday–Sunday week rather than a trailing seven days:
 * the product's own copy says sessions completed "since Monday", and a
 * chart whose week disagrees with the sentence above it is worse than
 * either alone. Longer ranges are calendar-anchored offsets.
 *
 * `ALL` needs the data to know where it starts, so it is resolved by
 * `buildProgressSeries` rather than here.
 */
export function windowForRange(range: ProgressRange, endLocalDate: string): ProgressWindow {
  switch (range) {
    case 'W':
      return { start: isoWeekStart(endLocalDate), end: endLocalDate };
    case 'M':
      return { start: subtractMonths(endLocalDate, 1), end: endLocalDate };
    case '3M':
      return { start: subtractMonths(endLocalDate, 3), end: endLocalDate };
    case '6M':
      return { start: subtractMonths(endLocalDate, 6), end: endLocalDate };
    case 'Y':
      return { start: subtractMonths(endLocalDate, 12), end: endLocalDate };
    case 'ALL':
      return { start: endLocalDate, end: endLocalDate };
  }
}

/** The bucket a date belongs to, as that bucket's start date. */
export function bucketStart(localDate: string, bucket: ProgressBucket): string {
  switch (bucket) {
    case 'day':
      return localDate;
    case 'week':
      return isoWeekStart(localDate);
    case 'month':
      return monthStart(localDate);
  }
}

/**
 * Every bucket start in `window`, in order, including empty ones.
 *
 * Emitting empty buckets is deliberate: a gap must occupy space on the axis
 * or a three-week break looks like three consecutive days. This is what
 * "missing data is missing, not zero" means geometrically.
 */
/** The start of the bucket immediately after the one beginning `start`. */
export function nextBucketStart(start: string, bucket: ProgressBucket): string {
  const date = toUtc(start);
  if (bucket === 'day') date.setUTCDate(date.getUTCDate() + 1);
  else if (bucket === 'week') date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return toLocalDate(date);
}

export function bucketWindow(window: ProgressWindow, bucket: ProgressBucket): string[] {
  const starts: string[] = [];
  const endBucket = bucketStart(window.end, bucket);
  let cursor = bucketStart(window.start, bucket);
  // Bounded so a malformed window cannot spin forever; far above any real
  // bucket count (a decade of days).
  for (let guard = 0; guard < 4000; guard += 1) {
    starts.push(cursor);
    if (cursor >= endBucket) break;
    cursor = nextBucketStart(cursor, bucket);
  }
  return starts;
}

function aggregate(values: number[], how: BucketAggregation): number {
  switch (how) {
    case 'sum':
      return values.reduce((total, value) => total + value, 0);
    case 'count':
      return values.length;
    case 'last':
      return values[values.length - 1]!;
    case 'mean':
      return values.reduce((total, value) => total + value, 0) / values.length;
  }
}

export interface BuildSeriesOptions {
  range: ProgressRange;
  /** Normally today, in the user's timezone. */
  endLocalDate: string;
  /** How observations within one bucket collapse. */
  aggregation: BucketAggregation;
  /**
   * Emit `0` rather than `null` for a bucket with no observations.
   *
   * Only correct where absence genuinely *is* zero — you completed no
   * sessions that week, you lifted no volume that day. Never for a measure
   * like body weight, where an unweighed day is unknown, not zero.
   */
  emptyIsZero?: boolean;
  /**
   * Earliest date `emptyIsZero` is allowed to apply from. Buckets ending
   * before this stay `null`.
   *
   * "You completed no sessions that week" is only a fact about a week the
   * user was around for. Without this bound, selecting Y on a two-week-old
   * account draws fifty bars of zero — a year of not training, invented for
   * an account that did not exist. Story 51 hit the same edge in the insight
   * layer, where an empty prior week became "compared with 0 last week".
   */
  zeroFrom?: string | null;
  /**
   * Overrides the bucket `bucketForRange` would pick.
   *
   * Metrics do not all read best at the same resolution — see
   * `countBucketForRange`, which a count or workload chart passes here.
   *
   * Pass the *function* rather than a precomputed bucket whenever the choice
   * depends on how much history there is. `ALL`'s window is resolved from the
   * data inside this function, so a caller computing its own span from
   * `windowForRange('ALL', …)` gets zero and any span-dependent branch dies
   * silently — which is exactly what happened the first time this shipped.
   */
  bucket?: ProgressBucket | ((range: ProgressRange, spanDays: number) => ProgressBucket);
}

/**
 * Bucket size for a **count or workload** chart, which is coarser than the
 * measurement default at every range but `W`.
 *
 * Body weight at M is thirty daily marks and each one is a real reading. A
 * daily session count is almost always 0 or 1, so the same thirty marks are a
 * barcode carrying no shape; weekly totals over a month run 0–6 and show the
 * training rhythm the chart exists to reveal. Volume follows sessions rather
 * than body weight for the same reason — it is additive, so a week's total is
 * a meaningful quantity, where a week of body weight would have to be averaged.
 *
 * `ALL` steps down again once the history outgrows a weekly axis: six months
 * of daily bars rendered as 181 slivers at 390px, which is what sent this
 * function past its original one-range special case.
 *
 * `W` stays daily — seven bars is the whole point of that range — so the two
 * chart families still share one range control and one set of windows.
 */
export function countBucketForRange(range: ProgressRange, spanDays: number): ProgressBucket {
  if (range === 'W') return 'day';
  if (range === 'ALL') {
    /* A short history is still best read day by day — two weekly bars tell a
       ten-day-old account nothing. Past a month, weeks; past about two years,
       a weekly axis is >104 bars, so months. */
    if (spanDays <= 31) return 'day';
    return spanDays > 730 ? 'month' : 'week';
  }
  const bucket = bucketForRange(range, spanDays);
  return bucket === 'day' ? 'week' : bucket;
}

/**
 * Turns raw dated observations into a bucketed series for one range.
 *
 * The raw data is never mutated and stays the source of truth; this is
 * presentation aggregation, computed per range. Callers hold the raw series
 * and rebuild when the range changes.
 */
export function buildProgressSeries<Meta = unknown>(
  raw: readonly SeriesPoint<Meta>[],
  options: BuildSeriesOptions,
): ProgressSeries<Meta> {
  const observed = raw.filter((point) => point.value != null);

  /* `ALL` spans the data itself — first observation to last, **not** first
     observation to today. Extending it to today would pad the axis with
     every empty day since the user last logged, and because bucket size is
     chosen from the window's span, a long silence would silently coarsen
     the bucket: twenty daily check-ins from a year ago collapsed into a
     single monthly dot, which is the opposite of what "all time" should
     show. Every other range is a fixed calendar window that exists whether
     or not anything was logged inside it. */
  const earliest = observed.length
    ? observed.reduce((min, point) => (point.localDate < min ? point.localDate : min), observed[0]!.localDate)
    : options.endLocalDate;
  const latest = observed.length
    ? observed.reduce((max, point) => (point.localDate > max ? point.localDate : max), observed[0]!.localDate)
    : options.endLocalDate;
  const window =
    options.range === 'ALL'
      ? { start: earliest, end: latest }
      : windowForRange(options.range, options.endLocalDate);

  const spanDays = Math.max(daysBetween(window.start, window.end), 0);
  const bucket =
    typeof options.bucket === 'function'
      ? options.bucket(options.range, spanDays)
      : (options.bucket ?? bucketForRange(options.range, spanDays));

  /* Each bucket keeps its observations' `meta` alongside their values.
     Dropping it would break drill-down: the per-exercise chart navigates to
     `meta.sessionId`, so a bucketed point with no meta is a mark the user
     can tap and have nothing happen. The representative is the *last*
     observation in the bucket — the most recent session in that period,
     which is what tapping a week should open. */
  const byBucket = new Map<string, { values: number[]; meta: Meta | undefined }>();
  for (const point of observed) {
    if (point.localDate < window.start || point.localDate > window.end) continue;
    const key = bucketStart(point.localDate, bucket);
    const entry = byBucket.get(key);
    if (entry) {
      entry.values.push(point.value as number);
      if (point.meta !== undefined) entry.meta = point.meta;
    } else {
      byBucket.set(key, { values: [point.value as number], meta: point.meta });
    }
  }

  const points = bucketWindow(window, bucket).map<ProgressPoint<Meta>>((start) => {
    const entry = byBucket.get(start);
    if (!entry || entry.values.length === 0) {
      /* A bucket is zero only if it ends on or after the first day the user
         was logging. `bucketEnd` rather than `start`, so the week or month
         containing that first day still counts as zero-able — the user was
         present for part of it, and nulling the very bucket their history
         begins in would punch a hole at the left edge of every chart. */
      const bucketEnd = nextBucketStart(start, bucket);
      const zeroable =
        options.emptyIsZero && (!options.zeroFrom || bucketEnd > options.zeroFrom);
      return { localDate: start, value: zeroable ? 0 : null, sampleCount: 0 };
    }
    return {
      localDate: start,
      value: aggregate(entry.values, options.aggregation),
      sampleCount: entry.values.length,
      meta: entry.meta,
    };
  });

  return { range: options.range, window, bucket, points };
}

/**
 * Which ranges are worth offering, and which are merely redundant.
 *
 * Deliberately returns every range rather than hiding the ones a short
 * history cannot fill. The previous `availableRanges` returned `[]` below a
 * threshold and the selector rendered `null` under two options, so with
 * sparse data the control vanished entirely — a reviewer reasonably
 * concluded the feature had never been built (ADR 0008 flags this as a
 * decision Story 48 must make explicitly).
 *
 * A control that disappears teaches nothing. A control that is visible and
 * disabled says "this exists, and you will unlock it by logging more",
 * which is both honest and a reason to come back. `disabled` is advisory —
 * selecting such a range is harmless, it just shows the same data as a
 * shorter one.
 */
export function rangeOptions<Meta>(
  raw: readonly SeriesPoint<Meta>[],
  endLocalDate: string,
): Array<{ range: ProgressRange; disabled: boolean }> {
  const observed = raw.filter((point) => point.value != null);
  if (observed.length === 0) {
    return progressRanges.map((range) => ({ range, disabled: range !== 'ALL' }));
  }
  const earliest = observed.reduce(
    (min, point) => (point.localDate < min ? point.localDate : min),
    observed[0]!.localDate,
  );
  const spanDays = daysBetween(earliest, endLocalDate);
  /* A range is redundant once a *shorter* one already reaches the first
     observation — from there on every longer range draws the same picture.
     The first range that covers the data is emphatically not redundant: it
     is the tightest honest frame, and is what `defaultRange` opens on. An
     earlier cut of this disabled every covering range, so the chart opened
     on an option it simultaneously rendered as unavailable. */
  let coveredByShorter = false;
  return progressRanges.map((range) => {
    if (range === 'ALL') return { range, disabled: false };
    const reach = daysBetween(windowForRange(range, endLocalDate).start, endLocalDate);
    const disabled = coveredByShorter;
    if (reach >= spanDays) coveredByShorter = true;
    return { range, disabled };
  });
}

/**
 * The shortest range that still shows every observation.
 *
 * A better default than always opening on `ALL`: a user with three weeks of
 * data wants those three weeks framed, not squeezed against an axis sized
 * for a year they have not logged yet.
 */
export function defaultRange<Meta>(
  raw: readonly SeriesPoint<Meta>[],
  endLocalDate: string,
): ProgressRange {
  const observed = raw.filter((point) => point.value != null);
  if (observed.length === 0) return 'ALL';
  const earliest = observed.reduce(
    (min, point) => (point.localDate < min ? point.localDate : min),
    observed[0]!.localDate,
  );
  // The tightest window that still reaches back to the first observation.
  // Picking merely the shortest *enabled* range would open on a view that
  // silently omits older data, which is a worse default than a slightly
  // roomy axis.
  const covering = progressRanges.find(
    (range) => range !== 'ALL' && windowForRange(range, endLocalDate).start <= earliest,
  );
  return covering ?? 'ALL';
}

/** Human label for a range, for accessible names and summary copy. */
export function progressRangeLabel(range: ProgressRange): string {
  switch (range) {
    case 'W':
      return 'This week';
    case 'M':
      return 'Past month';
    case '3M':
      return 'Past 3 months';
    case '6M':
      return 'Past 6 months';
    case 'Y':
      return 'Past year';
    case 'ALL':
      return 'All time';
  }
}

/** What one mark represents, for the axis caption. */
export function bucketLabel(bucket: ProgressBucket): string {
  switch (bucket) {
    case 'day':
      return 'daily';
    case 'week':
      return 'weekly';
    case 'month':
      return 'monthly';
  }
}

/**
 * The period one mark covers, named honestly.
 *
 * A bucketed point is keyed by its bucket's *start* date, so rendering that
 * key with a plain day formatter states something false: at the 6M range a
 * mark is the mean of a week's check-ins, and labelling it "Aug 19" tells
 * the user they weighed that value on the 19th — a morning they may not
 * have stepped on the scale at all. Precision the data does not have is
 * worse than coarser precision that is true, because the user cannot tell
 * the difference by looking.
 *
 * Day buckets keep the bare date; week and month buckets name their span.
 */
export function formatBucketPeriod(localDate: string, bucket: ProgressBucket): string {
  switch (bucket) {
    case 'day':
      return formatDateRangeLabel(localDate, localDate);
    case 'week':
      return formatWeekRange(localDate);
    case 'month': {
      const date = toUtc(localDate);
      const monthEnd = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      );
      return formatDateRangeLabel(localDate, toLocalDate(monthEnd));
    }
  }
}

/**
 * How a mark's value should be described, given how it was aggregated.
 *
 * Returns `null` for a day bucket holding a single observation: that mark
 * *is* the reading, and calling it an "average of 1" is noise. Everything
 * else says what was combined, so a summary figure is never mistaken for a
 * measurement. `sampleCount` distinguishes "the average of 5 check-ins"
 * from "the only check-in that week", which look identical on the plot but
 * warrant very different confidence.
 */
export function describeBucketValue(
  point: Pick<ProgressPoint, 'sampleCount'>,
  bucket: ProgressBucket,
  aggregation: BucketAggregation,
): string | null {
  if (point.sampleCount <= 0) return null;
  if (bucket === 'day' && point.sampleCount === 1) return null;
  const noun = point.sampleCount === 1 ? 'check-in' : 'check-ins';
  switch (aggregation) {
    case 'mean':
      return point.sampleCount === 1
        ? `the only ${noun} that ${bucket}`
        : `average of ${point.sampleCount} ${noun}`;
    case 'sum':
      return `total across ${point.sampleCount} ${noun}`;
    case 'count':
      return null;
    case 'last':
      return point.sampleCount === 1 ? null : `latest of ${point.sampleCount} ${noun}`;
  }
}

export interface PeriodComparison {
  /** The most recent bucket in the series. */
  current: ProgressPoint;
  /** The bucket before it, or `null` if the series has only one. */
  previous: ProgressPoint | null;
  /**
   * `current - previous`, and `null` unless the comparison is honest.
   *
   * Requires both values to be known. A `null` previous bucket is one that
   * predates the user's first activity, and treating it as zero manufactures
   * a baseline from a period they were not there for — "compared with 0 last
   * week" for a week before they signed up. Story 51 shipped that bug once.
   */
  change: number | null;
  /**
   * True when `current` extends past `endLocalDate` — a week still being
   * lived in. Callers must not present a partial bucket as directly
   * comparable to a finished one.
   */
  isPartial: boolean;
}

/**
 * The latest bucket, the one before it, and whether they can honestly be
 * compared.
 *
 * Lives here rather than in either renderer so web and mobile cannot disagree
 * about what "previous period" means or when a comparison is safe to show.
 */
export function comparePeriods(
  series: ProgressSeries,
  endLocalDate: string,
): PeriodComparison | null {
  const current = series.points.at(-1);
  if (!current) return null;
  const previous = series.points.at(-2) ?? null;
  const change =
    current.value != null && previous?.value != null ? current.value - previous.value : null;
  return {
    current,
    previous,
    change,
    isPartial: nextBucketStart(current.localDate, series.bucket) > endLocalDate,
  };
}

/**
 * How a partial bucket names itself: "Current week", "Today", "This month".
 *
 * Story 33: a period that is still in progress must be distinguishable
 * without relying on its fill colour. This is the text half of that.
 */
export function currentPeriodLabel(bucket: ProgressBucket): string {
  switch (bucket) {
    case 'day':
      return 'Today';
    case 'week':
      return 'Current week';
    case 'month':
      return 'This month';
  }
}
