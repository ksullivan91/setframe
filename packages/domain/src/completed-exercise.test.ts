import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import {
  buildCompletedExerciseReadout,
  compareWithPreviousSession,
  completedExerciseMetrics,
  completedSetCountLabel,
  formatCompletedDuration,
  type CompletedExerciseSet,
} from './completed-exercise';

const setsReps: Prescription = { kind: 'sets_reps', sets: 3, repsMin: 8 };
const bodyweight: Prescription = { kind: 'bodyweight_reps', sets: 3, repsMin: 10 };
const timed: Prescription = { kind: 'timed', sets: 3, durationSeconds: 45 };
const duration: Prescription = { kind: 'duration', durationMinutes: 20 };
const distanceDuration: Prescription = { kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 };

function set(over: Partial<CompletedExerciseSet> = {}): CompletedExerciseSet {
  return {
    setType: 'working',
    weightValue: 135,
    weightUnit: 'lb',
    reps: 8,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    rpe: null,
    ...over,
  };
}

const metricValue = (metrics: ReturnType<typeof completedExerciseMetrics>, key: string) =>
  metrics.find((metric) => metric.key === key)?.value;

describe('completedExerciseMetrics', () => {
  it('leads a strength exercise with its top set and volume', () => {
    const metrics = completedExerciseMetrics(setsReps, [
      set({ weightValue: 135, reps: 8 }),
      set({ weightValue: 185, reps: 6 }),
      set({ weightValue: 195, reps: 6 }),
    ]);
    /* No set-count tile: the card's caption already says "3 sets completed",
       and repeating it here cost a third of a narrow row. */
    expect(metrics.map((m) => m.key)).toEqual(['topSet', 'volume']);
    expect(metricValue(metrics, 'topSet')).toBe('195 lb × 6');
    // 1080 + 1110 + 1170
    expect(metricValue(metrics, 'volume')).toBe('3,360 lb');
  });

  it('picks the heaviest set as the top set, not the last one performed', () => {
    /* A set that drops to 155 after a 195 top set is the common shape of a
       backoff. Reporting the last set would understate the session. */
    const metrics = completedExerciseMetrics(setsReps, [
      set({ weightValue: 195, reps: 5 }),
      set({ weightValue: 155, reps: 8 }),
    ]);
    expect(metricValue(metrics, 'topSet')).toBe('195 lb × 5');
  });

  it('breaks a top-set tie on reps', () => {
    const metrics = completedExerciseMetrics(setsReps, [
      set({ weightValue: 185, reps: 5 }),
      set({ weightValue: 185, reps: 8 }),
    ]);
    expect(metricValue(metrics, 'topSet')).toBe('185 lb × 8');
  });

  it('excludes warmups from every figure', () => {
    /* A warmup at 45 lb is preparation, not achievement — counting it would
       both inflate the set count and drag the volume figure. */
    const metrics = completedExerciseMetrics(setsReps, [
      set({ setType: 'warmup', weightValue: 45, reps: 10 }),
      set({ weightValue: 135, reps: 8 }),
    ]);
    expect(metricValue(metrics, 'topSet')).toBe('135 lb × 8');
    expect(metricValue(metrics, 'volume')).toBe('1,080 lb');
  });

  it('reports reps for bodyweight work and never a 0 lb volume', () => {
    const metrics = completedExerciseMetrics(bodyweight, [
      set({ weightValue: null, reps: 12 }),
      set({ weightValue: null, reps: 10 }),
    ]);
    expect(metrics.map((m) => m.key)).toEqual(['totalReps', 'bestSet']);
    expect(metricValue(metrics, 'totalReps')).toBe('22');
    expect(metrics.some((m) => m.value.includes('lb'))).toBe(false);
  });

  it('omits "best set" when there is only one set to be best', () => {
    const metrics = completedExerciseMetrics(bodyweight, [set({ weightValue: null, reps: 12 })]);
    expect(metrics.map((m) => m.key)).toEqual(['totalReps']);
  });

  it('reports total and longest for timed intervals', () => {
    const metrics = completedExerciseMetrics(timed, [
      set({ weightValue: null, reps: null, durationSeconds: 45 }),
      set({ weightValue: null, reps: null, durationSeconds: 60 }),
    ]);
    expect(metrics.map((m) => m.key)).toEqual(['duration', 'longest']);
    expect(metricValue(metrics, 'duration')).toBe('1:45');
    expect(metricValue(metrics, 'longest')).toBe('1:00');
  });

  it('does not report a set count for one continuous effort', () => {
    /* `duration` is a single effort; "1 set" is technically true and
       communicates nothing. */
    const metrics = completedExerciseMetrics(duration, [
      set({ weightValue: null, reps: null, durationSeconds: 1200 }),
    ]);
    expect(metrics.map((m) => m.key)).toEqual(['duration']);
    expect(metricValue(metrics, 'duration')).toBe('20:00');
  });

  it('derives pace for a run', () => {
    const metrics = completedExerciseMetrics(distanceDuration, [
      set({ weightValue: null, reps: null, distanceValue: 3, distanceUnit: 'mi', durationSeconds: 1800 }),
    ]);
    expect(metrics.map((m) => m.key)).toEqual(['distance', 'duration', 'pace']);
    expect(metricValue(metrics, 'distance')).toBe('3 mi');
    expect(metricValue(metrics, 'pace')).toBe('10:00 /mi');
  });

  it('omits pace rather than dividing by zero', () => {
    const metrics = completedExerciseMetrics(distanceDuration, [
      set({ weightValue: null, reps: null, distanceValue: 0, distanceUnit: 'mi', durationSeconds: 600 }),
    ]);
    expect(metrics.some((m) => m.key === 'pace')).toBe(false);
    expect(metrics.every((m) => !m.value.includes('Infinity') && !m.value.includes('NaN'))).toBe(true);
  });

  it('treats a logged zero as data, not absence', () => {
    /* A failed AMRAP set legitimately records 0 reps. A truthiness check
       (`if (!reps)`) skips it, and when *every* set is a zero the metric
       vanishes entirely — the card silently drops a figure the user logged.
       Summing to 5 would not catch that, because the non-zero set carries the
       total either way; only an all-zero exercise distinguishes the two. */
    const allZero = completedExerciseMetrics(bodyweight, [
      set({ weightValue: null, reps: 0 }),
      set({ weightValue: null, reps: 0 }),
    ]);
    expect(metricValue(allZero, 'totalReps')).toBe('0');

    const mixed = completedExerciseMetrics(bodyweight, [
      set({ weightValue: null, reps: 0 }),
      set({ weightValue: null, reps: 5 }),
    ]);
    expect(metricValue(mixed, 'totalReps')).toBe('5');
    // The zero-rep set still counts toward the caption's set tally.
    expect(
      completedSetCountLabel([
        set({ weightValue: null, reps: 0 }),
        set({ weightValue: null, reps: 5 }),
      ]),
    ).toBe('2 sets completed');
  });

  it('has nothing to say about an exercise with no performed sets', () => {
    expect(completedExerciseMetrics(setsReps, [])).toEqual([]);
    expect(completedExerciseMetrics(setsReps, [set({ setType: 'warmup' })])).toEqual([]);
  });
});

