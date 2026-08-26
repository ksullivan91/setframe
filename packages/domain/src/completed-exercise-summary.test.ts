import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import { summarizeCompletedExercise } from './prescription-summary';

const setsReps: Prescription = { kind: 'sets_reps', sets: 3, repsMin: 8 };
const distanceDuration: Prescription = {
  kind: 'distanceDuration',
  distanceMiles: 3,
  durationMinutes: 30,
};

const set = (over: Record<string, unknown> = {}) => ({
  setType: 'working',
  weightValue: 135,
  weightUnit: 'lb' as const,
  reps: 8,
  durationSeconds: null,
  distanceValue: null,
  distanceUnit: null,
  rpe: null,
  ...over,
});

describe('summarizeCompletedExercise', () => {
  it('collapses uniform sets to one figure', () => {
    /* Formatted by the shared `formatSessionSet`, so the collapsed summary
       reads exactly as a set does everywhere else in the product rather than
       inventing a second notation. */
    expect(summarizeCompletedExercise(setsReps, [set(), set(), set()])).toBe(
      '3 sets · 135lb · 8 reps',
    );
  });

  it('says "set" for a single set', () => {
    expect(summarizeCompletedExercise(setsReps, [set()])).toBe('1 set · 135lb · 8 reps');
  });

  it('names the range when sets differ, rather than picking a winner', () => {
    /* Reporting `135 lb × 8` for an exercise whose last set dropped to 6
       would overstate it, and averaging would invent a set that never
       happened. */
    const summary = summarizeCompletedExercise(setsReps, [set(), set(), set({ reps: 6 })]);
    expect(summary).toBe('3 sets · 135lb · 8 reps → 135lb · 6 reps');
  });

  it('is representation-aware, not forced into weight × reps', () => {
    const run = set({ weightValue: null, reps: null, distanceValue: 3, distanceUnit: 'mi', durationSeconds: 1800 });
    expect(summarizeCompletedExercise(distanceDuration, [run])).toContain('1 set');
    expect(summarizeCompletedExercise(distanceDuration, [run])).not.toContain('lb');
  });

  it('is null when there is nothing to summarise', () => {
    expect(summarizeCompletedExercise(setsReps, [])).toBeNull();
  });

  it('does not dump every set into the collapsed line', () => {
    // The point of collapsing is that detail is on demand, not always shown.
    const summary = summarizeCompletedExercise(setsReps, [set(), set(), set(), set(), set()])!;
    expect(summary).toBe('5 sets · 135lb · 8 reps');
    expect(summary.length).toBeLessThan(40);
  });
});
