import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import {
  describeQuickLogAction,
  isQuickLogComplete,
  quickLogFields,
  plannedQuickLogSeed,
  quickLogTargets,
  supportsQuickLog,
  type QuickLogSet,
} from './quick-log';
import { isSessionSetLogged } from './prescription-fields';

const setsReps: Prescription = { kind: 'sets_reps', sets: 3, repsMin: 8 };
const bodyweight: Prescription = { kind: 'bodyweight_reps', sets: 3, repsMin: 10 };
const distance: Prescription = { kind: 'distance', distanceUnit: 'mi', distanceValue: 3 };
const topSetBackoff: Prescription = { kind: 'top_set_backoff', topSets: 1, backoffSets: 2 };

describe('quickLogFields', () => {
  it('offers weight and reps for a weighted lift', () => {
    expect(quickLogFields(setsReps)).toEqual(['weight', 'reps']);
  });

  it('never offers RPE', () => {
    /* Not filtered by name — RPE lives in every definition's optionalFields,
       so deriving from requiredFields excludes it by construction. It is the
       field the pack calls out as commonly set-specific. */
    for (const prescription of [setsReps, bodyweight, distance, topSetBackoff]) {
      expect(quickLogFields(prescription)).not.toContain('rpe');
    }
  });

  it('never offers setType, which is per-set', () => {
    expect(quickLogFields(setsReps)).not.toContain('setType');
  });

  it('offers reps alone for bodyweight, with no weight box to fill with 0 lb', () => {
    expect(quickLogFields(bodyweight)).toEqual(['reps']);
  });

  it('adapts to a distance representation', () => {
    expect(quickLogFields(distance)).toEqual(['distance']);
  });
});

describe('supportsQuickLog', () => {
  it('supports uniform representations', () => {
    expect(supportsQuickLog(setsReps)).toBe(true);
    expect(supportsQuickLog(bodyweight)).toBe(true);
    expect(supportsQuickLog(distance)).toBe(true);
  });

  it('withholds it for top set + backoff, whose sets differ by design', () => {
    /* Session start creates `top` and `backoff` sets with different planned
       reps on purpose. One weight across them would be wrong for at least one
       group, so the honest answer is the detailed editor, not a shortcut that
       quietly writes bad data. */
    expect(supportsQuickLog(topSetBackoff)).toBe(false);
  });
});

