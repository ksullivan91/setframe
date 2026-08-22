import { describe, expect, it } from 'vitest';
import { estimateOneRepMax } from './one-rep-max';
import { calculateVolume } from './volume';
import { detectWeightPR, detectRepPR } from './pr-detection';
import { restoreExerciseOrder } from './exercise-ordering';

describe('estimateOneRepMax', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(225, 1)).toBe(225);
  });

  it('applies the Epley formula for multiple reps', () => {
    expect(estimateOneRepMax(225, 5)).toBeCloseTo(262.5);
  });

  it('returns 0 for invalid input', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(225, 0)).toBe(0);
  });
});

describe('calculateVolume', () => {
  it('sums weight × reps across sets', () => {
    expect(
      calculateVolume([
        { weightValue: 100, reps: 10 },
        { weightValue: 100, reps: 8 },
      ]),
    ).toBe(1800);
  });

  it('ignores sets with no weight/reps', () => {
    expect(calculateVolume([{ weightValue: null, reps: null }])).toBe(0);
  });
});

describe('PR detection', () => {
  const history = [
    { weightValue: 185, reps: 5 },
    { weightValue: 205, reps: 3 },
  ];

  it('detects a new weight PR', () => {
    expect(detectWeightPR({ weightValue: 215, reps: 2 }, history)).toBe(true);
    expect(detectWeightPR({ weightValue: 200, reps: 5 }, history)).toBe(false);
  });

  it('detects a new rep PR at or above prior weight', () => {
    expect(detectRepPR({ weightValue: 205, reps: 4 }, history)).toBe(true);
    expect(detectRepPR({ weightValue: 205, reps: 3 }, history)).toBe(false);
    expect(detectRepPR({ weightValue: 185, reps: 10 }, history)).toBe(true);
  });
});

describe('restoreExerciseOrder', () => {
  it('puts a restored exercise back in its original slot', () => {
    // B was removed from [A, B, C] and re-created as B2 (appended).
    expect(
      restoreExerciseOrder({ currentIds: ['A', 'C', 'B2'], restoredId: 'B2', originalIndex: 1 }),
    ).toEqual(['A', 'B2', 'C']);
  });

  it('stays set-identical to the live list when other exercises changed meanwhile', () => {
    // D was added after B's removal; replaying the pre-delete snapshot
    // would have produced [A, B2, C] and been rejected by the API.
    const result = restoreExerciseOrder({
      currentIds: ['A', 'C', 'D', 'B2'],
      restoredId: 'B2',
      originalIndex: 1,
    });

    expect(result).toEqual(['A', 'B2', 'C', 'D']);
    expect([...result].sort()).toEqual(['A', 'B2', 'C', 'D']);
  });

  it('clamps an out-of-range original index instead of dropping the exercise', () => {
    expect(restoreExerciseOrder({ currentIds: ['A', 'B2'], restoredId: 'B2', originalIndex: 9 })).toEqual(['A', 'B2']);
    expect(restoreExerciseOrder({ currentIds: ['A', 'B2'], restoredId: 'B2', originalIndex: -1 })).toEqual(['B2', 'A']);
  });

  it('handles restoring the only exercise in a workout', () => {
    expect(restoreExerciseOrder({ currentIds: ['B2'], restoredId: 'B2', originalIndex: 0 })).toEqual(['B2']);
  });
});
