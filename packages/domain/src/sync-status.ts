/**
 * Per-record sync state for optimistic writes.
 *
 * Story 60. The workout logger used one `useMutation` instance for every set,
 * so `isPending` was a single page-wide boolean: saving set 1 disabled Save on
 * every other set and on every other exercise. The user was serialised behind
 * the network in the one place that least tolerates it — mid-workout, on gym
 * wifi.
 *
 * The state has to be keyed per record, and settling has to be ordered, which
 * is the part that is easy to get wrong: two saves started in quick
 * succession can return in either order, and a slow first response must not
 * overwrite a fast second one. That is a pure decision about sequence
 * numbers, so it lives here and is tested directly rather than being inferred
 * from a flaky timing test in each app.
 */

export type SyncState = 'idle' | 'saving' | 'error';

export interface SyncEntry {
  state: SyncState;
  /**
   * Which attempt this entry reflects. Monotonic per record, so a settling
   * response can be compared against what the record is currently waiting for.
   */
  seq: number;
}

export type SyncMap = Readonly<Record<string, SyncEntry>>;

/** The state of one record; absent means never written, which is `idle`. */
export function syncStateOf(map: SyncMap, id: string): SyncState {
  return map[id]?.state ?? 'idle';
}

export function isSaving(map: SyncMap, id: string): boolean {
  return syncStateOf(map, id) === 'saving';
}

export function hasSyncError(map: SyncMap, id: string): boolean {
  return syncStateOf(map, id) === 'error';
}

/** Records currently in error, so a screen can offer "retry failed". */
export function failedRecords(map: SyncMap): string[] {
  return Object.keys(map).filter((id) => map[id]!.state === 'error');
}

export interface BeginResult {
  map: SyncMap;
  /** Pass this back to `settleSync` when the request finishes. */
  seq: number;
}

/**
 * Marks a record as saving and allocates this attempt's sequence number.
 *
 * Starting a second write while the first is in flight simply supersedes it:
 * the record stays `saving`, and the earlier attempt can no longer settle it.
 */
export function beginSync(map: SyncMap, id: string): BeginResult {
  const seq = (map[id]?.seq ?? 0) + 1;
  return { map: { ...map, [id]: { state: 'saving', seq } }, seq };
}

/**
 * Applies a finished request's outcome — unless it has been superseded.
 *
 * This is the whole point of the sequence number. Save set 1, immediately
 * edit and save it again, then have the *first* response arrive last: without
 * this check that stale response would mark the record settled and, in the
 * caller, reconcile the older server value over the newer edit. A response
 * whose `seq` is behind the record's current attempt is discarded entirely.
 */
export function settleSync(
  map: SyncMap,
  id: string,
  seq: number,
  outcome: 'success' | 'error',
): SyncMap {
  const current = map[id];
  if (!current || current.seq !== seq) return map;
  if (outcome === 'error') return { ...map, [id]: { state: 'error', seq } };
  // A settled success carries no information worth keeping, and leaving the
  // key behind would make `failedRecords` and any "anything pending?" check
  // walk a map that grows for the length of the session.
  const next = { ...map };
  delete next[id];
  return next;
}

/**
 * Whether a settling response should be applied to cached data.
 *
 * Separate from `settleSync` because the caller needs to know this *before*
 * merging a server response, and merging is not this module's business.
 */
export function isCurrentAttempt(map: SyncMap, id: string, seq: number): boolean {
  return map[id]?.seq === seq;
}

/** Clears one record's error, e.g. when the user edits it again. */
export function clearSync(map: SyncMap, id: string): SyncMap {
  if (!map[id]) return map;
  const next = { ...map };
  delete next[id];
  return next;
}

/**
 * Whether anything is still in flight — for Finish Workout, which must not
 * complete a session while writes are outstanding and silently lose them.
 * Errors are included: an unretried failure is unsaved data too.
 */
export function hasUnsettledWrites(map: SyncMap): boolean {
  return Object.values(map).some((entry) => entry.state !== 'idle');
}
