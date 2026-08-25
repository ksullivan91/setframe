/**
 * Body-weight trend maths.
 *
 * Deliberately provides **no day-over-day delta**. Overnight body-weight
 * change is dominated by water, glycogen, sodium and gut content, so a
 * "you are -1.8 lb today" readout is mostly noise presented as a result.
 * Displaying it invites emotional reactivity to a number that carries
 * almost no information about fat or muscle change. Every export here is
 * built to answer "which way am I actually going, and how fast", on a
 * timescale where the signal exceeds the noise.
 *
 * Design rules encoded in this module:
 *
 * 1. The headline number is a **7-day rolling average**, not the latest
 *    weigh-in. The raw weigh-in stays available as a secondary value —
 *    we smooth the display, we never hide or alter the logged data.
 * 2. Change is expressed as a **rate per week over a trailing window**
 *    (default 4 weeks), not a cumulative "since you started" total and
 *    never a comparison with yesterday.
 * 3. Nothing claims a trend until there is enough data to support one.
 *    `sufficiency` gates this explicitly, and callers must render the
 *    "establishing baseline" state rather than a flat or fabricated line.
 * 4. Direction is reported as `rising` / `falling` / `steady` with **no
 *    valence**. Setframe is a strength app: a user who is intentionally
 *    bulking is succeeding when the number goes up. Nothing in this module
 *    decides whether a direction is good, and the UI must not colour it
 *    red/green as though it had.
 * 5. Weekly summaries carry high/low alongside the average, so the normal
 *    range of fluctuation is visible in context.
 *
 * Two smoothers are provided because they suit different logging habits:
 * the exponentially-weighted moving average degrades gracefully across
 * gaps and suits near-daily weighers, while the rolling mean is far easier
 * to explain and suits people who weigh a few times a week.
 */

import { convertLoad, type LoadUnit } from './units';

export interface WeightCheckIn {
  /** Calendar date in the user's own timezone, `YYYY-MM-DD`. */
  localDate: string;
  weightValue: number;
  weightUnit: LoadUnit;
}

export interface WeightSeriesPoint {
  localDate: string;
  /** The number the user actually logged, normalised to the display unit. */
  raw: number;
  /**
   * Exponentially-weighted trend value. Present from the first point, but
   * callers must not draw it until `sufficiency === 'ready'`.
   */
  trend: number;
  /**
   * Mean of the raw check-ins in the trailing 7 calendar days, inclusive.
   * `null` until `minimumCheckInsForAverage` readings exist in that window.
   */
  rollingAverage: number | null;
}

export interface WeightWeek {
  /** Monday of the ISO week, `YYYY-MM-DD`. */
  weekStart: string;
  average: number;
  low: number;
  high: number;
  checkInCount: number;
}

export type WeightDirection = 'rising' | 'falling' | 'steady';

export type WeightSufficiency =
  /** No check-ins at all. */
  | 'none'
  /** Some data, but not enough to smooth or to claim a direction. */
  | 'establishing'
  /** Enough data for the rolling average and a trend rate. */
  | 'ready';

export interface WeightTrend {
  unit: LoadUnit;
  points: WeightSeriesPoint[];
  weeks: WeightWeek[];
  sufficiency: WeightSufficiency;
  /** The 7-day rolling average — the number to lead with. `null` until ready. */
  currentAverage: number | null;
  /** The most recent raw check-in, always available once one exists. */
  latestCheckIn: WeightCheckIn | null;
  /**
   * Signed change per week across the trailing window, from a least-squares
   * fit. `null` until there is enough data. Positive means rising; this
   * carries no judgement about whether that is desirable.
   */
  ratePerWeek: number | null;
  direction: WeightDirection | null;
  /** Number of whole weeks the rate was measured over. */
  windowWeeks: number;
  /** Total check-ins considered. */
  checkInCount: number;
}

