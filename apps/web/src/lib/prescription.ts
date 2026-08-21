import type { Prescription } from '@setline/schemas';

/** Human-readable summary of a planned exercise prescription (e.g. "3 × 8"). Shared between the Today "Preview" modal and the workout logging screen so both describe a plan identically. */
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