describe('quickLogTargets', () => {
  const set = (id: string, over: Partial<QuickLogSet> = {}): QuickLogSet => ({
    id,
    setType: 'working',
    weightValue: null,
    reps: null,
    ...over,
  });

  it('targets every unlogged set', () => {
    const sets = [set('a'), set('b'), set('c')];
    expect(quickLogTargets(setsReps, sets).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('never touches a set that is already logged', () => {
    /* This is how "do not silently overwrite a manual edit" holds without a
       dirty flag that could drift: a corrected set is logged, so there is
       nothing left for Quick Log to write to it. */
    const sets = [set('a', { weightValue: 135, reps: 6 }), set('b'), set('c')];
    expect(quickLogTargets(setsReps, sets).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('never touches a warmup', () => {
    // A warmup at the working weight is simply wrong.
    const sets = [set('w', { setType: 'warmup' }), set('a'), set('b')];
    expect(quickLogTargets(setsReps, sets).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('converges rather than duplicating when run twice', () => {
    /* Sets are pre-created at session start, so this is an update of existing
       rows. Re-running writes nothing, which is what makes a double tap in a
       gym harmless. */
    const sets = [set('a', { weightValue: 135, reps: 8 }), set('b', { weightValue: 135, reps: 8 })];
    expect(quickLogTargets(setsReps, sets)).toEqual([]);
  });

  it('judges "logged" by the representation, not by weight alone', () => {
    // Reps alone complete a bodyweight set; a null weight is not a gap there.
    const sets = [set('a', { reps: 10 })];
    expect(quickLogTargets(bodyweight, sets)).toEqual([]);
    expect(quickLogTargets(setsReps, sets).map((s) => s.id)).toEqual(['a']);
  });
});

describe('isQuickLogComplete', () => {
  it('requires every offered field', () => {
    expect(isQuickLogComplete(setsReps, { weightValue: 135, reps: 8 })).toBe(true);
    expect(isQuickLogComplete(setsReps, { weightValue: 135 })).toBe(false);
    expect(isQuickLogComplete(setsReps, { reps: 8 })).toBe(false);
  });

  it('does not demand a weight for bodyweight work', () => {
    expect(isQuickLogComplete(bodyweight, { reps: 12 })).toBe(true);
  });

  it('treats zero as a real entered value, not as absent', () => {
    // 0 reps is strange but it is data; blank is the absent case.
    expect(isQuickLogComplete(setsReps, { weightValue: 0, reps: 0 })).toBe(true);
  });
});

describe('describeQuickLogAction', () => {
  it('names the whole exercise when nothing is logged yet', () => {
    expect(describeQuickLogAction(3, 3)).toBe('Log all 3 sets');
    expect(describeQuickLogAction(1, 1)).toBe('Log 1 set');
  });

  it('names only what it will actually write once some sets are logged', () => {
    /* "Log all 3 sets" with one already logged would misstate both the count
       and the effect. */
    expect(describeQuickLogAction(2, 3)).toBe('Log remaining 2 sets');
    expect(describeQuickLogAction(1, 3)).toBe('Log remaining set');
  });

  it('says so when there is nothing left to log', () => {
    expect(describeQuickLogAction(0, 3)).toBe('All sets logged');
  });

  it('never says "apply", which would describe populating rather than saving', () => {
    for (const [target, total] of [[3, 3], [2, 3], [1, 1], [0, 3]] as const) {
      expect(describeQuickLogAction(target, total).toLowerCase()).not.toContain('apply');
    }
  });
});

describe('plannedQuickLogSeed', () => {
  it('seeds reps from the plan for a strength exercise', () => {
    expect(plannedQuickLogSeed({ kind: 'sets_reps', sets: 3, repsMin: 8 })).toEqual({ reps: 8 });
  });

  it('never seeds a weight, because the plan does not have one', () => {
    /* A prescription says "3 × 8", not "3 × 8 at 135 lb". Inventing a weight
       would put a number in front of the user that nothing justifies — and it
       is the field most likely to differ from last time, which is the whole
       reason they are here. */
    expect(plannedQuickLogSeed({ kind: 'sets_reps', sets: 3, repsMin: 8 })).not.toHaveProperty('weightValue');
  });

  it('refuses to seed top_set_backoff, where no single value is honest', () => {
    /* Top and backoff sets plan different reps, so one seed is wrong for at
       least one group — the same reason quick log excludes the kind. */
    expect(
      plannedQuickLogSeed({ kind: 'top_set_backoff', topSets: 1, topRepsMin: 3, backoffSets: 2, backoffRepsMin: 8 }),
    ).toEqual({});
  });

  it('converts planned minutes to the seconds the field stores', () => {
    expect(plannedQuickLogSeed({ kind: 'duration', durationMinutes: 20 })).toEqual({ durationSeconds: 1200 });
    expect(plannedQuickLogSeed({ kind: 'timed', sets: 3, durationSeconds: 45 })).toEqual({ durationSeconds: 45 });
  });

  it('seeds distance with the unit the plan was written in', () => {
    expect(plannedQuickLogSeed({ kind: 'distance', sets: 1, distanceValue: 5, distanceUnit: 'km' })).toEqual({
      distanceValue: 5,
      distanceUnit: 'km',
    });
    expect(plannedQuickLogSeed({ kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 })).toEqual({
      distanceValue: 3,
      distanceUnit: 'mi',
      durationSeconds: 1800,
    });
  });

  it('seeds nothing from an open prescription', () => {
    expect(plannedQuickLogSeed({ kind: 'sets_reps' })).toEqual({});
    expect(plannedQuickLogSeed(null)).toEqual({});
  });

  /**
   * The invariant 42.1 exists to protect, restated where the seed is built:
   * seeding is a convenience, never a claim about what was performed.
   */
  it('produces a seed that does not make a set count as logged', () => {
    const prescription = { kind: 'bodyweight_reps', sets: 3, repsMin: 10 } as const;
    const seed = plannedQuickLogSeed(prescription);
    expect(seed.reps).toBe(10);
    // A seeded value lives in the draft. What the server holds is still empty.
    expect(isSessionSetLogged(prescription, { setType: 'working' })).toBe(false);
  });
});
