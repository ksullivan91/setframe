import { resolveAbandonedSession } from '../lib/useCloseAbandonedSessions';

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
