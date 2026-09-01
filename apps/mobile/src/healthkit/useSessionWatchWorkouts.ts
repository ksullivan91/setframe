import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionWatchWorkout } from '@setframe/schemas';
import { healthKit } from './HealthKitAdapter';
import { overlaps, type DiscoveredWorkout } from './workout-discovery';
import { useApiClient } from '../lib/api-client';

/**
 * Watch workouts attached to one Setframe session (story 45).
 *
 * A workout belongs to a session when it **overlaps** it, or **starts within
 * the window after it ends** — the lift is the overlap, the run and the walk
 * home are the window. Confirmed by the user, never attached silently.
 */

/**
 * How long after a session a Watch workout still counts as part of it.
 *
 * Sixty minutes: long enough for a post-gym run and the walk home, short
 * enough that an evening stroll does not attach itself to a morning lift.
 * One constant, deliberately — this is the number most likely to want
 * changing once it meets real days.
 */
export const ATTACH_WINDOW_SECONDS = 60 * 60;

export interface AttachCandidate {
  workout: DiscoveredWorkout;
  /** How it relates to the session, for the badge. */
  relation: 'overlaps' | 'after';
}

function span(startedAt: string | null, endedAt: string | null) {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(start, end) };
}

/** Which of the day's Watch workouts belong to this session. */
export function candidatesForSession(
  workouts: readonly DiscoveredWorkout[],
  session: { startedAt: string | null; completedAt: string | null },
  attachedExternalIds: readonly string[],
  windowSeconds = ATTACH_WINDOW_SECONDS,
): AttachCandidate[] {
  const sessionSpan = span(session.startedAt, session.completedAt);
  if (!sessionSpan) return [];
  const attached = new Set(attachedExternalIds);

  const out: AttachCandidate[] = [];
  for (const workout of workouts) {
    if (attached.has(workout.externalId)) continue;
    const at = span(workout.startedAt, workout.endedAt);
    if (!at) continue;
    if (overlaps(at, sessionSpan)) {
      out.push({ workout, relation: 'overlaps' });
      continue;
    }
    // Starts after the session ended, inside the window. A workout that
    // finished BEFORE the session began is a separate thing, not part of it.
    const afterBy = (at.start - sessionSpan.end) / 1000;
    if (afterBy >= 0 && afterBy <= windowSeconds) out.push({ workout, relation: 'after' });
  }
  return out.sort((a, b) => a.workout.startedAt.localeCompare(b.workout.startedAt));
}

/**
 * `onError` is required rather than optional. A default no-op would let a
 * failed attach look identical to a control that was never wired up, which
 * is the exact class of defect the mutation audit found fourteen of.
 */
export function useSessionWatchWorkouts(
  sessionId: string | null,
  { onError }: { onError: (message: string) => void },
) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const key = ['session-watch-workouts', sessionId];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<{ items: SessionWatchWorkout[] }>(`/workout-sessions/${sessionId}/watch-workouts`),
    enabled: Boolean(sessionId),
  });

  const attached = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const attachedExternalIds = useMemo(() => attached.map((w) => w.externalId), [attached]);

  const attach = useMutation({
    mutationFn: async (workout: DiscoveredWorkout) => {
      /* The series is read at attach time, not at discovery: pulling a
         hundreds-of-samples curve for every candidate the user might
         decline would be work thrown away. */
      const series = await healthKit.getWorkoutHeartRate(
        new Date(workout.startedAt),
        new Date(workout.endedAt),
      );
      return api.post(`/workout-sessions/${sessionId}/watch-workouts`, {
        externalId: workout.externalId,
        activityType: workout.activityType,
        appleActivityType: workout.appleType,
        title: workout.title,
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        durationSeconds: workout.durationSeconds,
        activeEnergyKcal: workout.caloriesKcal,
        /* HealthKit's own statistic wins over a mean of the series: it
           averages every sample the Watch took, while `series` is the copy
           we store. The attach card shows the statistic before you tap, so
           storing the other number would change it under you. Falls back to
           the series when the workout carries no statistic. */
        avgHeartRateBpm:
          workout.avgHeartRateBpm ??
          (series.values.length
            ? Math.round(series.values.reduce((n, v) => n + v, 0) / series.values.length)
            : null),
        peakHeartRateBpm:
          workout.peakHeartRateBpm ?? (series.values.length ? Math.max(...series.values) : null),
        minHeartRateBpm: series.values.length ? Math.min(...series.values) : null,
        distanceValue: workout.distanceValue,
        distanceUnit: workout.distanceUnit,
        series: series.offsets.length
          ? [{ kind: 'heart_rate' as const, offsets: series.offsets, values: series.values }]
          : undefined,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () => onError('Could not attach that Watch workout. Try again.'),
  });

  const detach = useMutation({
    mutationFn: (id: string) => api.del(`/workout-sessions/${sessionId}/watch-workouts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () => onError('Could not remove that Watch workout. Try again.'),
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: key }),
    [queryClient, sessionId],
  );

  return { attached, attachedExternalIds, attach, detach, refresh, isLoading: query.isLoading };
}
