import { describe, expect, it } from 'vitest';
import type { Prescription } from '@setframe/schemas';
import {
  countsTowardVolume,
  formatSessionSet,
  getPrescriptionDefinition,
  getSessionFieldLabel,
  isSessionSetLogged,
  prescriptionDefinitions,
  resolveSessionFields,
  summarizePrescription,
  validateSessionSet,
  type PrescriptionKind,
} from './index';

const samples: Record<PrescriptionKind, Prescription> = {
  sets_reps: { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 },
  top_set_backoff: {
    kind: 'top_set_backoff',
    topSets: 1,
    topRepsMin: 3,
    topRepsMax: 5,
    backoffSets: 3,
    backoffRepsMin: 8,
    backoffRepsMax: 10,
  },
  per_side: { kind: 'per_side', sets: 3, repsMin: 10 },
  timed: { kind: 'timed', sets: 3, durationSeconds: 45 },
  distance: { kind: 'distance', sets: 1, distanceValue: 400, distanceUnit: 'm' },
  duration: { kind: 'duration', durationMinutes: 30 },
  distanceDuration: { kind: 'distanceDuration', distanceMiles: 12, durationMinutes: 45 },
  bodyweight_reps: { kind: 'bodyweight_reps', sets: 4, repsMin: 8 },
};

const kinds = Object.keys(samples) as PrescriptionKind[];

describe('prescription definitions', () => {
  it('defines every prescription kind in the schema union', () => {
    for (const kind of kinds) {
      expect(prescriptionDefinitions[kind]).toBeDefined();
      expect(prescriptionDefinitions[kind].kind).toBe(kind);
    }
  });

  it('keeps required and optional fields disjoint and inside fields', () => {
    for (const kind of kinds) {
      const definition = prescriptionDefinitions[kind];
      expect(definition.requiredFields.length).toBeGreaterThan(0);
      for (const field of definition.requiredFields) {
        expect(definition.fields).toContain(field);
        expect(definition.optionalFields).not.toContain(field);
      }
      for (const field of definition.optionalFields) {
        expect(definition.fields).toContain(field);
      }
    }
  });

  it('hides strength fields from duration and distance work', () => {
    for (const kind of ['timed', 'duration', 'distance', 'distanceDuration'] as const) {
      expect(prescriptionDefinitions[kind].fields).not.toContain('weight');
      expect(prescriptionDefinitions[kind].fields).not.toContain('reps');
    }
  });

  it('hides duration and distance from strength and bodyweight work', () => {
    for (const kind of ['sets_reps', 'top_set_backoff', 'per_side', 'bodyweight_reps'] as const) {
      expect(prescriptionDefinitions[kind].fields).not.toContain('duration');
      expect(prescriptionDefinitions[kind].fields).not.toContain('distance');
    }
  });

  it('does not require external weight for bodyweight reps', () => {
    expect(prescriptionDefinitions.bodyweight_reps.fields).not.toContain('weight');
    expect(prescriptionDefinitions.bodyweight_reps.requiredFields).toEqual(['reps']);
  });

  it('only counts weighted strength work toward volume', () => {
    expect(countsTowardVolume(samples.sets_reps)).toBe(true);
    expect(countsTowardVolume(samples.top_set_backoff)).toBe(true);
    expect(countsTowardVolume(samples.per_side)).toBe(true);
    expect(countsTowardVolume(samples.timed)).toBe(false);
    expect(countsTowardVolume(samples.distance)).toBe(false);
    expect(countsTowardVolume(samples.duration)).toBe(false);
    expect(countsTowardVolume(samples.distanceDuration)).toBe(false);
    expect(countsTowardVolume(samples.bodyweight_reps)).toBe(false);
  });

  it('treats a single continuous effort as having no set type', () => {
    expect(prescriptionDefinitions.duration.fields).not.toContain('setType');
    expect(prescriptionDefinitions.distanceDuration.fields).not.toContain('setType');
    expect(prescriptionDefinitions.sets_reps.fields).toContain('setType');
  });

  it('labels duration in the unit the prescription is expressed in', () => {
    expect(getSessionFieldLabel('duration', prescriptionDefinitions.timed)).toBe('Duration (sec)');
    expect(getSessionFieldLabel('duration', prescriptionDefinitions.duration)).toBe('Duration (min)');
  });
});

describe('resolveSessionFields', () => {
  it('shows only relevant fields for a clean sets + reps set', () => {
    expect(resolveSessionFields(samples.sets_reps, {})).toEqual(['setType', 'weight', 'reps', 'rpe']);
  });

  it('shows only distance and duration for a bike ride', () => {
    expect(resolveSessionFields(samples.distanceDuration, {})).toEqual(['duration', 'distance', 'rpe']);
  });

  it('covers every kind without leaking an unknown field', () => {
    for (const kind of kinds) {
      const fields = resolveSessionFields(samples[kind], {});
      expect(fields).toEqual(prescriptionDefinitions[kind].fields);
    }
  });

  // The non-destructive guarantee: a cycling exercise logged before this
  // story may carry stale weight/reps. Hiding those outright would strand
  // values the user can neither see nor clear.
  it('keeps legacy values visible even when the prescription omits them', () => {
    const legacy = resolveSessionFields(samples.distanceDuration, { weightValue: 45, reps: 5 });
    expect(legacy).toContain('weight');
    expect(legacy).toContain('reps');
  });

  it('drops the legacy field again once the value is cleared', () => {
    expect(resolveSessionFields(samples.distanceDuration, { weightValue: null, reps: null })).not.toContain('weight');
  });

  it('falls back to a permissive set of fields with no prescription', () => {
    expect(resolveSessionFields(null, {})).toEqual(['setType', 'weight', 'reps', 'duration', 'distance', 'rpe']);
  });
});

