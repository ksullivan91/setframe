/**
 * The evidence layer beneath Progress: what changed, compared with what, and
 * whether there is enough data to say so at all.
 *
 * Charts show shape. This module produces the *facts* about that shape — a
 * normalised summary per metric per range, computed deterministically, with
 * no model in the loop. Story 51 is explicit that trustworthy analytics come
 * before any AI coaching, and the principle it protects is this one:
 *
 *   **A future intelligence service consumes calculated evidence, never raw
 *   history or chart pixels.**
 *
 * So the contract below is the boundary. `buildProgressInsight` produces it;
 * `describeInsight` turns it into a sentence for the UI. Nothing that renders
 * a chart ever constructs a prompt, and a prompt-builder never reads UI
 * state — it reads a `ProgressInsight`.
 *
 * ## What counts as an insight
 *
 * Not this: *"Your current weight is 168.6 lb."* That restates the number
 * already printed above the chart, and the story names it directly as the
 * failure mode to avoid. An insight must add **comparison**, **pattern**, or
 * **data-quality context**. When none of those are available,
 * `describeInsight` returns `null` and the UI shows nothing — *no insight is
 * better than a meaningless insight.*
 *
 * ## Comparison rigour
 *
 * Comparing a Tuesday-so-far against a complete previous week is not a
 * comparison, it is an artefact. How the previous period is matched depends
 * on what the metric accumulates:
 *
 * - **Accumulating metrics** (session counts, volume totals) grow with every
 *   elapsed day, so the previous window is **truncated to the same number of
 *   elapsed days**. Two days into this week is compared against the first two
 *   days of last week. `comparisonBasis: 'elapsed_matched'`.
 * - **Averaging metrics** (body-weight mean) do not grow with time — a
 *   seven-day mean and a two-day mean are both means — so the previous window
 *   is used whole. `comparisonBasis: 'full_period'`.
 *
 * Either way `current.isPartial` is set, so copy can say "so far" rather than
 * implying a finished period.
 *
 * ## No judgement
 *
 * Direction is reported, never valued. A user deliberately gaining is
 * succeeding when the number rises, and this module has no access to their
 * goal — see `docs/research/body-weight-display-psychology.md`, which is why
 * `weight-trend.ts` already treats direction as unvalenced. Nothing here
 * infers anything medical or prescriptive.
 */

import type { SeriesPoint } from './chart-geometry';
import {
  type ProgressRange,
  type ProgressWindow,
  type BucketAggregation,
  daysBetween,
  windowForRange,
} from './progress-range';

/** Metrics that can currently produce evidence. Extensible by design. */
export type InsightMetric = 'body_weight' | 'training_frequency' | 'training_volume';

/**
 * Whether this insight can be stated at all.
 *
 * Explicit rather than encoded as a null value, because "we cannot say" is a
 * real answer that the UI and a future model both need to distinguish from
 * "no change".
 */
export type InsightAvailability =
  /** Enough data in both periods to state a comparison. */
  | 'ok'
  /** The current period has too few observations to summarise. */
  | 'insufficient_data'
  /** Current period is fine, but there is nothing to compare it against. */
  | 'no_comparison';

/**
 * Machine-readable caveats. The UI may soften copy on these; a future model
 * should weight or refuse a claim on them.
 */
export type DataQualityFlag =
  /** The current period is still running — it will grow. */
  | 'partial_current_period'
  /** Fewer observations than `minimumSamples` in the current period. */
  | 'sparse_current_period'
  /** Fewer observations than `minimumSamples` in the previous period. */
  | 'sparse_previous_period'
  /** No previous period exists (ALL range, or history starts here). */
  | 'no_previous_period'
  /** Buckets inside the window had no observations at all. */
  | 'gaps_in_window'
  /** Exactly one observation — a value, but not yet a pattern. */
  | 'single_observation';

