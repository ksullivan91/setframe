import { describe, expect, it } from 'vitest';
import {
  buildStrengthSeries,
  describeStrengthPending,
  type StrengthSourceExercise,
} from './strength-series';

function exercise(
  id: string,
  name: string,
  values: (number | null)[],
  options: { metricKeys?: string[]; prAt?: number[] } = {},
): StrengthSourceExercise {
  return {
    exerciseId: id,
    exerciseName: name,
    metricKeys: options.metricKeys ?? ['estimatedOneRepMax', 'topSetLoad'],
    points: values.map((value, index) => ({
      localDate: `2026-0${index + 1}-05`,
      metrics: [{ key: 'estimatedOneRepMax', value, loadUnit: 'lb' as const }],
      isWeightPr: options.prAt?.includes(index) ?? false,
      isRepPr: false,
    })),
  };
}

describe('buildStrengthSeries', () => {
  it('plots a lift with enough sessions', () => {
    const result = buildStrengthSeries([exercise('a', 'Back Squat', [300, 310, 320])]);
    expect(result.lifts).toHaveLength(1);
    expect(result.lifts[0]!.points.map((p) => p.value)).toEqual([300, 310, 320]);
  });

  it('withholds a lift below the metric\'s own session floor', () => {
    // e1RM declares minimumSessionsForTrend: 3. Two points joined by a line
    // is two observations and an implication we cannot support.
    const result = buildStrengthSeries([exercise('a', 'Back Squat', [300, 310])]);
    expect(result.lifts).toHaveLength(0);
    expect(result.pending).toEqual([
      { id: 'a', name: 'Back Squat', sessionCount: 2, needed: 3 },
    ]);
  });

  it('skips exercises for which the metric is undefined, not merely missing', () => {
    // A bodyweight exercise has no 1RM. That is a category error, not a gap.
    const result = buildStrengthSeries([
      exercise('a', 'Pull-up', [10, 11, 12], { metricKeys: ['topReps', 'totalReps'] }),
    ]);
    expect(result.lifts).toHaveLength(0);
    expect(result.pending).toHaveLength(0);
  });

  it('drops sessions with no value rather than plotting a zero', () => {
    const result = buildStrengthSeries([exercise('a', 'Back Squat', [300, null, 320, 330])]);
    expect(result.lifts[0]!.points).toHaveLength(3);
    expect(result.lifts[0]!.points.some((p) => p.value === 0)).toBe(false);
  });

  it('counts only sessions with a value toward the floor', () => {
    // Three sessions, one of them empty: two real observations, so pending.
    const result = buildStrengthSeries([exercise('a', 'Back Squat', [300, null, 320])]);
    expect(result.lifts).toHaveLength(0);
    expect(result.pending[0]!.sessionCount).toBe(2);
  });

  it('carries personal records through to the annotation layer', () => {
    const result = buildStrengthSeries([
      exercise('a', 'Back Squat', [300, 310, 320], { prAt: [1, 2] }),
    ]);
    expect(result.lifts[0]!.points.map((p) => p.isPr)).toEqual([false, true, true]);
  });

  it('treats a rep PR as a personal record too', () => {
    const source: StrengthSourceExercise = {
      exerciseId: 'a',
      exerciseName: 'Bench',
      metricKeys: ['estimatedOneRepMax'],
      points: [0, 1, 2].map((index) => ({
        localDate: `2026-0${index + 1}-05`,
        metrics: [{ key: 'estimatedOneRepMax', value: 200 + index }],
        isWeightPr: false,
        isRepPr: index === 2,
      })),
    };
    expect(buildStrengthSeries([source]).lifts[0]!.points.at(-1)!.isPr).toBe(true);
  });

  it('orders lifts by how often they are trained', () => {
    const result = buildStrengthSeries([
      exercise('a', 'Rare Lift', [100, 110, 120]),
      exercise('b', 'Frequent Lift', [200, 210, 220, 230, 240]),
    ]);
    expect(result.lifts.map((lift) => lift.id)).toEqual(['b', 'a']);
  });
});

describe('describeStrengthPending', () => {
  it('says nothing when nothing is pending', () => {
    expect(describeStrengthPending([])).toBeNull();
  });

  it('names a single lift and how many sessions remain', () => {
    expect(
      describeStrengthPending([{ id: 'a', name: 'Back Squat', sessionCount: 2, needed: 3 }]),
    ).toBe('Back Squat needs 1 more session before its trend is worth drawing.');
  });

  it('summarises several without listing them all', () => {
    expect(
      describeStrengthPending([
        { id: 'a', name: 'A', sessionCount: 2, needed: 3 },
        { id: 'b', name: 'B', sessionCount: 1, needed: 3 },
      ]),
    ).toBe('2 more lifts need at least 3 sessions each before their trends are worth drawing.');
  });
});
