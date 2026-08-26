import {
  progressMetricDefinitions,
  type ProgressMetricKey,
  type ProgressMetricValue,
} from './progress-metrics';
import type { DistanceUnit, LoadUnit } from './units';

/**
 * Display formatting for progress metrics, shared by web and mobile so the
 * same number never renders two different ways.
 *
 * Precision is deliberately coarse. An estimated 1RM carries real
 * uncertainty, so printing "233.33 lb" claims an accuracy the Epley formula
 * does not have; it is rounded to the nearest 5. Showing more digits than
 * the measurement supports is a small dishonesty that makes users chase
 * noise.
 */

function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return minuteRemainder ? `${hours}h ${minuteRemainder}m` : `${hours}h`;
}

/** Rounds to the nearest `step`, for metrics with real uncertainty. */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface FormatMetricOptions {
  loadUnit?: LoadUnit;
  distanceUnit?: DistanceUnit;
  /** Omit the unit suffix, e.g. for a chart axis that labels the unit once. */
  compact?: boolean;
}

export function formatMetricValue(
  key: ProgressMetricKey,
  value: number | null,
  options: FormatMetricOptions = {},
): string | null {
  if (value == null) return null;
  const loadUnit = options.loadUnit ?? 'lb';
  const distanceUnit = options.distanceUnit ?? 'mi';
  const suffix = (unit: string) => (options.compact ? '' : ` ${unit}`);

  switch (key) {
    case 'estimatedOneRepMax':
    case 'topSetLoad':
      // Rounded to 5 because the estimate is not precise to the pound.
      return `${roundTo(value, 5).toLocaleString()}${suffix(loadUnit)}`;
    case 'loadVolume':
      return `${Math.round(value).toLocaleString()}${suffix(loadUnit)}`;
    case 'topReps':
    case 'totalReps':
      return `${Math.round(value).toLocaleString()}${options.compact ? '' : ' reps'}`;
    case 'longestSetDuration':
    case 'totalDuration':
      return formatDuration(value);
    case 'farthestDistance':
    case 'totalDistance':
      return `${value.toFixed(value < 10 ? 2 : 1)}${suffix(distanceUnit)}`;
    case 'averagePace': {
      // Stored as seconds per distance unit; shown as mm:ss/unit, which is
      // how runners and cyclists actually talk about pace.
      const totalSeconds = Math.round(value);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${String(seconds).padStart(2, '0')}${options.compact ? '' : `/${distanceUnit}`}`;
    }
  }
}

export function formatProgressMetric(
  metric: ProgressMetricValue,
  options: FormatMetricOptions = {},
): string | null {
  return formatMetricValue(metric.key as ProgressMetricKey, metric.value, {
    ...options,
    loadUnit: metric.loadUnit ?? options.loadUnit,
    distanceUnit: metric.distanceUnit ?? options.distanceUnit,
  });
}

export function metricLabel(key: string): string {
  return progressMetricDefinitions[key as ProgressMetricKey]?.label ?? key;
}

export function metricShortLabel(key: string): string {
  return progressMetricDefinitions[key as ProgressMetricKey]?.shortLabel ?? key;
}

export function metricDefinition(key: string) {
  return progressMetricDefinitions[key as ProgressMetricKey] ?? null;
}

/**
 * Story 31 — a chart's active period must be stated explicitly rather than
 * left for the user to infer from axis ticks, and a summary statistic must
 * describe the same visible span as the chart beneath it. These two
 * formatters are the single place that turns a date span into that label,
 * so every chart phrases "the period you are looking at" identically.
 */

function monthName(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' });
}

/** Sunday of a Monday-anchored week, as a `YYYY-MM-DD` string. */
export function weekEndDate(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00`);
  end.setDate(end.getDate() + 6);
  return toLocalDateString(end);
}

/** Monday–Sunday range for a week-start date, e.g. "Aug 18–24" or, across
 * a month boundary, "Aug 31 – Sep 6". Setframe's one documented week-start
 * rule is Monday (see `isoWeekStart`/`weekStartOf` in training-trends.ts
 * and weight-trend.ts) — every weekly aggregation in the product already
 * agrees on this; this formatter just makes the boundary visible in copy. */
export function formatWeekRange(weekStart: string): string {
  return formatDateRangeLabel(weekStart, weekEndDate(weekStart));
}

/**
 * Explicit date-range label for an arbitrary span.
 *
 * Spans of roughly a month or less stay day-precise even across a
 * month/year boundary ("Aug 31 – Sep 6") — collapsing day numbers on a
 * week-scale range would hide exactly the boundary dates a user most wants
 * confirmed. Longer spans collapse to month-level granularity ("Mar–Aug"),
 * spelling the year on each end only when the range crosses a year
 * ("Dec 2025 – Feb 2026").
 */
export function formatDateRangeLabel(startLocalDate: string, endLocalDate: string): string {
  const start = new Date(`${startLocalDate}T12:00:00`);
  const end = new Date(`${endLocalDate}T12:00:00`);
  if (startLocalDate === endLocalDate) return `${monthName(start)} ${start.getDate()}`;

  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (spanDays <= 31) {
    if (sameMonth) return `${monthName(start)} ${start.getDate()}–${end.getDate()}`;
    const startLabel = `${monthName(start)} ${start.getDate()}`;
    const endLabel = sameYear
      ? `${monthName(end)} ${end.getDate()}`
      : `${monthName(end)} ${end.getDate()}, ${end.getFullYear()}`;
    return `${startLabel} – ${endLabel}`;
  }

  if (sameYear) return `${monthName(start)}–${monthName(end)}`;
  return `${monthName(start)} ${start.getFullYear()} – ${monthName(end)} ${end.getFullYear()}`;
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Neutral, unvalenced description of a body-weight trend.
 *
 * No "good"/"bad", no "up"/"down is progress", and never a day-over-day
 * figure. A user who is intentionally bulking is succeeding when the number
 * rises, and the app does not know their intent, so it does not judge.
 */
export function describeWeightRate(
  ratePerWeek: number | null,
  direction: 'rising' | 'falling' | 'steady' | null,
  unit: LoadUnit,
  windowWeeks: number,
): string | null {
  if (ratePerWeek == null || direction == null) return null;
  if (direction === 'steady') {
    return `Holding steady over the past ${windowWeeks} weeks`;
  }
  const magnitude = Math.abs(ratePerWeek).toFixed(1);
  const word = direction === 'rising' ? 'up' : 'down';
  return `Trending ${word} about ${magnitude} ${unit} a week over the past ${windowWeeks} weeks`;
}

/**
 * Short number for an axis tick: `10k`, `12.4k`, `1.2M`.
 *
 * Only ever used where a full number does not fit — a volume tick reading
 * `12,420 lb` overlaps its neighbour at 390px. The exact figure is always
 * still available by selecting the mark, so this abbreviates a label, never
 * the value itself.
 */
export function formatCompactNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number(millions.toFixed(magnitude >= 10_000_000 ? 0 : 1))}M`;
  }
  if (magnitude >= 1_000) {
    const thousands = value / 1_000;
    return `${Number(thousands.toFixed(magnitude >= 10_000 ? 0 : 1))}k`;
  }
  return `${Math.round(value)}`;
}