describe('compareWithPreviousSession', () => {
  const current = [set({ weightValue: 195, reps: 6 })];

  it('is null without history, rather than a placeholder', () => {
    expect(compareWithPreviousSession(setsReps, current, null)).toBeNull();
    expect(compareWithPreviousSession(setsReps, current, [])).toBeNull();
  });

  it('reports an improvement in the lead metric', () => {
    const previous = [set({ weightValue: 185, reps: 6 })];
    const comparison = compareWithPreviousSession(setsReps, current, previous)!;
    expect(comparison.direction).toBe('up');
    // 1170 vs 1110
    expect(comparison.label).toBe('+60 lb vs last');
  });

  it('reports a regression honestly', () => {
    const previous = [set({ weightValue: 225, reps: 6 })];
    const comparison = compareWithPreviousSession(setsReps, current, previous)!;
    expect(comparison.direction).toBe('down');
    expect(comparison.label).toBe('−180 lb vs last');
  });

  it('says so when the session matched', () => {
    const comparison = compareWithPreviousSession(setsReps, current, [set({ weightValue: 195, reps: 6 })])!;
    expect(comparison.direction).toBe('same');
    expect(comparison.label).toBe('Matched last session');
  });

  it('carries direction separately from the label, for icons and screen readers', () => {
    const comparison = compareWithPreviousSession(setsReps, current, [set({ weightValue: 185, reps: 6 })])!;
    expect(comparison.label).not.toMatch(/[↑↓]/);
    expect(comparison.accessibleLabel).toBe('Up 60 lb versus last session');
  });

  it('compares the representation-appropriate metric, not volume everywhere', () => {
    const previous = [set({ weightValue: null, reps: null, durationSeconds: 1200 })];
    const comparison = compareWithPreviousSession(
      duration,
      [set({ weightValue: null, reps: null, durationSeconds: 1500 })],
      previous,
    )!;
    expect(comparison.label).toBe('+5:00 vs last');
  });

  it('does not compare when the previous session lacks the metric', () => {
    /* Bodyweight rows carry no weight, so a volume comparison against them
       would read as a total collapse rather than "not comparable". */
    const previous = [set({ weightValue: null, reps: 8 })];
    expect(compareWithPreviousSession(setsReps, current, previous)).toBeNull();
  });

  it('ignores floating-point drift on distance', () => {
    const comparison = compareWithPreviousSession(
      distanceDuration,
      [set({ weightValue: null, reps: null, distanceValue: 0.1 + 0.2, durationSeconds: 600 })],
      [set({ weightValue: null, reps: null, distanceValue: 0.3, durationSeconds: 600 })],
    )!;
    expect(comparison.direction).toBe('same');
  });
});

