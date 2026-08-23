import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import { summarizePrescription } from './prescription-summary';

/**
 * Story 19 — every numeric target is optional now. These guard the "open
 * prescription" fallback and partial-value rendering never fabricate a
 * `0 × 0`-style value for a field that was left blank.
 */
describe('summarizePrescription', () => {
  it('summarizes a null prescription', () => {
    expect(summarizePrescription(null)).toBe('Planned: —');
  });

  it('shows "No target set" when a sets_reps prescription has neither value', () => {
    expect(summarizePrescription({ kind: 'sets_reps' } as Prescription)).toBe('No target set');
  });

  it('summarizes a full sets_reps prescription', () => {
    expect(summarizePrescription({ kind: 'sets_reps', sets: 3, repsMin: 8 } as Prescription)).toBe('Planned: 3 × 8');
  });

  it('summarizes a sets_reps prescription with only reps set', () => {
    expect(summarizePrescription({ kind: 'sets_reps', repsMin: 10 } as Prescription)).toBe('Planned: 10 reps');
  });

  it('summarizes a sets_reps prescription with only sets set', () => {
    expect(summarizePrescription({ kind: 'sets_reps', sets: 4 } as Prescription)).toBe('Planned: 4 sets');
  });

  it('includes the rep range when repsMax is set', () => {
    expect(summarizePrescription({ kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 12 } as Prescription)).toBe(
      'Planned: 3 × 8–12',
    );
  });

  it('shows "No target set" for an open top_set_backoff prescription', () => {
    expect(summarizePrescription({ kind: 'top_set_backoff' } as Prescription)).toBe('No target set');
  });

  it('summarizes a top_set_backoff prescription with only backoff set', () => {
    expect(summarizePrescription({ kind: 'top_set_backoff', backoffSets: 2 } as Prescription)).toBe(
      'Planned: 2 backoff',
    );
  });

  it('shows "No target set" for an open timed prescription', () => {
    expect(summarizePrescription({ kind: 'timed' } as Prescription)).toBe('No target set');
  });

  it('summarizes a timed prescription with only duration set', () => {
    expect(summarizePrescription({ kind: 'timed', durationSeconds: 45 } as Prescription)).toBe('Planned: 45s');
  });

  it('shows "No target set" for an open distance prescription', () => {
    expect(summarizePrescription({ kind: 'distance', distanceUnit: 'mi' } as Prescription)).toBe('No target set');
  });

  it('summarizes a distance prescription with only distance set', () => {
    expect(
      summarizePrescription({ kind: 'distance', distanceValue: 5, distanceUnit: 'mi' } as Prescription),
    ).toBe('Planned: 5mi');
  });

  it('shows "No target set" for an open duration prescription', () => {
    expect(summarizePrescription({ kind: 'duration' } as Prescription)).toBe('No target set');
  });

  it('summarizes a duration prescription', () => {
    expect(summarizePrescription({ kind: 'duration', durationMinutes: 30 } as Prescription)).toBe('Planned: 30 min');
  });

  it('shows "No target set" for an open distanceDuration prescription', () => {
    expect(summarizePrescription({ kind: 'distanceDuration' } as Prescription)).toBe('No target set');
  });

  it('summarizes a distanceDuration prescription with only distance set', () => {
    expect(summarizePrescription({ kind: 'distanceDuration', distanceMiles: 3 } as Prescription)).toBe(
      'Planned: 3 mi',
    );
  });

  it('summarizes a full distanceDuration prescription', () => {
    expect(
      summarizePrescription({ kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 } as Prescription),
    ).toBe('Planned: 3 mi / 30 min');
  });
});
