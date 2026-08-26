import { describe, expect, it } from 'vitest';
import {
  beginSync,
  clearSync,
  failedRecords,
  hasSyncError,
  hasUnsettledWrites,
  isCurrentAttempt,
  isSaving,
  settleSync,
  syncStateOf,
  type SyncMap,
} from './sync-status';

const empty: SyncMap = {};

describe('per-record state', () => {
  it('treats an untouched record as idle', () => {
    expect(syncStateOf(empty, 'set-1')).toBe('idle');
    expect(isSaving(empty, 'set-1')).toBe(false);
  });

  it('marks only the record being written', () => {
    /* The defect this replaces: one shared `isPending` meant saving set 1
       disabled Save on every other set and every other exercise. */
    const { map } = beginSync(empty, 'set-1');
    expect(isSaving(map, 'set-1')).toBe(true);
    expect(isSaving(map, 'set-2')).toBe(false);
  });

  it('forgets a record once it succeeds', () => {
    const { map, seq } = beginSync(empty, 'set-1');
    const settled = settleSync(map, 'set-1', seq, 'success');
    expect(syncStateOf(settled, 'set-1')).toBe('idle');
    // Nothing left behind, so the map cannot grow for the whole session.
    expect(Object.keys(settled)).toEqual([]);
  });

  it('keeps a failure so it can be retried', () => {
    const { map, seq } = beginSync(empty, 'set-1');
    const settled = settleSync(map, 'set-1', seq, 'error');
    expect(hasSyncError(settled, 'set-1')).toBe(true);
    expect(failedRecords(settled)).toEqual(['set-1']);
  });

  it('clears an error when the record is touched again', () => {
    const { map, seq } = beginSync(empty, 'set-1');
    const failed = settleSync(map, 'set-1', seq, 'error');
    expect(hasSyncError(clearSync(failed, 'set-1'), 'set-1')).toBe(false);
  });
});

describe('out-of-order responses', () => {
  it('discards a response that a newer attempt has superseded', () => {
    /* Save set 1, edit and save again, then have the *first* response arrive
       last. Applying it would settle the record against a stale server value
       and overwrite the newer edit. */
    const first = beginSync(empty, 'set-1');
    const second = beginSync(first.map, 'set-1');

    const stale = settleSync(second.map, 'set-1', first.seq, 'success');
    // Still saving: the second attempt is what the record is waiting for.
    expect(isSaving(stale, 'set-1')).toBe(true);

    const settled = settleSync(stale, 'set-1', second.seq, 'success');
    expect(syncStateOf(settled, 'set-1')).toBe('idle');
  });

  it('does not let a stale failure mark a record broken', () => {
    // The newer attempt may well succeed; an older failure says nothing.
    const first = beginSync(empty, 'set-1');
    const second = beginSync(first.map, 'set-1');
    const afterStaleError = settleSync(second.map, 'set-1', first.seq, 'error');
    expect(hasSyncError(afterStaleError, 'set-1')).toBe(false);
    expect(isSaving(afterStaleError, 'set-1')).toBe(true);
  });

  it('reports which attempt a response belongs to, for merging decisions', () => {
    const first = beginSync(empty, 'set-1');
    const second = beginSync(first.map, 'set-1');
    // The caller checks this before merging a server response into its cache.
    expect(isCurrentAttempt(second.map, 'set-1', first.seq)).toBe(false);
    expect(isCurrentAttempt(second.map, 'set-1', second.seq)).toBe(true);
  });

  it('settles two different records independently', () => {
    const a = beginSync(empty, 'set-1');
    const b = beginSync(a.map, 'set-2');
    // Set 2 returns first — set 1 must be unaffected.
    const afterB = settleSync(b.map, 'set-2', b.seq, 'success');
    expect(isSaving(afterB, 'set-1')).toBe(true);
    expect(syncStateOf(afterB, 'set-2')).toBe('idle');

    const afterA = settleSync(afterB, 'set-1', a.seq, 'success');
    expect(hasUnsettledWrites(afterA)).toBe(false);
  });
});

describe('hasUnsettledWrites', () => {
  it('is false when nothing is in flight', () => {
    expect(hasUnsettledWrites(empty)).toBe(false);
  });

  it('is true while a write is in flight', () => {
    expect(hasUnsettledWrites(beginSync(empty, 'set-1').map)).toBe(true);
  });

  it('is true for an unretried failure, which is unsaved data too', () => {
    /* Finish Workout must not complete a session over the top of a failed
       write and silently lose it. */
    const { map, seq } = beginSync(empty, 'set-1');
    expect(hasUnsettledWrites(settleSync(map, 'set-1', seq, 'error'))).toBe(true);
  });
});