describe('isSessionSetLogged', () => {
  it('requires weight and reps for strength work', () => {
    expect(isSessionSetLogged(samples.sets_reps, { weightValue: 135, reps: 5 })).toBe(true);
    expect(isSessionSetLogged(samples.sets_reps, { weightValue: 135 })).toBe(false);
  });

  it('requires only reps for bodyweight work', () => {
    expect(isSessionSetLogged(samples.bodyweight_reps, { reps: 12 })).toBe(true);
    expect(isSessionSetLogged(samples.bodyweight_reps, { weightValue: 20 })).toBe(false);
  });

  it('requires only duration for timed work', () => {
    expect(isSessionSetLogged(samples.timed, { durationSeconds: 60 })).toBe(true);
    expect(isSessionSetLogged(samples.timed, { reps: 10 })).toBe(false);
  });

  it('requires both distance and duration for a distance + duration effort', () => {
    expect(isSessionSetLogged(samples.distanceDuration, { distanceValue: 12, durationSeconds: 2700 })).toBe(true);
    expect(isSessionSetLogged(samples.distanceDuration, { distanceValue: 12 })).toBe(false);
  });

  it('accepts any value at all when there is no prescription', () => {
    expect(isSessionSetLogged(null, { reps: 5 })).toBe(true);
    expect(isSessionSetLogged(null, {})).toBe(false);
  });
});

describe('validateSessionSet', () => {
  it('accepts a valid set for every kind', () => {
    const valid = {
      weightValue: 100,
      reps: 5,
      durationSeconds: 60,
      distanceValue: 5,
      rpe: 8,
    };
    for (const kind of kinds) {
      expect(validateSessionSet(samples[kind], valid, { requireComplete: true })).toEqual({});
    }
  });

  it('never reports an error for a field the user cannot see', () => {
    // Weight is hidden for a bike ride, so a stray value must not block save.
    const errors = validateSessionSet(samples.distanceDuration, {
      distanceValue: 12,
      durationSeconds: 2700,
    }, { requireComplete: true });
    expect(errors).toEqual({});
  });

  it('reports missing required fields only when completeness is requested', () => {
    expect(validateSessionSet(samples.sets_reps, { weightValue: 100 })).toEqual({});
    expect(validateSessionSet(samples.sets_reps, { weightValue: 100 }, { requireComplete: true }).reps).toMatch(
      /required/i,
    );
  });

  it('rejects out-of-range and non-integer values', () => {
    expect(validateSessionSet(samples.sets_reps, { rpe: 12 }).rpe).toMatch(/between 0 and 10/i);
    expect(validateSessionSet(samples.sets_reps, { reps: 5.5 }).reps).toMatch(/whole number/i);
    expect(validateSessionSet(samples.sets_reps, { weightValue: -1 }).weight).toMatch(/negative/i);
    expect(validateSessionSet(samples.timed, { durationSeconds: Number.NaN }).duration).toMatch(/number/i);
  });
});

describe('summaries', () => {
  it('summarises every prescription kind without throwing', () => {
    for (const kind of kinds) {
      expect(summarizePrescription(samples[kind])).toMatch(/^Planned: /);
    }
    expect(summarizePrescription(null)).toBe('Planned: —');
  });

  it('formats a strength set as weight and reps', () => {
    expect(formatSessionSet(samples.sets_reps, { weightValue: 135, weightUnit: 'lb', reps: 5 })).toBe('135lb · 5 reps');
  });

  it('formats seconds for timed work and minutes for duration work', () => {
    expect(formatSessionSet(samples.timed, { durationSeconds: 45 })).toBe('45s');
    expect(formatSessionSet(samples.duration, { durationSeconds: 1800 })).toBe('30 min');
    expect(formatSessionSet(samples.duration, { durationSeconds: 1830 })).toBe('30.5 min');
  });

  it('falls back to the prescription default distance unit', () => {
    expect(formatSessionSet(samples.distanceDuration, { distanceValue: 12 })).toBe('12mi');
    expect(formatSessionSet(samples.distance, { distanceValue: 400, distanceUnit: 'm' })).toBe('400m');
  });

  it('includes RPE only when asked', () => {
    expect(formatSessionSet(samples.sets_reps, { reps: 5, rpe: 8 })).toBe('5 reps');
    expect(formatSessionSet(samples.sets_reps, { reps: 5, rpe: 8 }, { includeRpe: true })).toBe('5 reps · RPE 8');
  });

  it('returns an empty string for an unlogged set', () => {
    expect(formatSessionSet(samples.sets_reps, {})).toBe('');
  });
});

describe('getPrescriptionDefinition', () => {
  it('accepts a prescription object or a bare kind', () => {
    expect(getPrescriptionDefinition(samples.timed).kind).toBe('timed');
    expect(getPrescriptionDefinition('timed').kind).toBe('timed');
  });

  it('falls back for null and unrecognised kinds', () => {
    expect(getPrescriptionDefinition(null).label).toBe('Unplanned');
    expect(getPrescriptionDefinition('nope' as PrescriptionKind).label).toBe('Unplanned');
  });
});
