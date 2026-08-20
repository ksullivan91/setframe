/**
 * Epley formula estimated 1RM. Pure function — no I/O, so it's safe to
 * call identically from the API (server-computed trend data) and from
 * the mobile/web clients (optimistic UI) per master spec §9.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
