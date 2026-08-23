import { describe, expect, it } from 'vitest';
import {
  getProgressMetricKeys,
  isProgressMetricValid,
  primaryProgressMetric,
  progressMetricDefinitions,
  progressMetricsByPrescription,
  summarizeExerciseSets,
  type ProgressSet,
} from './progress-metrics';
import { selectablePrescriptionKinds } from './prescription-fields';
import { convertDistance, convertLoad, resolveLoadUnit } from './units';

function set(overrides: Partial<ProgressSet> = {}): ProgressSet {
  return {
    setType: 'working',
    completed: true,
    loadValue: null,
    loadUnit: null,
    reps: null,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    ...overrides,
  };
}

function strengthSet(loadValue: number, reps: number, overrides: Partial<ProgressSet> = {}): ProgressSet {
  return set({ loadValue, loadUnit: 'lb', reps, ...overrides });
}

function valueOf(results: ReturnType<typeof summarizeExerciseSets>, key: string): number | null | undefined {
  return results.find((result) => result.key === key)?.value;
}

describe('progress metric validity by prescription', () => {
  it('gives every selectable prescription kind at least one valid metric', () => {
    for (const kind of selectablePrescriptionKinds) {
      expect(progressMetricsByPrescription[kind].length).toBeGreaterThan(0);
    }
  });

  it('defines every metric referenced by a prescription', () => {
    for (const keys of Object.values(progressMetricsByPrescription)) {
      for (const key of keys) {
        expect(progressMetricDefinitions[key]).toBeDefined();
      }
    }
  });

  // The regression this whole module exists for: an Outdoor Cycle rendered
  // "0 lb est. 1RM / Top set 0 x 0 / volume 0 lb".
  it('never offers load metrics for a distance+duration activity', () => {
    const keys = getProgressMetricKeys('distanceDuration');
    expect(keys).not.toContain('estimatedOneRepMax');
    expect(keys).not.toContain('topSetLoad');
    expect(keys).not.toContain('loadVolume');
  });

  it('omits load metrics from a cycling summary entirely rather than zero-filling', () => {
    const cycle = [set({ setType: 'distance', distanceValue: 12.4, distanceUnit: 'mi', durationSeconds: 2700 })];
    const results = summarizeExerciseSets(cycle, 'distanceDuration');
    const keys = results.map((result) => result.key);
    expect(keys).not.toContain('estimatedOneRepMax');
    expect(keys).not.toContain('topSetLoad');
    expect(keys).not.toContain('loadVolume');
    expect(valueOf(results, 'totalDistance')).toBeCloseTo(12.4, 5);
  });

  it('never offers load or 1RM metrics for bodyweight reps', () => {
    const keys = getProgressMetricKeys('bodyweight_reps');
    expect(keys).toEqual(['topReps', 'totalReps']);
    expect(isProgressMetricValid('bodyweight_reps', 'loadVolume')).toBe(false);
  });

  it('offers duration metrics for timed and duration work and nothing load-based', () => {
    expect(getProgressMetricKeys('timed')).toEqual(['longestSetDuration', 'totalDuration']);
    expect(getProgressMetricKeys('duration')).toEqual(['totalDuration']);
  });

  it('offers distance metrics for a pure distance activity', () => {
    expect(getProgressMetricKeys('distance')).toEqual(['farthestDistance', 'totalDistance']);
  });

  it('keeps strength metrics working for every strength kind', () => {
    for (const kind of ['sets_reps', 'top_set_backoff', 'per_side'] as const) {
      expect(getProgressMetricKeys(kind)).toContain('estimatedOneRepMax');
      expect(getProgressMetricKeys(kind)).toContain('loadVolume');
    }
  });

  it('falls back to the permissive strength mapping for an unprescribed exercise', () => {
    expect(getProgressMetricKeys(null)).toContain('estimatedOneRepMax');
  });
});

describe('applicable-but-empty metrics', () => {
  it('returns null rather than 0 when a valid metric has no qualifying data', () => {
    const results = summarizeExerciseSets([set({ setType: 'working' })], 'sets_reps');
    expect(valueOf(results, 'estimatedOneRepMax')).toBeNull();
    expect(valueOf(results, 'loadVolume')).toBeNull();
    expect(valueOf(results, 'totalReps')).toBeNull();
  });

  it('returns null for an empty set list without throwing', () => {
    const results = summarizeExerciseSets([], 'sets_reps');
    expect(results.every((result) => result.value === null)).toBe(true);
  });

  it('reports no primary metric when the headline has no data', () => {
    expect(primaryProgressMetric([], 'sets_reps')?.value).toBeNull();
  });

  it('does not compute pace when only one of distance or duration was recorded', () => {
    const results = summarizeExerciseSets(
      [set({ setType: 'distance', distanceValue: 3, distanceUnit: 'mi' })],
      'distanceDuration',
    );
    expect(valueOf(results, 'averagePace')).toBeNull();
    expect(valueOf(results, 'totalDistance')).toBe(3);
  });
});

