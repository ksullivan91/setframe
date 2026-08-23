export interface HistoricalSet {
  weightValue: number | null;
  reps: number | null;
}

/**
 * Detects whether `candidate` is a new all-time weight PR for its exercise,
 * compared against `history` (prior qualifying sets for the same exercise,
 * any rep count). Backs the Session Summary trophy badge (Figma style guide
 * §17) — see docs/data-model.md §8 decision 5.
 *
 * With no history there is no record to break, so no PR is reported. Seeding
 * the comparison at zero instead used to make a 1 lb × 1 probe an all-time
 * record on an exercise's first ever session.
 *
 * Prefer `resolveSessionPRs` for anything rendering badges — it also folds in
 * earlier sets from the session being logged and resolves supersession.
 */
export function detectWeightPR(candidate: HistoricalSet, history: HistoricalSet[]): boolean {
  if (candidate.weightValue == null) return false;
  const priorWeights = history.filter((set) => set.weightValue != null).map((set) => set.weightValue as number);
  if (!priorWeights.length) return false;
  return candidate.weightValue > Math.max(...priorWeights);
}

/**
 * Detects whether `candidate` is a new all-time rep PR: strictly more reps
 * than have ever been performed at the same weight or heavier.
 *
 * The comparison additionally requires prior history *at the candidate's own
 * weight*. Without that floor a light high-rep set clears the bar trivially —
 * 20 reps at 45 lb would out-rep a 5-rep set at 100 lb and claim a record,
 * which is not a strength improvement. Requiring a like-for-like load means
 * the badge always answers "more reps than I have ever done at this weight".
 */
export function detectRepPR(candidate: HistoricalSet, history: HistoricalSet[]): boolean {
  if (candidate.weightValue == null || candidate.reps == null) return false;

  const comparable = history.filter(
    (set) => set.weightValue != null && set.reps != null && set.weightValue >= (candidate.weightValue as number),
  );
  if (!comparable.some((set) => set.weightValue === candidate.weightValue)) return false;

  const maxPriorRepsAtWeightOrAbove = comparable.reduce((max, set) => Math.max(max, set.reps as number), 0);
  return candidate.reps > maxPriorRepsAtWeightOrAbove;
}
