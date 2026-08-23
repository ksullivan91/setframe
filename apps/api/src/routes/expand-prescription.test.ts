import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import { expandPrescriptionToSetDrafts } from './workout-sessions';

/**
 * Story 19 — every planned value is optional now. This is the function
 * that turns a template's prescription into the pre-filled draft sets a
 * session starts with; the real bug this guards is `undefined * 60`
 * silently becoming a stored `NaN` for an unplanned duration/distance
 * exercise, and confirms "no target" degrades to zero pre-filled sets
 * rather than throwing.
 */
describe('expandPrescriptionToSetDrafts', () => {
  it('expands a fully-planned sets_reps prescription', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'sets_reps', sets: 3, repsMin: 8 } as Prescription);
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toEqual({ setType: 'working', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null });
  });

  it('produces zero draft sets for a sets_reps exercise with no planned sets count', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'sets_reps', repsMin: 8 } as Prescription);
    expect(drafts).toEqual([]);
  });

  it('fills reps as null, not a stale value, when only sets is planned', () => {
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
    expect(drafts).toEqual([
      { setType: 'backoff', reps: 10, durationSeconds: null, distanceValue: null, distanceUnit: null },
      { setType: 'backoff', reps: 10, durationSeconds: null, distanceValue: null, distanceUnit: null },
    ]);
  });

  it('never computes NaN for an unplanned duration exercise — skips the draft row entirely', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'duration' } as Prescription)).toEqual([]);
  });

  it('expands a planned duration exercise to seconds', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'duration', durationMinutes: 5 } as Prescription)).toEqual([
      { setType: 'working', reps: null, durationSeconds: 300, distanceValue: null, distanceUnit: null },
    ]);
  });

  it('never computes NaN for an entirely unplanned distanceDuration exercise', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'distanceDuration' } as Prescription)).toEqual([]);
  });

  it('keeps the distanceDuration draft row when only one half is planned, nulling the rest', () => {
    const drafts = expandPrescriptionToSetDrafts({ kind: 'distanceDuration', distanceMiles: 4 } as Prescription);
    expect(drafts).toEqual([
      { setType: 'working', reps: null, durationSeconds: null, distanceValue: 4, distanceUnit: 'mi' },
    ]);
  });

  it('produces zero draft sets for an open distance prescription', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'distance', distanceUnit: 'mi' } as Prescription)).toEqual([]);
  });

  it('produces zero draft sets for an open timed prescription', () => {
    expect(expandPrescriptionToSetDrafts({ kind: 'timed' } as Prescription)).toEqual([]);
  });
});