export interface WeightTrendOptions {
  /** Unit to report in. Defaults to the unit of the latest check-in. */
  displayUnit?: LoadUnit;
  /**
   * EWMA smoothing factor. 0.1 is the Hacker's Diet default: each new
   * reading moves the trend by a tenth of its distance, so a real change
   * emerges over roughly three weeks while a single heavy meal does not.
   */
  smoothingFactor?: number;
  /** Trailing window for the rate of change, in weeks. */
  windowWeeks?: number;
  /** Check-ins required in a 7-day window before its average is reported. */
  minimumCheckInsForAverage?: number;
  /** Check-ins required overall before any trend is claimed. */
  minimumCheckInsForTrend?: number;
  /**
   * Rate magnitudes below this (per week, in the display unit) are reported
   * as `steady`. A judgement call, set just under the smallest weekly change
   * that is plausibly real rather than measurement scatter.
   */
  steadyThresholdPerWeek?: number;
}

const DEFAULTS = {
  smoothingFactor: 0.1,
  windowWeeks: 4,
  minimumCheckInsForAverage: 3,
  minimumCheckInsForTrend: 5,
  steadyThresholdPerWeek: 0.25,
} as const;

function toDayNumber(localDate: string): number {
  return Math.round(Date.parse(`${localDate}T00:00:00Z`) / 86_400_000);
}

/** Monday-anchored ISO week start for a `YYYY-MM-DD` string. */
export function weekStartOf(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - isoDay + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Least-squares slope of `value` against `day`, returned per 7 days.
 * `null` when the points are too few or all share one date, in which case
 * a slope is undefined rather than zero.
 */
function weeklySlope(points: readonly { day: number; value: number }[]): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const meanDay = points.reduce((sum, point) => sum + point.day, 0) / n;
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    const dx = point.day - meanDay;
    covariance += dx * (point.value - meanValue);
    variance += dx * dx;
  }
  if (variance === 0) return null;
  return (covariance / variance) * 7;
}

/**
 * Builds the full trend view for a set of check-ins.
 *
 * Input order does not matter; multiple check-ins on one date are averaged
 * so a user who weighs twice in a morning does not double-weight that day.
 */
export function computeWeightTrend(
  checkIns: readonly WeightCheckIn[],
  options: WeightTrendOptions = {},
): WeightTrend {
  const smoothingFactor = options.smoothingFactor ?? DEFAULTS.smoothingFactor;
  const windowWeeks = options.windowWeeks ?? DEFAULTS.windowWeeks;
  const minimumCheckInsForAverage =
    options.minimumCheckInsForAverage ?? DEFAULTS.minimumCheckInsForAverage;
  const minimumCheckInsForTrend =
    options.minimumCheckInsForTrend ?? DEFAULTS.minimumCheckInsForTrend;
  const steadyThreshold = options.steadyThresholdPerWeek ?? DEFAULTS.steadyThresholdPerWeek;

  const sorted = [...checkIns].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const latestCheckIn = sorted.at(-1) ?? null;
  const unit = options.displayUnit ?? latestCheckIn?.weightUnit ?? 'lb';

  if (!sorted.length) {
    return {
      unit,
      points: [],
      weeks: [],
      sufficiency: 'none',
      currentAverage: null,
      latestCheckIn: null,
      ratePerWeek: null,
      direction: null,
      windowWeeks,
      checkInCount: 0,
    };
  }

  // Collapse to one observation per calendar date, in the display unit.
  const byDate = new Map<string, number[]>();
  for (const checkIn of sorted) {
    const value = convertLoad(checkIn.weightValue, checkIn.weightUnit, unit);
    byDate.set(checkIn.localDate, [...(byDate.get(checkIn.localDate) ?? []), value]);
  }
  const daily = [...byDate.entries()]
    .map(([localDate, values]) => ({
      localDate,
      day: toDayNumber(localDate),
      raw: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => a.day - b.day);

  // The EWMA is seeded with the mean of the first week of readings rather
  // than the single first one. Seeding from one reading leaves the trend
  // biased toward whatever that morning happened to be, and the resulting
  // warm-up drift as it converges is large enough to be mistaken for a real
  // rate of change on short histories.
  const seedWindow = daily.slice(0, Math.min(7, daily.length));
  let trendValue = seedWindow.reduce((sum, entry) => sum + entry.raw, 0) / seedWindow.length;
  const points: WeightSeriesPoint[] = daily.map((entry, index) => {
    if (index > 0) {
      trendValue += smoothingFactor * (entry.raw - trendValue);
    }
    const windowStart = entry.day - 6;
    const window = daily.filter((other) => other.day >= windowStart && other.day <= entry.day);
    const rollingAverage =
      window.length >= minimumCheckInsForAverage
        ? window.reduce((sum, other) => sum + other.raw, 0) / window.length
        : null;
    return { localDate: entry.localDate, raw: entry.raw, trend: trendValue, rollingAverage };
  });

  const weekMap = new Map<string, number[]>();
  for (const entry of daily) {
    const start = weekStartOf(entry.localDate);
    weekMap.set(start, [...(weekMap.get(start) ?? []), entry.raw]);
  }
  const weeks: WeightWeek[] = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, values]) => ({
      weekStart,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      low: Math.min(...values),
      high: Math.max(...values),
      checkInCount: values.length,
    }));

  const lastDay = daily.at(-1)!.day;
  const windowPoints = daily.filter((entry) => entry.day > lastDay - windowWeeks * 7);
  const spansEnoughTime = windowPoints.length
    ? lastDay - windowPoints[0]!.day >= 7
    : false;
  const ready = daily.length >= minimumCheckInsForTrend && spansEnoughTime;

  // The rate is fitted to the smoothed series rather than the raw one, so a
  // single unusual morning near the edge of the window cannot tilt it.
  const ratePerWeek = ready
    ? weeklySlope(
        points
          .filter((point) => toDayNumber(point.localDate) > lastDay - windowWeeks * 7)
          .map((point) => ({ day: toDayNumber(point.localDate), value: point.trend })),
      )
    : null;

  const direction: WeightDirection | null =
    ratePerWeek == null
      ? null
      : Math.abs(ratePerWeek) < steadyThreshold
        ? 'steady'
        : ratePerWeek > 0
          ? 'rising'
          : 'falling';

  const currentAverage = ready ? (points.at(-1)!.rollingAverage ?? null) : null;

  return {
    unit,
    points,
    weeks,
    sufficiency: ready ? 'ready' : 'establishing',
    currentAverage,
    latestCheckIn: latestCheckIn
      ? {
          localDate: latestCheckIn.localDate,
          weightValue: convertLoad(latestCheckIn.weightValue, latestCheckIn.weightUnit, unit),
          weightUnit: unit,
        }
      : null,
    ratePerWeek,
    direction,
    windowWeeks,
    checkInCount: daily.length,
  };
}

