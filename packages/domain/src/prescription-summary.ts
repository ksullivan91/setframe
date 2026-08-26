import type { Prescription } from '@setframe/schemas';
import { getPrescriptionDefinition, type SessionSetValues } from './prescription-fields';

const NO_TARGET = 'No target set';

/**
 * Human-readable summary of a planned exercise prescription (e.g. "3 × 8").
 * Lives in the domain package so the Today preview, the workout logger, the
 * program editors and both platforms describe a plan identically.
 *
 * Every numeric target is optional (Story 19 — "open prescription"): a
 * prescription can exist with `kind` chosen and nothing else. Never
 * fabricate a `0 × 0`-style value for an absent field — fall back to
 * "No target set" when nothing is planned yet, or describe just the
 * piece that *is* set when only part of the shape is filled in.
 */
export function summarizePrescription(prescription: Prescription | null): string {
  if (!prescription) return 'Planned: —';
  switch (prescription.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps': {
      const { sets, repsMin, repsMax } = prescription;
      if (sets == null && repsMin == null) return NO_TARGET;
      const reps = repsMin != null ? `${repsMin}${repsMax ? `–${repsMax}` : ''}` : null;
      if (sets != null && reps != null) return `Planned: ${sets} × ${reps}`;
      return `Planned: ${sets != null ? `${sets} sets` : `${reps} reps`}`;
    }
    case 'top_set_backoff': {
      const { topSets, backoffSets } = prescription;
      if (topSets == null && backoffSets == null) return NO_TARGET;
      const parts = [
        topSets != null ? `${topSets} top` : null,
        backoffSets != null ? `${backoffSets} backoff` : null,
      ].filter((part): part is string => part != null);
      return `Planned: ${parts.join(' + ')}`;
    }
    case 'timed': {
      const { sets, durationSeconds } = prescription;
      if (sets == null && durationSeconds == null) return NO_TARGET;
      if (sets != null && durationSeconds != null) return `Planned: ${sets} × ${durationSeconds}s`;
      return `Planned: ${sets != null ? `${sets} sets` : `${durationSeconds}s`}`;
    }
    case 'distance': {
      const { sets, distanceValue, distanceUnit } = prescription;
      if (sets == null && distanceValue == null) return NO_TARGET;
      if (sets != null && distanceValue != null) return `Planned: ${sets} × ${distanceValue}${distanceUnit}`;
      return `Planned: ${sets != null ? `${sets} sets` : `${distanceValue}${distanceUnit}`}`;
    }
    case 'duration':
      return prescription.durationMinutes != null ? `Planned: ${prescription.durationMinutes} min` : NO_TARGET;
    case 'distanceDuration': {
      const { distanceMiles, durationMinutes } = prescription;
      if (distanceMiles == null && durationMinutes == null) return NO_TARGET;
      if (distanceMiles != null && durationMinutes != null) return `Planned: ${distanceMiles} mi / ${durationMinutes} min`;
      return `Planned: ${distanceMiles != null ? `${distanceMiles} mi` : `${durationMinutes} min`}`;
    }
  }
}

export interface FormattableSet extends SessionSetValues {
  weightUnit?: string | null;
  distanceUnit?: string | null;
}

function formatDuration(seconds: number, unit: 'seconds' | 'minutes'): string {
  if (unit === 'minutes') {
    const minutes = seconds / 60;
    return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
  }
  return `${seconds}s`;
}

/**
 * Summarises what was actually logged for a set, showing only the metrics
 * that matter for its prescription. Used for the "previous session" hint and
 * the planned-vs-actual comparison on both platforms.
 *
 * Values the prescription does not call for are still rendered when present,
 * mirroring `resolveSessionFields` — a stale value the user can see is far
 * better than one that silently disappears from their history.
 */
export function formatSessionSet(
  prescription: Prescription | null | undefined,
  set: FormattableSet,
  options: { includeRpe?: boolean } = {},
): string {
  const definition = getPrescriptionDefinition(prescription);
  const bits: string[] = [];

  if (set.weightValue != null) bits.push(`${set.weightValue}${set.weightUnit ?? ''}`);
  if (set.reps != null) bits.push(`${set.reps} reps`);
  if (set.durationSeconds != null) bits.push(formatDuration(set.durationSeconds, definition.units.duration));
  if (set.distanceValue != null) bits.push(`${set.distanceValue}${set.distanceUnit ?? definition.units.distance}`);
  if (options.includeRpe && set.rpe != null) bits.push(`RPE ${set.rpe}`);

  return bits.join(' · ');
}

/**
 * A completed exercise in one line: `3 sets · 135 lb × 8`.
 *
 * Story 61. The collapsed completed card needs to say what was achieved
 * without becoming a set list — the whole point of collapsing is that the
 * detail is available on demand rather than always present.
 *
 * Representation-aware through `formatSessionSet`, so a run reads
 * `1 set · 3 mi · 30 min` rather than being forced into weight × reps.
 *
 * Uniform sets collapse to one figure; mixed sets say so rather than picking
 * a winner. Reporting `135 lb × 8` for an exercise whose last set dropped to
 * 6 reps would overstate it, and averaging would invent a set that never
 * happened.
 */
export function summarizeCompletedExercise(
  prescription: Prescription | null | undefined,
  sets: readonly FormattableSet[],
  options: { includeRpe?: boolean } = {},
): string | null {
  if (!sets.length) return null;

  const setLabel = `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`;
  const formatted = sets.map((set) => formatSessionSet(prescription, set, options));
  const distinct = [...new Set(formatted.filter(Boolean))];

  if (!distinct.length) return setLabel;
  if (distinct.length === 1) return `${setLabel} · ${distinct[0]}`;

  /* Mixed. Leading with the heaviest/longest would misrepresent the rest, so
     the range is named by its endpoints in the order performed — which is
     what a lifter actually wants to see from a top-set-and-backoff or a
     set that dropped. */
  return `${setLabel} · ${formatted[0]} → ${formatted.at(-1)}`;
}
