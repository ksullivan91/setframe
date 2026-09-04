import { resolveAbandonedSession, summariseSessionDetail } from '../lib/useCloseAbandonedSessions';

/**
 * ADR 0014. The rule is split out from the effect precisely so it can be
 * tested without an AppState event and a rendered screen.
 */
describe('closing a session the user walked away from', () => {
  const base = { id: 's1', status: 'in_progress', loggedSetCount: 9, lastSetAt: null };

  it('closes a session left open on an earlier day', () => {
    expect(resolveAbandonedSession({ ...base, localDate: '2026-09-02' }, '2026-09-03')).toBe('complete');
  });

  it('leaves today’s session alone, however long it has been open', () => {
    // Started 23:00 and still being logged at 00:30 is the same day until
    // the local date rolls. The boundary is the date, not elapsed hours.
    expect(resolveAbandonedSession({ ...base, localDate: '2026-09-03' }, '2026-09-03')).toBe('ignore');
  });

  it('deletes an abandoned session that logged nothing', () => {
    // Completing it would put a workout with no work in the record, and
    // mark the day trained in the week strip.
    expect(
      resolveAbandonedSession({ ...base, localDate: '2026-09-02', loggedSetCount: 0 }, '2026-09-03'),
    ).toBe('delete');
  });

  it('ignores a session that is already finished', () => {
    expect(
      resolveAbandonedSession({ ...base, localDate: '2026-09-02', status: 'completed' }, '2026-09-03'),
    ).toBe('ignore');
  });

  it('ignores a future-dated session rather than closing it', () => {
    expect(resolveAbandonedSession({ ...base, localDate: '2026-09-04' }, '2026-09-03')).toBe('ignore');
  });
});


describe('the sweep reads what it needs before deciding', () => {
  const src = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    return fs.readFileSync(
      path.join(__dirname, '..', 'lib', 'useCloseAbandonedSessions.ts'),
      'utf8',
    ) as string;
  })();

  it('unwraps the list response instead of iterating it', () => {
    // GET /v1/workout-sessions answers { items, nextCursor }. Iterating that
    // object throws, the catch swallows it, and the sweep silently does
    // nothing forever — which is exactly how it shipped.
    expect(src).toMatch(/response\.items/);
    expect(src).not.toMatch(/api\.get<AbandonedSessionCandidate\[\]>/);
  });

  it('counts sets from a real detail response', () => {
    const summary = summariseSessionDetail({
      exercises: [
        { sets: [{ performedAt: '2026-09-02T18:10:00Z' }, { performedAt: '2026-09-02T18:22:00Z' }] },
        { sets: [{ performedAt: '2026-09-02T19:04:00Z' }] },
      ],
    });
    expect(summary.loggedSetCount).toBe(3);
    // The user finished when they stopped logging (ADR 0014).
    expect(summary.lastSetAt).toBe('2026-09-02T19:04:00Z');
  });

  it('reports nothing logged for a session with no sets', () => {
    expect(summariseSessionDetail({ exercises: [{ sets: [] }] })).toEqual({
      loggedSetCount: 0,
      lastSetAt: null,
    });
    expect(summariseSessionDetail({})).toEqual({ loggedSetCount: 0, lastSetAt: null });
  });

  it('still counts a set that carries no timestamp', () => {
    // A set with neither performedAt nor createdAt is still work done; only
    // the completion stamp is unknown.
    const summary = summariseSessionDetail({ exercises: [{ sets: [{}, {}] }] });
    expect(summary.loggedSetCount).toBe(2);
    expect(summary.lastSetAt).toBeNull();
  });

  it('reads the session detail for the set count', () => {
    /* The list response carries no sets. Reading `loggedSetCount` off it
       gives undefined, `undefined > 0` is false, and every abandoned
       session — sets and all — would be deleted rather than completed. */
    expect(src).toMatch(/\/workout-sessions\/\$\{row\.id\}/);
    // The call site, not merely the function's existence: an earlier version
    // of this test passed while nothing called describeSession at all.
    expect(src).toMatch(/const session = await describeSession\(row\);/);
  });

  it('does nothing at all when the detail cannot be read', () => {
    // Deleting on an unknown set count is how a logged workout disappears.
    expect(src).toMatch(/if \(!session\) continue;/);
  });

  it('never deletes a session it has not counted', () => {
    // The type makes the omission impossible to reintroduce quietly.
    expect(src).toMatch(/loggedSetCount: number;/);
    expect(src).not.toMatch(/loggedSetCount\?: number/);
  });
});
