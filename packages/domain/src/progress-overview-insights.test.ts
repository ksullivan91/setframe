import { describe, expect, it } from 'vitest';
import type { ProgressOverviewResponse } from '@setframe/schemas';
import { buildOverviewInsights } from './progress-overview-insights';

/** A Tuesday, so the current week is genuinely partial. */
const TUESDAY = '2026-08-25';
/** Still a partial week, but far enough in for an average to mean something. */
const FRIDAY = '2026-08-28';

const WEIGHT_POINTS = [
  { localDate: '2026-08-17', raw: 170, trend: 170, rollingAverage: 170 },
  { localDate: '2026-08-18', raw: 169.6, trend: 169.8, rollingAverage: 169.8 },
  { localDate: '2026-08-19', raw: 169.4, trend: 169.6, rollingAverage: 169.6 },
  { localDate: '2026-08-24', raw: 168, trend: 168.4, rollingAverage: 168.4 },
  { localDate: '2026-08-25', raw: 167.8, trend: 168.1, rollingAverage: 168.1 },
  { localDate: '2026-08-27', raw: 167.9, trend: 168, rollingAverage: 168 },
];

function overview(patch: {
  weeks?: Array<{ weekStart: string; completedCount: number; volume: number | null }>;
  bodyWeight?: Partial<ProgressOverviewResponse['bodyWeight']>;
}): ProgressOverviewResponse {
  const weeks = (patch.weeks ?? []).map((week) => ({
    weekStart: week.weekStart,
    completedCount: week.completedCount,
    volume: week.volume,
    isCurrent: false,
    isRestWeek: false,
    plannedCount: 0,
  }));
  return {
    training: { weeks },
    bodyWeight: {
      unit: 'lb',
      sufficiency: 'none',
      checkInCount: 0,
      currentAverage: null,
      latestCheckIn: null,
      ratePerWeek: null,
      direction: null,
      windowWeeks: 12,
      points: [],
      weeks: [],
      ...patch.bodyWeight,
    },
    exercises: [],
    recentSessions: [],
  } as unknown as ProgressOverviewResponse;
}

describe('buildOverviewInsights', () => {
  it('compares this week against last week for training frequency', () => {
    const result = buildOverviewInsights(
      overview({
        weeks: [
          { weekStart: '2026-08-17', completedCount: 3, volume: 12000 },
          { weekStart: '2026-08-24', completedCount: 2, volume: 8000 },
        ],
      }),
      { endLocalDate: TUESDAY },
    );

    const frequency = result.find((item) => item.metric === 'training_frequency');
    expect(frequency?.sentence).toBe('2 sessions so far, compared with 3 last week.');
  });

  /**
   * The story names this as the failure mode to avoid: an "insight" that
   * restates the number already printed above the chart. With one week of
   * data there is nothing to compare against, so nothing should be said.
   */
  it('says nothing when there is no previous period to compare against', () => {
    const result = buildOverviewInsights(
      overview({ weeks: [{ weekStart: '2026-08-24', completedCount: 2, volume: 8000 }] }),
      { endLocalDate: TUESDAY },
    );

    expect(result).toEqual([]);
  });

  /**
   * Stating a change in prose is a stronger claim than drawing it, so the
   * sentence must not appear before the chart's own sufficiency gate opens —
   * otherwise the copy contradicts the chart directly above it.
   */
  it('withholds body weight until the API reports sufficiency', () => {
    const establishing = buildOverviewInsights(
      overview({ bodyWeight: { sufficiency: 'establishing', points: WEIGHT_POINTS, checkInCount: 6 } }),
      { endLocalDate: FRIDAY },
    );
    expect(establishing.some((item) => item.metric === 'body_weight')).toBe(false);

    const ready = buildOverviewInsights(
      overview({ bodyWeight: { sufficiency: 'ready', points: WEIGHT_POINTS, checkInCount: 6 } }),
      { endLocalDate: FRIDAY },
    );
    const weight = ready.find((item) => item.metric === 'body_weight');
    expect(weight?.sentence).toContain('lb');
    // Unvalenced: direction is reported, never praised or warned about.
    expect(weight?.sentence).toMatch(/below|above|unchanged/);
    expect(weight?.sentence).not.toMatch(/great|good|bad|keep it up|on track/i);
  });

  /**
   * Two days of morning weight is water and gut content, not a week's
   * average — and printing "your 2-day average" beside the 7-day average
   * shown elsewhere on the screen invites comparing two different things.
   * The sentence waits until the week is half over. Training does not: a
   * partial session count is a real count.
   */
  it('waits until mid-week before averaging body weight, but not before counting sessions', () => {
    const payload = overview({
      weeks: [
        { weekStart: '2026-08-17', completedCount: 3, volume: 12000 },
        { weekStart: '2026-08-24', completedCount: 2, volume: 8000 },
      ],
      bodyWeight: { sufficiency: 'ready', points: WEIGHT_POINTS, checkInCount: 6 },
    });

    const earlyWeek = buildOverviewInsights(payload, { endLocalDate: TUESDAY });
    expect(earlyWeek.map((item) => item.metric)).not.toContain('body_weight');
    expect(earlyWeek.map((item) => item.metric)).toContain('training_frequency');

    const midWeek = buildOverviewInsights(payload, { endLocalDate: FRIDAY });
    expect(midWeek.map((item) => item.metric)).toContain('body_weight');
  });

  it('carries the supporting chart and period on every insight', () => {
    const result = buildOverviewInsights(
      overview({
        weeks: [
          { weekStart: '2026-08-17', completedCount: 3, volume: 12000 },
          { weekStart: '2026-08-24', completedCount: 2, volume: 8000 },
        ],
      }),
      { endLocalDate: TUESDAY, range: 'W' },
    );

    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.insight.focus).toEqual({ metric: item.metric, range: 'W' });
    }
  });
});
