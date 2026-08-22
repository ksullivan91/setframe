/**
 * Ordering helper for undoing a workout-exercise removal (Story 03).
 *
 * Guided Setup persists workout exercises immediately, so removing one is
 * a real DELETE and undo has to re-create the row. Two API behaviours make
 * naive undo unsafe:
 *
 * 1. `POST /day-types/:id/exercises` always appends (`sortOrder: existing.length`),
 *    so a restored exercise lands at the end of the workout.
 * 2. `POST /day-types/:id/exercises/reorder` rejects any payload whose id
 *    *set* differs from the day type's current rows.
 *
 * Replaying a stale pre-delete snapshot therefore 404s as soon as anything
 * else changed in between (another add, a second removal still in flight),
 * leaving the row re-created but appended while the user is told the undo
 * failed — the duplicate-exercise trap this story exists to remove.
 *
 * So build the payload from the *current* server ids and splice the restored
 * row back into its original slot. The result is set-identical to the live
 * list by construction, whatever else happened since the removal.
 */
export function restoreExerciseOrder({
  currentIds,
  restoredId,
  originalIndex,
}: {
  /** Live exercise ids, in sort order, as returned by the server after the re-create. */
  currentIds: string[];
  /** Id of the newly re-created row. Re-creating assigns a fresh id. */
  restoredId: string;
  /** Position the exercise occupied before it was removed. */
  originalIndex: number;
}): string[] {
  const withoutRestored = currentIds.filter((id) => id !== restoredId);
  const insertAt = Math.min(Math.max(originalIndex, 0), withoutRestored.length);
  return [...withoutRestored.slice(0, insertAt), restoredId, ...withoutRestored.slice(insertAt)];
}
