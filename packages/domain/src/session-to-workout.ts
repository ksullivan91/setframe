import { prEligibleSetTypes } from './session-pr';

/**
 * Deriving a reusable workout from a session that was actually performed.
 *
 * This is **intent authored from fact** — the reverse of the usual direction,
 * and the reason "Just start training" was a design question rather than a
 * button. ADR 0005 keeps intent and fact separate; this creates *new* intent
 * on request and never mutates existing intent.
 *
 * Two rules the design commits to, both enforced here:
 *
 * - **Targets come from what was performed.** Sets and reps become the
 *   prescription, so the saved workout says what you actually did.
 * - **Weight does not.** A target weight copied from one good day becomes a
 *   stale number you fight with for weeks. The saved prescription carries no
 *   load, and the logger leaves weight blank the way it does for any
 *   template.
 */

export interface PerformedSet {
  setType: string;
  reps: number | null;
  weightValue: number | null;
  completed?: boolean;
}

export interface PerformedExercise {
  exerciseId: string;
  sets: readonly PerformedSet[];
}

export interface DerivedExercise {
  exerciseId: string;
  sortOrder: number;
  prescription: { kind: 'sets_reps'; sets: number; repsMin?: number };
}

/**
 * Counts only the sets that represent the working intent of the exercise.
 *
 * Warm-ups are excluded: nobody wants "5 × 8" on a template because they
 * ramped up to the real work. The same `prEligibleSetTypes` the PR rules use,
 * for the same reason — those are the sets that describe the effort.
 */
function workingSets(sets: readonly PerformedSet[]): PerformedSet[] {
  return sets.filter(
    (set) => prEligibleSetTypes.has(set.setType) && set.completed !== false && set.reps != null,
  );
}

/**
 * The rep target for an exercise: the **most common** rep count performed.
 *
 * Not the mean, which invents a number nobody did (three sets of 8, 8 and 5
 * average to 7), and not the max, which turns one good set into a standing
 * target. Ties go to the higher count, so a 8/8/10 session targets 8 and a
 * 8/10 session targets 10 rather than silently rounding effort down.
 */
export function modalReps(sets: readonly PerformedSet[]): number | undefined {
  const working = workingSets(sets);
  if (working.length === 0) return undefined;

  const counts = new Map<number, number>();
  for (const set of working) {
    const reps = set.reps as number;
    counts.set(reps, (counts.get(reps) ?? 0) + 1);
  }

  let best: number | undefined;
  let bestCount = 0;
  for (const [reps, count] of counts) {
    if (count > bestCount || (count === bestCount && best != null && reps > best)) {
      best = reps;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Turns a performed session into day-type exercises.
 *
 * Exercises with no working sets are dropped — an exercise you opened and did
 * not perform is not part of the workout you just did, and putting it in the
 * template would quietly prescribe something you skipped.
 */
export function deriveWorkoutFromSession(
  exercises: readonly PerformedExercise[],
): DerivedExercise[] {
  const derived: DerivedExercise[] = [];
  for (const exercise of exercises) {
    const working = workingSets(exercise.sets);
    if (working.length === 0) continue;

    const reps = modalReps(exercise.sets);
    derived.push({
      exerciseId: exercise.exerciseId,
      sortOrder: derived.length,
      /* No weight, deliberately — see the module comment. */
      prescription: reps == null
        ? { kind: 'sets_reps', sets: working.length }
        : { kind: 'sets_reps', sets: working.length, repsMin: reps },
    });
  }
  return derived;
}

/**
 * What the save screen shows under each exercise: `3 × 8 — from what you did`.
 *
 * Says where the number came from, because "save as a workout" is otherwise
 * an opaque promise about what is being copied.
 */
export function describeDerivedExercise(derived: DerivedExercise): string {
  const { sets, repsMin } = derived.prescription;
  const target = repsMin == null ? `${sets} sets` : `${sets} × ${repsMin}`;
  return `${target} — from what you did`;
}
