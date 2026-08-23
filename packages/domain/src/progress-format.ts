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
