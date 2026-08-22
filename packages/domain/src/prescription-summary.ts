import type { Prescription } from '@setframe/schemas';
import { getPrescriptionDefinition, type SessionSetValues } from './prescription-fields';

/**
 * Human-readable summary of a planned exercise prescription (e.g. "3 × 8").
 * Lives in the domain package so the Today preview, the workout logger, the
 * program editors and both platforms describe a plan identically.
 */
export function summarizePrescription(prescription: Prescription | null): string {
  if (!prescription) return 'Planned: —';
  switch (prescription.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      return `Planned: ${prescription.sets} × ${prescription.repsMin}${prescription.repsMax ? `–${prescription.repsMax}` : ''}`;
    case 'top_set_backoff':
      return `Planned: ${prescription.topSets} top + ${prescription.backoffSets} backoff`;
    case 'timed':
      return `Planned: ${prescription.sets} × ${prescription.durationSeconds}s`;
    case 'distance':
      return `Planned: ${prescription.sets} × ${prescription.distanceValue}${prescription.distanceUnit}`;
    case 'duration':
      return `Planned: ${prescription.durationMinutes} min`;
    case 'distanceDuration':
      return `Planned: ${prescription.distanceMiles} mi / ${prescription.durationMinutes} min`;
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