describe('capacity metrics exclude non-maximal sets', () => {
  it('ignores warm-ups when picking the heaviest set', () => {
    const sets = [
      strengthSet(300, 5, { setType: 'warmup' }),
      strengthSet(185, 5, { setType: 'working' }),
    ];
    expect(valueOf(summarizeExerciseSets(sets, 'sets_reps'), 'topSetLoad')).toBe(185);
  });

  it('ignores drop and failure sets when picking the heaviest set', () => {
    const sets = [
      strengthSet(225, 5, { setType: 'working' }),
      strengthSet(315, 1, { setType: 'failure' }),
      strengthSet(275, 3, { setType: 'drop' }),
    ];
    expect(valueOf(summarizeExerciseSets(sets, 'sets_reps'), 'topSetLoad')).toBe(225);
  });

  // Volume measures work done, so every completed set counts even though
  // those same sets are excluded from the capacity metrics above.
  it('still counts warm-up and drop sets toward cumulative volume', () => {
    const sets = [
      strengthSet(100, 10, { setType: 'warmup' }),
      strengthSet(200, 5, { setType: 'working' }),
      strengthSet(150, 8, { setType: 'drop' }),
    ];
    expect(valueOf(summarizeExerciseSets(sets, 'sets_reps'), 'loadVolume')).toBe(1000 + 1000 + 1200);
  });

  it('excludes uncompleted (program-seeded) sets from every metric', () => {
    const sets = [
      strengthSet(225, 5, { completed: true }),
      strengthSet(405, 5, { completed: false }),
    ];
    const results = summarizeExerciseSets(sets, 'sets_reps');
    expect(valueOf(results, 'topSetLoad')).toBe(225);
    expect(valueOf(results, 'loadVolume')).toBe(1125);
  });
});

describe('metric arithmetic', () => {
  it('estimates 1RM with Epley and picks the best-estimating set', () => {
    const sets = [strengthSet(225, 1), strengthSet(200, 5)];
    // 225 vs 200 * (1 + 5/30) = 233.33 -> the set of five wins.
    expect(valueOf(summarizeExerciseSets(sets, 'sets_reps'), 'estimatedOneRepMax')).toBeCloseTo(233.333, 3);
  });

  it('treats a single rep as its own 1RM', () => {
    expect(valueOf(summarizeExerciseSets([strengthSet(315, 1)], 'sets_reps'), 'estimatedOneRepMax')).toBe(315);
  });

  it('takes the longest hold rather than the total for a timed exercise', () => {
    const sets = [
      set({ setType: 'timed', durationSeconds: 45 }),
      set({ setType: 'timed', durationSeconds: 70 }),
    ];
    const results = summarizeExerciseSets(sets, 'timed');
    expect(valueOf(results, 'longestSetDuration')).toBe(70);
    expect(valueOf(results, 'totalDuration')).toBe(115);
  });

  it('takes the best single set and the total for bodyweight reps', () => {
    const sets = [set({ reps: 12 }), set({ reps: 9 }), set({ reps: 8 })];
    const results = summarizeExerciseSets(sets, 'bodyweight_reps');
    expect(valueOf(results, 'topReps')).toBe(12);
    expect(valueOf(results, 'totalReps')).toBe(29);
  });

  it('computes pace as seconds per distance unit from paired sets only', () => {
    const sets = [
      set({ setType: 'distance', distanceValue: 2, distanceUnit: 'mi', durationSeconds: 1200 }),
      set({ setType: 'distance', distanceValue: 1, distanceUnit: 'mi', durationSeconds: 600 }),
      // No timer, so it must not dilute the pace.
      set({ setType: 'distance', distanceValue: 5, distanceUnit: 'mi' }),
    ];
    const results = summarizeExerciseSets(sets, 'distanceDuration');
    expect(valueOf(results, 'averagePace')).toBe(1800 / 3);
    expect(valueOf(results, 'totalDistance')).toBe(8);
  });
});

describe('mixed units', () => {
  it('normalises a mixed lb/kg history instead of summing raw numbers', () => {
    const sets = [
      set({ loadValue: 100, loadUnit: 'lb', reps: 5 }),
      set({ loadValue: 100, loadUnit: 'kg', reps: 5 }),
    ];
    const results = summarizeExerciseSets(sets, 'sets_reps', { preferredLoadUnit: 'lb' });
    // 100 kg is ~220.46 lb, so the heaviest set must not be reported as 100.
    expect(valueOf(results, 'topSetLoad')).toBeCloseTo(220.462, 2);
    expect(results.find((result) => result.key === 'topSetLoad')?.loadUnit).toBe('lb');
  });

  it('keeps the user own unit when the history is unmixed', () => {
    const results = summarizeExerciseSets([set({ loadValue: 60, loadUnit: 'kg', reps: 5 })], 'sets_reps');
    expect(results.find((result) => result.key === 'topSetLoad')?.loadUnit).toBe('kg');
    expect(valueOf(results, 'topSetLoad')).toBe(60);
  });

  it('normalises mixed distance units', () => {
    const sets = [
      set({ setType: 'distance', distanceValue: 1, distanceUnit: 'mi' }),
      set({ setType: 'distance', distanceValue: 1609.344, distanceUnit: 'm' }),
    ];
    const results = summarizeExerciseSets(sets, 'distance', { preferredDistanceUnit: 'mi' });
    expect(valueOf(results, 'totalDistance')).toBeCloseTo(2, 6);
  });
});

describe('unit conversion', () => {
  it('round-trips load conversions', () => {
    expect(convertLoad(convertLoad(225, 'lb', 'kg'), 'kg', 'lb')).toBeCloseTo(225, 9);
  });

  it('round-trips distance conversions', () => {
    expect(convertDistance(convertDistance(5, 'mi', 'm'), 'm', 'mi')).toBeCloseTo(5, 9);
    expect(convertDistance(1, 'km', 'm')).toBe(1000);
  });

  it('falls back to the preferred unit only when units are genuinely mixed', () => {
    expect(resolveLoadUnit(['kg', 'kg'], 'lb')).toBe('kg');
    expect(resolveLoadUnit(['kg', 'lb'], 'lb')).toBe('lb');
    expect(resolveLoadUnit([], 'lb')).toBe('lb');
  });
});
