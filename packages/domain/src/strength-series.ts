/**
 * Turning the Progress payload's per-exercise history into strength series.
 *
 * Lives here rather than in either renderer so web and mobile cannot disagree
 * about which lifts qualify, which metric is plotted, or how few sessions is
 * too few — the decisions most likely to drift if each platform made them.
 */

import { progressMetricDefinitions, type ProgressMetricKey } from './progress-metrics';
import type { LiftSeries } from './chart/small-multiples';

export interface StrengthSourcePoint {
  localDate: string;
  metrics: readonly { key: string; value: number | null; loadUnit?: 'lb' | 'kg' }[];
  isWeightPr: boolean;
  isRepPr: boolean;
}

export interface StrengthSourceExercise {
  exerciseId: string;
  exerciseName: string;
  metricKeys: readonly string[];
  points: readonly StrengthSourcePoint[];
}

export interface StrengthSeriesResult {
  lifts: LiftSeries[];
  /** Lifts with history but too few sessions to plot, so the UI can say so. */
  pending: { id: string; name: string; sessionCount: number; needed: number }[];
  /** The metric being plotted, for labelling. */
  metricKey: ProgressMetricKey;
}

/**
 * The metric strength panels plot.
 *
 * Estimated 1RM rather than heaviest set: top-set load ignores reps, so a
 * heavy single and a heavy set of five read identically and a genuine
 * improvement in rep quality shows as a flat line.
 */
export const strengthMetricKey: ProgressMetricKey = 'estimatedOneRepMax';

/**
 * Builds one series per lift that has enough history for the plotted metric.
 *
 * The session floor comes from the metric's own `minimumSessionsForTrend`
 * (3 for estimated 1RM), not from a number chosen here. That definition
 * exists because e1RM is an estimate whose own stated limitation is "treat
 * small changes as noise" — two points joined by a line is not a trend, it is
 * two observations and an implication we have no basis for.
 */
export function buildStrengthSeries(
  exercises: readonly StrengthSourceExercise[],
  options: { metricKey?: ProgressMetricKey } = {},
): StrengthSeriesResult {
  const metricKey = options.metricKey ?? strengthMetricKey;
  const needed = progressMetricDefinitions[metricKey].minimumSessionsForTrend;

  const lifts: LiftSeries[] = [];
  const pending: StrengthSeriesResult['pending'] = [];

  for (const exercise of exercises) {
    // Only lifts for which this metric is defined at all. A bodyweight or
    // cardio exercise has no 1RM, and inventing one for it would be a
    // category error, not a missing value.
    if (!exercise.metricKeys.includes(metricKey)) continue;

    const points = exercise.points.flatMap((point) => {
      const metric = point.metrics.find((entry) => entry.key === metricKey);
      if (!metric || metric.value == null) return [];
      return [
        {
          localDate: point.localDate,
          value: metric.value,
          isPr: point.isWeightPr || point.isRepPr,
        },
      ];
    });

    if (points.length >= needed) {
      lifts.push({ id: exercise.exerciseId, name: exercise.exerciseName, points });
    } else if (points.length > 0) {
      pending.push({
        id: exercise.exerciseId,
        name: exercise.exerciseName,
        sessionCount: points.length,
        needed,
      });
    }
  }

  // Most sessions first, so the lifts the user actually trains lead. The
  // chart layer re-sorts by how much each moved; this ordering only decides
  // which lifts survive a `slice`.
  lifts.sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
  pending.sort((a, b) => b.sessionCount - a.sessionCount || a.name.localeCompare(b.name));

  return { lifts, pending, metricKey };
}

/**
 * Sentence describing what is still needed before panels can be drawn.
 * Returns null when there is nothing pending worth mentioning.
 */
export function describeStrengthPending(
  pending: StrengthSeriesResult['pending'],
): string | null {
  if (!pending.length) return null;
  const needed = pending[0]?.needed ?? 3;
  if (pending.length === 1) {
    const only = pending[0]!;
    const remaining = needed - only.sessionCount;
    return `${only.name} needs ${remaining} more session${remaining === 1 ? '' : 's'} before its trend is worth drawing.`;
  }
  return `${pending.length} more lifts need at least ${needed} sessions each before their trends are worth drawing.`;
}