describe('buildCompletedExerciseReadout', () => {
  it('surfaces a server-flagged personal record', () => {
    const readout = buildCompletedExerciseReadout(setsReps, [set({ isPrWeight: true })], null);
    expect(readout.isPersonalRecord).toBe(true);
  });

  it('does not treat a warmup PR flag as an exercise PR', () => {
    const readout = buildCompletedExerciseReadout(setsReps, [set({ setType: 'warmup', isPrWeight: true }), set()], null);
    expect(readout.isPersonalRecord).toBe(false);
  });

  it('is quiet when there is no PR and no history', () => {
    const readout = buildCompletedExerciseReadout(setsReps, [set()], null);
    expect(readout.isPersonalRecord).toBe(false);
    expect(readout.comparison).toBeNull();
    expect(readout.metrics.length).toBeGreaterThan(0);
  });
});

describe('completedSetCountLabel', () => {
  it('counts only performed sets', () => {
    expect(completedSetCountLabel([set(), set()])).toBe('2 sets completed');
    expect(completedSetCountLabel([set()])).toBe('1 set completed');
    expect(completedSetCountLabel([set({ setType: 'warmup' }), set()])).toBe('1 set completed');
  });
});

describe('formatCompletedDuration', () => {
  it('reads as seconds under a minute and clock time above it', () => {
    expect(formatCompletedDuration(45)).toBe('45s');
    expect(formatCompletedDuration(60)).toBe('1:00');
    expect(formatCompletedDuration(90)).toBe('1:30');
    expect(formatCompletedDuration(3600)).toBe('1h 00m');
    expect(formatCompletedDuration(3960)).toBe('1h 06m');
  });
});
