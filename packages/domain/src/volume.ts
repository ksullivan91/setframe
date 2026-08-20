export interface VolumeSet {
  weightValue: number | null;
  reps: number | null;
}

/** Total volume (weight × reps summed across sets). Bodyweight/timed sets
 * with no weight contribute 0 — callers needing bodyweight volume should
 * pre-substitute bodyweight before calling this. */
export function calculateVolume(sets: VolumeSet[]): number {
  return sets.reduce((total, set) => {
    if (set.weightValue == null || set.reps == null) return total;
    return total + set.weightValue * set.reps;
  }, 0);
}
