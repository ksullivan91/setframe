import type { ProgressOverviewResponse } from '@setframe/schemas';
import type { SeriesPoint } from './chart-geometry';
import type { ProgressRange } from './progress-range';
import {
  buildProgressInsight,
  describeInsight,
  type InsightMetric,
  type ProgressInsight,
} from './progress-insight';

/**
 * Turns a `/progress/overview` payload into the insights the Progress screen
 * shows.
 *
 * This is the app-specific half of Story 51: `progress-insight.ts` holds the
 * metric-agnostic contract, and this file knows which fields of the overview
 * feed it, at what granularity, and when a metric is not yet entitled to make
 * a claim. Both platforms call it, so web and mobile cannot drift into
 * describing the same payload differently — the parity rule that the mobile
 * audit was written to enforce.
 *
 * Two gates are load-bearing:
 *
 *  - **Body weight waits for `sufficiency === 'ready'`.** The API already
 *    decides when there are enough check-ins to draw a trend, and stating a
 *    change in prose is a stronger claim than drawing it, not a weaker one.
 *    Re-deriving that threshold here would let the sentence contradict the
 *    chart directly above it.
 *  - **Training data is weekly**, so it is declared as such and compared
 *    whole-period rather than elapsed-matched. See `sourceGranularity`.
 */

/** One insight, ready to render. */
export interface OverviewInsight {
  metric: InsightMetric;
  /** Metric name for the UI. */
  label: string;
  /** The sentence to show. Only present insights reach the caller. */
  sentence: string;
  /** Full evidence, for a focus affordance or a future prompt-builder. */
  insight: ProgressInsight;
}

export interface OverviewInsightsOptions {
  endLocalDate: string;
  /**
   * Period to compare over. Defaults to the week, which is the span a user
   * actually acts on and the one the story's own example uses.
   */
  range?: ProgressRange;
}

const LABELS: Record<InsightMetric, string> = {
  body_weight: 'Body weight',
  training_frequency: 'Training',
  training_volume: 'Volume',
};

export function buildOverviewInsights(
  overview: ProgressOverviewResponse,
  options: OverviewInsightsOptions,
): OverviewInsight[] {
  const { endLocalDate, range = 'W' } = options;
  const results: OverviewInsight[] = [];

  function add(metric: InsightMetric, insight: ProgressInsight, unit?: string) {
    const sentence = describeInsight(insight, { unit });
    /* `describeInsight` returns null whenever the evidence cannot support a
       claim. That null is the feature — no insight is better than a
       meaningless one — so it is dropped here rather than substituted with
       filler copy. */
    if (sentence) results.push({ metric, label: LABELS[metric], sentence, insight });
  }

  const weeks = overview.training.weeks;

  const sessionSeries: SeriesPoint[] = weeks.map((week) => ({
    localDate: week.weekStart,
    value: week.completedCount,
  }));
  add(
    'training_frequency',
    buildProgressInsight(sessionSeries, {
      metric: 'training_frequency',
      range,
      endLocalDate,
      aggregation: 'sum',
      // A week with no completed sessions is genuinely zero sessions, not an
      // unknown — that missed week is exactly what the comparison is for.
      emptyIsZero: true,
      sourceGranularity: 'week',
    }),
  );

  const volumeSeries: SeriesPoint[] = weeks.map((week) => ({
    localDate: week.weekStart,
    value: week.volume,
  }));
  add(
    'training_volume',
    buildProgressInsight(volumeSeries, {
      metric: 'training_volume',
      range,
      endLocalDate,
      aggregation: 'sum',
      emptyIsZero: true,
      sourceGranularity: 'week',
    }),
  );

  const bodyWeight = overview.bodyWeight;
  if (bodyWeight.sufficiency === 'ready') {
    const weightSeries: SeriesPoint[] = bodyWeight.points.map((point) => ({
      localDate: point.localDate,
      value: point.raw,
    }));
    add(
      'body_weight',
      buildProgressInsight(weightSeries, {
        metric: 'body_weight',
        range,
        endLocalDate,
        aggregation: 'mean',
        // An unweighed stretch is unknown, never zero.
        emptyIsZero: false,
        sourceGranularity: 'day',
      }),
      bodyWeight.unit,
    );
  }

  return results;
}
