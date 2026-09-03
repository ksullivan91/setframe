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
  /** ISO timestamp of the last set logged, or null when nothing was. */
  lastSetAt?: string | null;
  loggedSetCount: number;
}

export interface ClosedSessionSummary {
  id: string;
  localDate: string;
  loggedSetCount: number;
  exerciseCount: number;
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
    async function sweep() {
      let open: AbandonedSessionCandidate[];
      try {
        open = await api.get<AbandonedSessionCandidate[]>('/workout-sessions?status=in_progress');
      } catch {
        /* A failed sweep is not worth surfacing — the session is still there
           and the next foreground tries again. */
        return;
      }
      for (const session of open) {
        if (inFlight.current.has(session.id)) continue;
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