export interface InsightPeriod {
  /** Inclusive `YYYY-MM-DD`. */
  start: string;
  /** Inclusive `YYYY-MM-DD`. */
  end: string;
  /** Aggregated value, or `null` when the period holds no observations. */
  value: number | null;
  /** Raw observations behind `value`. */
  sampleCount: number;
  /** Calendar days covered so far, inclusive. */
  elapsedDays: number;
  /** Calendar days the period will cover once complete. */
  periodDays: number;
  /** `elapsedDays < periodDays` — the period is still running. */
  isPartial: boolean;
}

export interface InsightChange {
  /** `current - previous`, in the metric's own unit. Sign carries no value judgement. */
  absolute: number;
  /**
   * Percent change against the previous period. `null` when the previous
   * value is zero — "up from nothing" has no meaningful percentage, and
   * reporting `Infinity` as a number invites a nonsense sentence.
   */
  percent: number | null;
}

export type InsightDirection = 'up' | 'down' | 'flat' | 'insufficient_data';

export interface InsightTrend {
  direction: InsightDirection;
  /** Change per bucket from a least-squares fit. `null` below the threshold. */
  slope: number | null;
  /** Confidence in the direction, from sample count alone — not a p-value. */
  confidence: 'low' | 'medium' | 'high';
}

/**
 * The contract. This is what a future intelligence service receives, and the
 * only thing `describeInsight` reads.
 */
export interface ProgressInsight {
  metric: InsightMetric;
  range: ProgressRange;
  availability: InsightAvailability;
  current: InsightPeriod;
  previous: InsightPeriod | null;
  change: InsightChange | null;
  trend: InsightTrend | null;
  /** How `previous` was matched to `current`. See the module note. */
  comparisonBasis: 'elapsed_matched' | 'full_period' | 'none';
  dataQuality: DataQualityFlag[];
  /**
   * Where the supporting chart lives, so an insight can focus its own
   * evidence. Story 51: *"an insight should link to its supporting chart and
   * selected period."*
   */
  focus: { metric: InsightMetric; range: ProgressRange };
}

export interface BuildInsightOptions {
  metric: InsightMetric;
  range: ProgressRange;
  /** Normally today, in the user's timezone. */
  endLocalDate: string;
  /** How observations collapse within a period. */
  aggregation: BucketAggregation;
  /**
   * Observations required in a period before it is summarised at all.
   * Below this the insight reports `insufficient_data` rather than a number
   * computed from one or two readings.
   */
  minimumSamples?: number;
  /**
   * Treat a period with no observations as `0` rather than `null`.
   *
   * Correct only where absence genuinely is zero — you completed no sessions,
   * you lifted no volume. Never for body weight, where an unweighed week is
   * unknown, not zero. Mirrors `emptyIsZero` in `progress-range.ts`.
   */
  emptyIsZero?: boolean;
  /**
   * The finest granularity the source observations actually carry.
   *
   * Elapsed-matching subdivides the previous window by day, which only works
   * if the source has per-day observations. `/progress/overview` returns
   * training data **pre-aggregated by week** — one point per `weekStart`
   * holding that week's total — so truncating its previous window to
   * "Monday–Tuesday" would still capture the whole previous week's bucket
   * and compare it against a partial current one: precisely the artefact
   * elapsed-matching exists to prevent, arrived at from the other direction.
   *
   * With `'week'`, matching falls back to whole periods and the comparison is
   * labelled partial instead, which is the honest reading the story's own
   * example uses ("2 sessions this week, compared with 3 last week").
   */
  sourceGranularity?: 'day' | 'week';
}

const DEFAULT_MINIMUM_SAMPLES = 2;

/** Metrics whose value accumulates with elapsed time. See the module note. */
const ACCUMULATING: readonly BucketAggregation[] = ['sum', 'count'];

/**
 * How much of a period an averaging metric must cover before its mean is
 * allowed to stand for that period. Half is the point where "this week" stops
 * being a couple of readings and starts being a week.
 */
const AVERAGING_MIN_COVERAGE = 0.5;

