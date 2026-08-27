import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import { isExerciseComplete, isSessionSetLogged } from '@setframe/domain';
import { expandPrescriptionToSetDrafts } from './workout-sessions';

/**
 * Story 19 — every planned value is optional. This is the function that turns
 * a template's prescription into the session's starting set rows, and it
 * guards `undefined * 60` silently storing `NaN` for an unplanned
 * duration/distance exercise, plus "no target" degrading to zero rows rather
 * than throwing.
 *
 * Story 42.1 changed what it returns. These rows are *structure* — how many
 * sets, of what type — and never planned values. Copying the plan onto them
 * persisted intent as though it were performance, and since completion is
 * derived from a set carrying its required fields, starting a workout marked
 * five of the eight representations complete before the user touched
 * anything. Several tests below previously asserted that copying, which is
 * how the defect survived: they pinned it in place.
 */
describe('expandPrescriptionToSetDrafts', () => {
  it('expands a fully-planned sets_reps prescription', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'sets_reps', sets: 3, repsMin: 8 } as Prescription);
    expect(drafts).toHaveLength(3);
    // Structure only: three working sets, no planned reps written as actuals.
    expect(drafts[0]).toEqual({ setType: 'working', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null });
  });

  it('produces zero draft sets for a sets_reps exercise with no planned sets count', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'sets_reps', repsMin: 8 } as Prescription);
    expect(drafts).toEqual([]);
  });

  it('never carries a planned rep count onto a session set', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'sets_reps', sets: 2 } as Prescription);
    expect(drafts).toEqual([
      { setType: 'working', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
      { setType: 'working', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
    ]);
  });

  it('produces zero draft sets for an entirely open top_set_backoff prescription', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'top_set_backoff' } as Prescription)).toEqual([]);
  });

  it('expands only the planned half of a partially-planned top_set_backoff prescription', () => {
    const drafts = expandPrescriptionToSetDrafts({
      kind: 'top_set_backoff',
      backoffSets: 2,
      backoffRepsMin: 10,
    } as Prescription);
    /* Set *type* is structure and stays — a top/backoff plan really does
       produce those two kinds of set. The planned reps do not. */
    expect(drafts).toEqual([
      { setType: 'backoff', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
      { setType: 'backoff', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
    ]);
  });

  it('never computes NaN for an unplanned duration exercise — skips the draft row entirely', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'duration' } as Prescription)).toEqual([]);
  });

  it('gives a planned duration exercise a row to log into, but no logged duration', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'duration', durationMinutes: 5 } as Prescription)).toEqual([
      { setType: 'working', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
    ]);
  });

  it('never computes NaN for an entirely unplanned distanceDuration exercise', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'distanceDuration' } as Prescription)).toEqual([]);
  });

  it('keeps the distanceDuration row when only one half is planned, with nothing logged', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'distanceDuration', distanceMiles: 4 } as Prescription);
    expect(drafts).toEqual([
      { setType: 'working', reps: null, durationSeconds: null, distanceValue: null, distanceUnit: null },
    ]);
  });

  /**
   * Story 42.1's central regression, expressed against the domain rule it
   * broke rather than against one representation's fields.
   *
   * A fully planned exercise of *any* representation must start with nothing
   * logged. Checking each kind matters: the three weight-bearing ones escaped
   * the original defect purely because weight was never copied, so a test
   * covering only `sets_reps` would have passed throughout.
   */
  it('never produces a set that already counts as logged, for any representation', () => {
    const fullyPlanned: Prescription[] = [
      { kind: 'sets_reps', sets: 3, repsMin: 8 },
      { kind: 'per_side', sets: 3, repsMin: 8 },
      { kind: 'top_set_backoff', topSets: 1, topRepsMin: 3, backoffSets: 2, backoffRepsMin: 8 },
      { kind: 'bodyweight_reps', sets: 3, repsMin: 10 },
      { kind: 'timed', sets: 3, durationSeconds: 45 },
      { kind: 'distance', sets: 1, distanceValue: 5, distanceUnit: 'mi' },
      { kind: 'duration', durationMinutes: 20 },
      { kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 },
    ] as Prescription[];

    for (const prescription of fullyPlanned) {
      const drafts = expandPrescriptionToSetDrafts(prescription);
      expect(drafts.length, `${prescription.kind} should still produce rows`).toBeGreaterThan(0);
      for (const draft of drafts) {
        expect(isSessionSetLogged(prescription, draft), `${prescription.kind} started already logged`).toBe(false);
      }
      expect(
        isExerciseComplete(prescription, drafts),
        `${prescription.kind} was complete before the user did anything`,
      ).toBe(false);
    }
  });

  it('produces zero draft sets for an open distance prescription', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'distance', distanceUnit: 'mi' } as Prescription)).toEqual([]);
  });

  it('produces zero draft sets for an open timed prescription', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'timed' } as Prescription)).toEqual([]);
  });
});
