import type { HistoricalSet } from './pr-detection';
import { detectRepPR, detectWeightPR } from './pr-detection';

/**
 * PR semantics for Setframe. Written out deliberately, because the previous
 * implicit rules produced badges nobody could trust: in a single gym session
 * an opening 85 × 6, a heavier 105 × 6, and a deliberate 1 lb × 1 probe all
 * showed both Weight PR and Rep PR at once.
 *
 * 1. **Qualifying set.** Only `working`, `top` and `backoff` sets with both a
 *    weight and a rep count qualify — as candidates *and* as baseline. A
 *    warm-up is by definition not a maximal effort, so counting one either
 *    way is misleading. `drop` and `failure` sets are performed under
 *    accumulated fatigue and are excluded for the same reason.
 *
 * 2. **Weight PR.** The set moves a strictly greater external load than any
 *    qualifying set for the same exercise.
 *
 * 3. **Rep PR.** The set performs strictly more reps than any qualifying set
 *    at that weight *or heavier*. Bare "most reps ever" would hand a rep PR
 *    to every light high-rep set, which is why the load floor is part of the
 *    rule.
 *
 * 4. **Baseline.** All-time, across previously completed sessions, plus
 *    earlier qualifying sets in the session being logged. Comparing only
 *    against completed sessions was the core bug: every set in the live
 *    session measured itself against the same stale baseline, so they could
 *    all "win" simultaneously.
 *
 * 5. **No history.** With no qualifying history for an exercise, no badge is
 *    awarded. The first session silently establishes the baseline. Treating
 *    an empty baseline as `max = 0` is what let a 1 lb × 1 probe register as
 *    a record.
 *
 * 6. **Supersession.** A badge marks the set that *holds* the record at the
 *    end, not one that briefly held it.
 *
 *    Weight is a single total order, so the final holder is simply the last
 *    set that beat the running baseline. Reps are *not* — because a rep PR is
 *    scoped to a load, a later rep PR at a lighter weight does not displace an
 *    earlier one at a heavier weight. A rep badge is therefore only revoked by
 *    a later set that is at least as heavy *and* at least as many reps.
 *
 * 7. **Only performed sets count.** Sets pre-populated from a program
 *    template but not yet ticked off (`completed: false`) are prescriptions,
 *    not performances. Counting them would badge work nobody has done and,
 *    worse, poison the running baseline so the set the user actually
 *    performed loses its badge.
 */
export const prEligibleSetTypes: ReadonlySet<string> = new Set(['working', 'top', 'backoff']);

export interface PRCandidateSet extends HistoricalSet {
  id: string;
  setType: string;
  /** Defaults to `true` so callers with no notion of completion still work. */
  completed?: boolean;
}

export interface PRFlags {
  isPrWeight: boolean;
  isPrReps: boolean;
}

export function isPrEligible(set: {
  setType: string;
  weightValue: number | null;
  reps: number | null;
  completed?: boolean;
}): boolean {
  if (set.completed === false) return false;
  return prEligibleSetTypes.has(set.setType) && set.weightValue != null && set.reps != null;
}

/** Filters a raw history list down to sets that may form the baseline. */
export function toPrBaseline(
  sets: { setType?: string | null; weightValue: number | null; reps: number | null; completed?: boolean }[],
): HistoricalSet[] {
  return sets
    .filter(
      (set) =>
        // A history row with no set type predates typed sets; include it rather
        // than silently shrinking a user's established baseline.
        (set.setType == null || prEligibleSetTypes.has(set.setType)) &&
        set.completed !== false &&
        set.weightValue != null &&
        set.reps != null,
    )
    .map((set) => ({ weightValue: set.weightValue, reps: set.reps }));
}

/**
 * Resolves PR flags for every set of one exercise in one session.
 *
 * `history` is the all-time qualifying baseline from previously completed
 * sessions (exclude the session being resolved). `sets` must be in the order
 * they were performed.
 *
 * Deterministic: the same inputs always produce the same flags, so it can be
 * re-run from scratch after any create, edit or delete rather than patched
 * incrementally.
 */
export function resolveSessionPRs(params: {
  history: HistoricalSet[];
  sets: PRCandidateSet[];
}): Map<string, PRFlags> {
  const baseline = toPrBaseline(params.history);
  const flags = new Map<string, PRFlags>();
  for (const set of params.sets) flags.set(set.id, { isPrWeight: false, isPrReps: false });

  // Rule 5 — an exercise with no qualifying history has no record to break.
  if (!baseline.length) return flags;

  const running: HistoricalSet[] = [...baseline];
  let lastWeightPrId: string | null = null;
  const repPrs: { id: string; weightValue: number; reps: number }[] = [];

  for (const set of params.sets) {
    if (!isPrEligible(set)) continue;
    const candidate: HistoricalSet = { weightValue: set.weightValue, reps: set.reps };

    if (detectWeightPR(candidate, running)) lastWeightPrId = set.id;
    if (detectRepPR(candidate, running)) {
      repPrs.push({ id: set.id, weightValue: set.weightValue as number, reps: set.reps as number });
    }

    // Rule 4 — fold the set in so the next one measures against it.
    running.push(candidate);
  }

  // Rule 6 — weight is a total order, so only the final holder keeps the badge.
  if (lastWeightPrId) flags.get(lastWeightPrId)!.isPrWeight = true;

  // Rule 6 — a rep record is scoped to a load, so it survives unless a later
  // set matched or beat it at an equal or heavier weight.
  for (const [index, record] of repPrs.entries()) {
    const superseded = repPrs
      .slice(index + 1)
      .some((later) => later.weightValue >= record.weightValue && later.reps >= record.reps);
    if (!superseded) flags.get(record.id)!.isPrReps = true;
  }

  return flags;
}