/**
 * How many more check-ins are needed before a trend can be shown, so the
 * empty state can be specific ("2 more check-ins") instead of vague.
 */
export function checkInsUntilTrend(
  trend: Pick<WeightTrend, 'checkInCount' | 'sufficiency'>,
  minimumCheckInsForTrend: number = DEFAULTS.minimumCheckInsForTrend,
): number {
  if (trend.sufficiency === 'ready') return 0;
  return Math.max(minimumCheckInsForTrend - trend.checkInCount, 1);
}

/**
 * Minimum check-ins a week needs before its average is worth comparing.
 * Two mornings is the point where an average stops being one reading with
 * extra steps; below it a "change" is mostly the noise of which day the
 * user happened to step on the scale.
 */
export const minimumCheckInsForWeekComparison = 2;

export interface WeekOverWeekChange {
  /** Signed difference in the display unit: current week minus previous. */
  change: number;
  current: WeightWeek;
  previous: WeightWeek;
}

/**
 * Change in weekly average against the immediately preceding week.
 *
 * `null` unless both weeks are adjacent and each holds enough check-ins to
 * have a meaningful average. A gap between them is not bridged: comparing
 * this week to a week three weeks back, labelled "vs previous week", would
 * attribute three weeks of drift to seven days. The result is unvalenced —
 * whether a gain or a loss is good depends on a goal this does not know.
 */
export function weekOverWeekChange(
  weeks: WeightWeek[],
  minimumCheckIns: number = minimumCheckInsForWeekComparison,
): WeekOverWeekChange | null {
  const current = weeks.at(-1);
  const previous = weeks.at(-2);
  if (!current || !previous) return null;
  if (
    current.checkInCount < minimumCheckIns ||
    previous.checkInCount < minimumCheckIns
  ) {
    return null;
  }
  // Adjacent ISO weeks are exactly seven days apart.
  const gapDays = toDayNumber(current.weekStart) - toDayNumber(previous.weekStart);
  if (gapDays !== 7) return null;
  return { change: current.average - previous.average, current, previous };
}