function aggregateValues(values: number[], how: BucketAggregation): number {
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

function addDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Inclusive day count for a window. */
function windowDays(window: ProgressWindow): number {
  return daysBetween(window.start, window.end) + 1;
}

/**
 * How many days the period covers once complete.
 *
 * Only `W` can be partial. Story 48 anchors it to the current Monday–Sunday
 * week — so on a Tuesday its window holds two days of a seven-day period, and
 * a comparison against a finished week needs to know that. Every other range
 * is a *trailing* window ending at today (`subtractMonths(today, 1)` → today),
 * which is complete by construction: a rolling month is always a whole month.
 *
 * Deriving this from the window itself is what made `isPartial` permanently
 * false in an earlier cut — the window is already truncated to today, so it
 * always looked complete.
 */
function fullPeriodDays(range: ProgressRange, window: ProgressWindow): number {
  return range === 'W' ? 7 : windowDays(window);
}

/**
 * The equivalent window immediately before `current`.
 *
 * Derived by asking `windowForRange` for the same range ending the day before
 * the current window starts, so it inherits Story 48's calendar-anchoring
 * rather than subtracting a fixed day count — "the previous month" is a real
 * month, not 30 days. `ALL` has no previous period by definition.
 */
export function previousWindowFor(
  range: ProgressRange,
  current: ProgressWindow,
): ProgressWindow | null {
  if (range === 'ALL') return null;
  const previousEnd = addDays(current.start, -1);
  const { start } = windowForRange(range, previousEnd);
  return { start, end: previousEnd };
}

function collect(
  raw: readonly SeriesPoint<unknown>[],
  window: ProgressWindow,
): number[] {
  const values: number[] = [];
  for (const point of raw) {
    if (point.value == null) continue;
    if (point.localDate < window.start || point.localDate > window.end) continue;
    values.push(point.value);
  }
  return values;
}

function buildPeriod(
  raw: readonly SeriesPoint<unknown>[],
  window: ProgressWindow,
  options: BuildInsightOptions,
  /** Days the period covers once complete; see `fullPeriodDays`. */
  periodDays: number,
  /** For a partial current period, how many days have actually elapsed. */
  elapsedOverride?: number,
): InsightPeriod {
  const values = collect(raw, window);
  const elapsedDays = elapsedOverride ?? windowDays(window);
  const hasValues = values.length > 0;
  return {
    start: window.start,
    end: window.end,
    value: hasValues
      ? aggregateValues(values, options.aggregation)
      : options.emptyIsZero
        ? 0
        : null,
    sampleCount: values.length,
    elapsedDays,
    periodDays,
    isPartial: elapsedDays < periodDays,
  };
}

/**
 * Least-squares slope across the observations in a window, per day.
 *
 * Reported only as supporting evidence for `direction`; the UI leads with the
 * period comparison, which is far easier to state honestly than a gradient.
 */
function fitSlope(points: Array<{ day: number; value: number }>): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const meanX = points.reduce((total, p) => total + p.day, 0) / n;
  const meanY = points.reduce((total, p) => total + p.value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    numerator += (p.day - meanX) * (p.value - meanY);
    denominator += (p.day - meanX) ** 2;
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * How small a move still counts as "no change", per metric.
 *
 * Deliberately **not** one global percentage. Two percent of 168 lb is 3.4 lb
 * — a substantial change that a relative threshold would report as
 * unchanged — while two percent of 2 sessions is meaningless. A metric with a
 * natural scale needs an absolute threshold; only volume, which spans orders
 * of magnitude between users, is genuinely relative.
 *
 * The body-weight figure is deliberately near `weight-trend.ts`'s
 * `steadyThresholdPerWeek` of 0.25: just under the smallest move that is
 * plausibly real rather than scale scatter or hydration.
 */
const FLAT_THRESHOLDS: Record<InsightMetric, { absolute?: number; percent?: number }> = {
  /** Half a pound, in the display unit. Below this is water, not weight. */
  body_weight: { absolute: 0.5 },
  /** Counts are integers; anything under half a session means "the same". */
  training_frequency: { absolute: 0.5 },
  /** Volume varies hugely between users, so relative is the honest measure. */
  training_volume: { percent: 5 },
};

/** `flat` is a real answer, not a fallback. */
function directionFor(
  change: InsightChange | null,
  threshold: { absolute?: number; percent?: number },
): InsightDirection {
  if (!change) return 'insufficient_data';
  if (threshold.absolute != null && Math.abs(change.absolute) < threshold.absolute) return 'flat';
  if (threshold.percent != null && change.percent != null) {
    if (Math.abs(change.percent) < threshold.percent) return 'flat';
  }
  if (change.absolute === 0) return 'flat';
  return change.absolute > 0 ? 'up' : 'down';
}

function confidenceFor(sampleCount: number): InsightTrend['confidence'] {
  if (sampleCount >= 8) return 'high';
  if (sampleCount >= 4) return 'medium';
  return 'low';
}

/**
 * Builds the evidence for one metric over one range.
 *
 * `raw` is the same dated observation list the chart is built from, so the
 * insight and the chart can never disagree about what happened — they read
 * one source.
 */
export function buildProgressInsight(
  raw: readonly SeriesPoint<unknown>[],
  options: BuildInsightOptions,
  /** Overrides the per-metric default in `FLAT_THRESHOLDS`. */
  flatThreshold?: { absolute?: number; percent?: number },
): ProgressInsight {
  const threshold = flatThreshold ?? FLAT_THRESHOLDS[options.metric];
  const minimumSamples = options.minimumSamples ?? DEFAULT_MINIMUM_SAMPLES;
  const observed = raw.filter((point) => point.value != null);

  /* `ALL` spans the data itself rather than a calendar offset — matching
     `buildProgressSeries`, so the insight describes exactly the window the
     chart drew. */
  const earliest = observed.length
    ? observed.reduce((min, p) => (p.localDate < min ? p.localDate : min), observed[0]!.localDate)
    : options.endLocalDate;
  const fullWindow =
    options.range === 'ALL'
      ? { start: earliest, end: options.endLocalDate }
      : windowForRange(options.range, options.endLocalDate);

  /* A calendar window runs to the end of its period, but only the days up to
     `endLocalDate` have actually happened. `W` on a Tuesday is a seven-day
     window with two days in it. */
  const elapsedDays = daysBetween(fullWindow.start, options.endLocalDate) + 1;
  const periodDays = fullPeriodDays(options.range, fullWindow);
  const current = buildPeriod(raw, fullWindow, options, periodDays, elapsedDays);

  /* Elapsed-matching needs day-level source data to subdivide; see
     `sourceGranularity`. */
  const accumulating =
    ACCUMULATING.includes(options.aggregation) && (options.sourceGranularity ?? 'day') === 'day';
  const previousWindowFull = previousWindowFor(options.range, fullWindow);

  /* Elapsed-matching only applies to metrics that accumulate. Truncating the
     previous window for a *mean* would compare two averages computed over
     different amounts of data for no benefit, and would make a body-weight
     comparison noisier the earlier in the week you looked at it. */
  const previousWindow =
    previousWindowFull && accumulating && current.isPartial
      ? { start: previousWindowFull.start, end: addDays(previousWindowFull.start, elapsedDays - 1) }
      : previousWindowFull;

  const previous = previousWindow
    ? buildPeriod(raw, previousWindow, options, windowDays(previousWindow))
    : null;

  /* "Sparse" has to mean *fewer observations than this period could hold*,
     not simply "fewer than two". Weekly-aggregated training data carries
     exactly one observation per week by construction, so judging it against a
     flat minimum flags every single week-range comparison as thin — a caveat
     that is always on is worse than no caveat, because it trains the reader
     to ignore the ones that matter. A period already holding everything it
     can hold is complete, whatever that count happens to be. */
  const perPeriodCapacity = (period: InsightPeriod) =>
    (options.sourceGranularity ?? 'day') === 'week'
      ? Math.max(1, Math.ceil(period.elapsedDays / 7))
      : period.elapsedDays;
  const isSparse = (period: InsightPeriod) =>
    period.sampleCount > 0 &&
    period.sampleCount < Math.min(minimumSamples, perPeriodCapacity(period));

  const dataQuality: DataQualityFlag[] = [];
  if (current.isPartial) dataQuality.push('partial_current_period');
  if (current.sampleCount === 1) dataQuality.push('single_observation');
  if (isSparse(current)) dataQuality.push('sparse_current_period');
  if (!previous || previous.sampleCount === 0) {
    dataQuality.push('no_previous_period');
  } else if (isSparse(previous)) {
    dataQuality.push('sparse_previous_period');
  }
  /* A gap is a day inside the window with no observation, for metrics where
     absence is genuinely unknown. Where absence means zero, an empty day is
     data, not a gap. */
  if (!options.emptyIsZero && current.sampleCount > 0 && current.sampleCount < elapsedDays) {
    dataQuality.push('gaps_in_window');
  }

  /* An averaging metric over a barely-started period is not a summary of that
     period, it is the first day or two of it wearing the period's name. Two
     days of morning weight is dominated by water and gut content — the exact
     noise `docs/research/body-weight-display-psychology.md` exists to keep off
     the screen — and calling it "your 2-day average" alongside the 7-day
     average shown elsewhere invites a comparison between two different
     things. Accumulating metrics are exempt: a partial count is a real count,
     and elapsed-matching already makes it comparable. */
  const coverage = current.periodDays > 0 ? current.elapsedDays / current.periodDays : 1;
  const tooShortToAverage =
    !ACCUMULATING.includes(options.aggregation) && coverage < AVERAGING_MIN_COVERAGE;

  const canSummariseCurrent =
    current.value != null &&
    current.sampleCount >= Math.min(minimumSamples, 1) &&
    !tooShortToAverage;
  /* `emptyIsZero` says an empty period means zero — but only for a period the
     user was actually around for. A week *inside* your history with no
     sessions is a real zero and the comparison is the whole point. A week
     that predates your first-ever observation is not a zero, it is an absence
     of data, and treating it as one manufactures the exact claim this module
     exists to refuse: "2 sessions, compared with 0 last week" to someone who
     simply had not started logging yet. History has to reach back into the
     previous window for its emptiness to mean anything. */
  const previousWithinHistory = previous != null && observed.length > 0 && earliest <= previous.end;
  const hasComparable =
    canSummariseCurrent &&
    previous != null &&
    previous.value != null &&
    (previous.sampleCount > 0 || (options.emptyIsZero === true && previousWithinHistory));

  const change: InsightChange | null =
    hasComparable && current.value != null && previous!.value != null
      ? {
          absolute: current.value - previous!.value,
          percent:
            previous!.value === 0
              ? null
              : ((current.value - previous!.value) / Math.abs(previous!.value)) * 100,
        }
      : null;

  const slope = fitSlope(
    observed
      .filter((p) => p.localDate >= fullWindow.start && p.localDate <= fullWindow.end)
      .map((p) => ({ day: daysBetween(fullWindow.start, p.localDate), value: p.value as number })),
  );

  const trend: InsightTrend | null = canSummariseCurrent
    ? {
        direction: directionFor(change, threshold),
        slope,
        confidence: confidenceFor(current.sampleCount),
      }
    : null;

  const availability: InsightAvailability = !canSummariseCurrent
    ? 'insufficient_data'
    : change == null
      ? 'no_comparison'
      : 'ok';

  return {
    metric: options.metric,
    range: options.range,
    availability,
    current,
    previous,
    change,
    trend,
    comparisonBasis:
      previous == null ? 'none' : accumulating && current.isPartial ? 'elapsed_matched' : 'full_period',
    dataQuality,
    focus: { metric: options.metric, range: options.range },
  };
}

export interface DescribeInsightOptions {
  /** Appended to values, e.g. `lb`. Omitted for counts. */
  unit?: string;
  /** Decimal places for values. */
  precision?: number;
}

function round(value: number, precision: number): string {
  return value.toFixed(precision).replace(/\.0+$/, '');
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/**
 * Turns evidence into one factual sentence, or `null`.
 *
 * `null` is a first-class result and the reason this function exists
 * separately from the contract: the decision "there is nothing worth saying"
 * belongs in one place, not scattered across two platforms' UI. Story 51 is
 * unambiguous — *no insight is better than a meaningless insight* — so an
 * insight that would merely restate the chart's headline number returns
 * nothing at all.
 *
 * Copy states what happened and against what. It never evaluates: no "great
 * work", no "you're falling behind", and no interpretation of whether a
 * direction is desirable.
 */
export function describeInsight(
  insight: ProgressInsight,
  options: DescribeInsightOptions = {},
): string | null {
  const { unit, precision = 1 } = options;
  const suffix = unit ? ` ${unit}` : '';

  if (insight.availability !== 'ok' || !insight.change || !insight.previous) return null;
  if (insight.current.value == null || insight.previous.value == null) return null;

  const partial = insight.current.isPartial;
  const magnitude = Math.abs(insight.change.absolute);
  const flat = insight.trend?.direction === 'flat';

  switch (insight.metric) {
    case 'training_frequency': {
      const current = Math.round(insight.current.value);
      const previous = Math.round(insight.previous.value);
      /* Elapsed-matched, so the previous figure is "the same stretch of last
         week" rather than all of it — say so, or the sentence silently
         compares two different spans. */
      const previousPhrase =
        insight.comparisonBasis === 'elapsed_matched'
          ? `${previous} by this point last ${periodNoun(insight.range)}`
          : `${previous} last ${periodNoun(insight.range)}`;
      if (current === previous) {
        return `${plural(current, 'session')} ${partial ? 'so far' : ''}, the same as ${previousPhrase}.`.replace(
          / {2,}/g,
          ' ',
        );
      }
      return `${plural(current, 'session')}${partial ? ' so far' : ''}, compared with ${previousPhrase}.`;
    }

    case 'training_volume': {
      if (flat) {
        return `Training volume is about the same as ${insight.comparisonBasis === 'elapsed_matched' ? 'this point in' : ''} the previous ${periodNoun(insight.range)}.`.replace(
          / {2,}/g,
          ' ',
        );
      }
      const percent = insight.change.percent;
      const movement = insight.change.absolute > 0 ? 'higher' : 'lower';
      if (percent != null) {
        return `Training volume is ${Math.abs(Math.round(percent))}% ${movement} than the previous ${periodNoun(insight.range)}${partial ? ' at this point' : ''}.`;
      }
      return `Training volume is ${round(magnitude, 0)}${suffix} ${movement} than the previous ${periodNoun(insight.range)}.`;
    }

    case 'body_weight': {
      /* Body weight leads with the rolling average rather than the latest
         reading: overnight change is dominated by water and gut content, so a
         day-over-day delta is noise dressed as a result. Same reasoning that
         keeps `ratePerWeek` the only change figure in `weight-trend.ts`. */
      const average = round(insight.current.value, precision);
      if (flat) {
        return `Your ${describeAveragingWindow(insight)} average is ${average}${suffix}, unchanged from the previous ${periodNoun(insight.range)}.`;
      }
      const movement = insight.change.absolute > 0 ? 'above' : 'below';
      return `Your ${describeAveragingWindow(insight)} average is ${average}${suffix}, ${round(magnitude, precision)}${suffix} ${movement} the previous ${periodNoun(insight.range)}.`;
    }
  }
}

/** The noun for one period of this range, for comparison copy. */
function periodNoun(range: ProgressRange): string {
  switch (range) {
    case 'W':
      return 'week';
    case 'M':
      return 'month';
    case '3M':
      return '3 months';
    case '6M':
      return '6 months';
    case 'Y':
      return 'year';
    case 'ALL':
      return 'period';
  }
}

/** How long the current value was averaged over, for body-weight copy. */
function describeAveragingWindow(insight: ProgressInsight): string {
  const days = insight.current.elapsedDays;
  if (days <= 7) return `${days}-day`;
  if (insight.range === 'M') return 'monthly';
  return `${periodNoun(insight.range)}`;
}
