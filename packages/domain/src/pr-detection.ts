export interface HistoricalSet {
  weightValue: number | null;
  reps: number | null;
}

/**
 * Detects whether `candidate` set is a new all-time weight PR for its
 * exercise, compared against `history` (all prior completed sets for the
 * same exercise, any rep count). Backs the Session Summary trophy badge
 * (Figma style guide §17) — see docs/data-model.md §8 decision 5.
 */
export function detectWeightPR(candidate: HistoricalSet, history: HistoricalSet[]): boolean {
  if (candidate.weightValue == null) return false;
  const maxPriorWeight = history.reduce((max, set) => {
    if (set.weightValue == null) return max;
    return Math.max(max, set.weightValue);
  }, 0);
  return candidate.weightValue > maxPriorWeight;
}

/**
 * Detects whether `candidate` is a new all-time rep PR at-or-above its
 * own weight (i.e. most reps ever performed at that weight or heavier).
 */
export function detectRepPR(candidate: HistoricalSet, history: HistoricalSet[]): boolean {
  if (candidate.weightValue == null || candidate.reps == null) return false;
  const maxPriorRepsAtWeightOrAbove = history.reduce((max, set) => {
    if (set.weightValue == null || set.reps == null) return max;
    if (set.weightValue < (candidate.weightValue as number)) return max;
    return Math.max(max, set.reps);
  }, 0);
  return candidate.reps > maxPriorRepsAtWeightOrAbove;
}
