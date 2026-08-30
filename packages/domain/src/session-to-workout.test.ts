import { describe, expect, it } from 'vitest';
import {
  describeDerivedExercise,
  deriveWorkoutFromSession,
  modalReps,
  type PerformedSet,
} from './session-to-workout';

const set = (reps: number | null, over: Partial<PerformedSet> = {}): PerformedSet => ({
  setType: 'working',
  reps,
  weightValue: 225,
  ...over,
});

describe('modalReps', () => {
  it('takes the most common rep count, not the mean', () => {
    /* 8, 8, 5 averages to 7 — a number nobody performed. */
    expect(modalReps([set(8), set(8), set(5)])).toBe(8);
  });

  it('does not let one good set become a standing target', () => {
    expect(modalReps([set(5), set(5), set(12)])).toBe(5);
  });

  it('breaks a tie upward rather than rounding effort down', () => {
    expect(modalReps([set(8), set(10)])).toBe(10);
  });

  it('ignores warm-ups, which are not the working intent', () => {
    /* Nobody wants "5 × 8" on a template because they ramped up to it. */
    expect(modalReps([set(12, { setType: 'warmup' }), set(5), set(5)])).toBe(5);
  });

  it('ignores sets that were never performed', () => {
    expect(modalReps([set(8, { completed: false }), set(5), set(5)])).toBe(5);
  });

  it('is undefined when nothing qualifies', () => {
    expect(modalReps([])).toBeUndefined();
    expect(modalReps([set(null)])).toBeUndefined();
  });
});

describe('deriveWorkoutFromSession', () => {
  it('counts working sets and carries the modal reps', () => {
    const derived = deriveWorkoutFromSession([
      { exerciseId: 'a', sets: [set(8), set(8), set(8)] },
    ]);
    expect(derived).toEqual([
      { exerciseId: 'a', sortOrder: 0, prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 } },
    ]);
  });

  it('never carries weight into the target', () => {
    /* A target weight copied from one good day becomes a stale number you
       fight with for weeks. */
    const derived = deriveWorkoutFromSession([{ exerciseId: 'a', sets: [set(8)] }]);
    expect(derived[0]!.prescription).not.toHaveProperty('weightValue');
    expect(JSON.stringify(derived)).not.toContain('225');
  });

  it('excludes warm-ups from the set count', () => {
    const derived = deriveWorkoutFromSession([
      { exerciseId: 'a', sets: [set(12, { setType: 'warmup' }), set(8), set(8)] },
    ]);
    expect(derived[0]!.prescription.sets).toBe(2);
  });

  it('drops an exercise that was opened but never performed', () => {
    /* Putting it in the template would quietly prescribe something skipped. */
    const derived = deriveWorkoutFromSession([
      { exerciseId: 'a', sets: [set(8)] },
      { exerciseId: 'b', sets: [set(null)] },
      { exerciseId: 'c', sets: [] },
    ]);
    expect(derived.map((d) => d.exerciseId)).toEqual(['a']);
  });

  it('renumbers sortOrder after a drop, leaving no gap', () => {
    const derived = deriveWorkoutFromSession([
      { exerciseId: 'a', sets: [set(8)] },
      { exerciseId: 'skipped', sets: [] },
      { exerciseId: 'c', sets: [set(10)] },
    ]);
    expect(derived.map((d) => d.sortOrder)).toEqual([0, 1]);
  });

  it('omits a rep target when the sets carry no reps', () => {
    const derived = deriveWorkoutFromSession([
      { exerciseId: 'a', sets: [set(null, { setType: 'working' }), set(null)] },
    ]);
    expect(derived).toEqual([]);
  });
});

describe('describeDerivedExercise', () => {
  it('says where the number came from', () => {
    expect(
      describeDerivedExercise({
        exerciseId: 'a',
        sortOrder: 0,
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 10 },
      }),
    ).toBe('3 × 10 — from what you did');
  });

  it('falls back to a set count with no rep target', () => {
    expect(
      describeDerivedExercise({
        exerciseId: 'a',
        sortOrder: 0,
        prescription: { kind: 'sets_reps', sets: 4 },
      }),
    ).toBe('4 sets — from what you did');
  });
});
