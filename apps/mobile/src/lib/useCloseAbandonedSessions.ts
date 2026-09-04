import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { useApiClient } from './api-client';

type ApiClient = ReturnType<typeof useApiClient>;

export interface AbandonedSessionCandidate {
  id: string;
  localDate: string;
  status: string;
  startedAt?: string | null;
  /**
   * ISO timestamp of the last set logged, or null when nothing was.
   *
   * Not on the list response — it comes from reading the session's own
   * detail. See `describeSession`.
   */
  lastSetAt?: string | null;
  /**
   * How many sets were actually logged.
   *
   * `undefined` is not "none": it means we have not looked yet, and the
   * difference decides whether a session is completed or deleted. It is
   * therefore required, not optional — an earlier version read it straight
   * off the list response, where it does not exist, so every candidate
   * arrived as `undefined`, compared false against `> 0`, and would have
   * been deleted along with every set in it.
   */
  loggedSetCount: number;
}

export interface ClosedSessionSummary {
  id: string;
  localDate: string;
  loggedSetCount: number;
  exerciseCount: number;
}

export interface SessionDetail {
  exercises?: { sets?: { performedAt?: string | null; createdAt?: string | null }[] }[];
}

/**
 * What a session actually contains, from its detail response.
 *
 * Separate and pure because the list endpoint carries neither figure, and
 * getting that wrong is not a cosmetic bug: `loggedSetCount` decides
 * between completing a session and deleting it.
 */
export function summariseSessionDetail(detail: SessionDetail): {
  loggedSetCount: number;
  lastSetAt: string | null;
} {
  const sets = (detail.exercises ?? []).flatMap((e) => e.sets ?? []);
  const stamps = sets
    .map((set) => set.performedAt ?? set.createdAt ?? null)
    .filter((v): v is string => typeof v === 'string')
    .sort();
  return { loggedSetCount: sets.length, lastSetAt: stamps.length ? stamps[stamps.length - 1]! : null };
}

/**
 * Should this session be closed, and how?
 *
 * Split out from the effect so the rule is testable without an AppState
 * event, a query client and a rendered screen. See ADR 0014.
 */
export function resolveAbandonedSession(
  session: AbandonedSessionCandidate,
  today: string,
): 'ignore' | 'complete' | 'delete' {
  if (session.status !== 'in_progress') return 'ignore';
  /* The boundary is the local date rolling in the session's own timezone,
     not elapsed hours. A session started at 23:00 and still being logged at
     00:30 is on its own day until that date changes. */
  if (session.localDate >= today) return 'ignore';
  /* An empty session would put a workout in the record containing no work,
     and would mark the day trained in the week strip. */
  return session.loggedSetCount > 0 ? 'complete' : 'delete';
}

/**
 * Closes a session the user walked away from, on the next foreground.
 *
 * People do not reliably tap Finish — they rack the last set and put the
 * phone in a bag. The session stays `in_progress`, which makes *today*
 * render as "Resume workout" for a workout that ended yesterday, stops the
 * week strip marking that day, and blocks the next day's session because a
 * date cannot hold two.
 *
 * ADR 0014 covers why this is a deliberate exception to ADR 0009: it does
 * not invent a record, it finalizes one the user created, discards nothing,
 * says so, and is reversible.
 */
export function useCloseAbandonedSessions(
  api: ApiClient,
  today: string,
  onClosed: (summary: ClosedSessionSummary) => void,
) {
  const queryClient = useQueryClient();
  /* Two foreground events in the same second must not double-apply. */
  const inFlight = useRef(new Set<string>());

  const close = useMutation({
    mutationFn: async (session: AbandonedSessionCandidate) => {
      const action = resolveAbandonedSession(session, today);
      if (action === 'ignore') return null;
      if (action === 'delete') {
        await api.del(`/workout-sessions/${session.id}`);
        return null;
      }
      await api.post(`/workout-sessions/${session.id}/complete`, {
        /* The user finished when they stopped logging. Stamping the moment
           of closing would record them training the next morning. */
        completedAt: session.lastSetAt ?? undefined,
      });
      return session;
    },
    onError: () => {
      /* Deliberately silent, and the one case where that is right: the user
         did not ask for this and is not waiting on it. The session is still
         open, `today` still renders from the server's copy, and the next
         foreground tries again. Telling someone their forgotten workout
         failed to close would be noise about a problem they cannot act on.
         Every *user-initiated* mutation still reports — see
         mutationFeedback.test.ts, which exists because fourteen did not. */
    },
    onSettled: (_data, _error, session) => {
      inFlight.current.delete(session.id);
    },
  });

  useEffect(() => {
    /**
     * The list endpoint answers `{ items, nextCursor }` and carries no set
     * data, so each candidate is read individually to find out what is in
     * it. There is at most one open session per date and this runs on
     * foreground, so the cost is a request for a session that is about to
     * be closed anyway.
     */
    async function describeSession(row: {
      id: string;
      localDate: string;
      status: string;
      startedAt?: string | null;
    }): Promise<AbandonedSessionCandidate | null> {
      try {
        const detail = await api.get<SessionDetail>(`/workout-sessions/${row.id}`);
        return { ...row, ...summariseSessionDetail(detail) };
      } catch {
        return null;
      }
    }

    async function sweep() {
      let rows: { id: string; localDate: string; status: string; startedAt?: string | null }[];
      try {
        const response = await api.get<{
          items: { id: string; localDate: string; status: string; startedAt?: string | null }[];
        }>('/workout-sessions?status=in_progress');
        rows = response.items ?? [];
      } catch {
        /* A failed sweep is not worth surfacing — the session is still there
           and the next foreground tries again. */
        return;
      }
      for (const row of rows) {
        if (inFlight.current.has(row.id)) continue;
        /* Cheap check before the detail read: most foregrounds have nothing
           to do, and today's own open session is the common case. */
        if (row.status !== 'in_progress' || row.localDate >= today) continue;
        const session = await describeSession(row);
        /* Could not read it — do nothing rather than guess. Deleting on an
           unknown set count is how a logged workout disappears. */
        if (!session) continue;
        const action = resolveAbandonedSession(session, today);
        if (action === 'ignore') continue;
        inFlight.current.add(session.id);
        try {
          const closed = await close.mutateAsync(session);
          if (closed) {
            onClosed({
              id: closed.id,
              localDate: closed.localDate,
              loggedSetCount: closed.loggedSetCount,
              exerciseCount: 0,
            });
          }
          await queryClient.invalidateQueries({ queryKey: ['today', today] });
        } catch {
          /* Same reasoning: leave it open and try again next time. */
        }
      }
    }

    void sweep();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void sweep();
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
}
