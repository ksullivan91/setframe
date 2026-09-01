import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  effortByExercise,
  estimateMaxHeartRate,
  summariseSeries,
  type ExerciseEffort,
  type HeartRateSeries,
  type ZoneModel,
} from '@setframe/domain';
import type { SessionWatchWorkout, WorkoutSessionDetail } from '@setframe/schemas';
import { healthKit } from './HealthKitAdapter';

/**
 * Turns attached Watch workouts plus the session's own set log into the
 * numbers the completed-workout screen draws.
 *
 * The join lives here rather than in a component so the maths stays in
 * `packages/domain` and this only assembles inputs.
 */
export function useWatchSessionInsights({
  workouts,
  exercises,
}: {
  workouts: readonly SessionWatchWorkout[];
  exercises: WorkoutSessionDetail['exercises'];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /* Resting heart rate and age come from the device, not the session, so
     they are read once and cached rather than fetched per render. Both are
     already granted — they were part of the extended read set before this
     feature existed. */
  const profile = useQuery({
    queryKey: ['health-profile-for-zones'],
    queryFn: () => healthKit.getSnapshot(),
    staleTime: 60 * 60 * 1000,
  });

  /* The longest attached workout carries the session's curve. A four-minute
     walk's heart rate is not the story of an hour of lifting, and stitching
     several curves onto one axis would imply continuity across the gaps
     between them. */
  const primary = useMemo(
    () =>
      workouts.reduce<SessionWatchWorkout | null>(
        (best, w) => (best == null || w.durationSeconds > best.durationSeconds ? w : best),
        null,
      ),
    [workouts],
  );

  const series: HeartRateSeries | null = useMemo(() => {
    const stored = primary?.series?.find((s) => s.kind === 'heart_rate');
    if (!stored || stored.offsets.length === 0) return null;
    return { offsets: stored.offsets, values: stored.values };
  }, [primary]);

  const observedMax = useMemo(
    () => (series ? summariseSeries(series).peakBpm : null),
    [series],
  );

  const model: ZoneModel | null = useMemo(() => {
    const restingBpm = profile.data?.recovery.restingHeartRateBpm ?? null;
    const maxBpm = estimateMaxHeartRate(profile.data?.body.ageYears ?? null, observedMax);
    // Without both, the bands are guesses dressed as measurements.
    if (restingBpm == null || maxBpm == null || maxBpm <= restingBpm) return null;
    return { restingBpm, maxBpm };
  }, [profile.data, observedMax]);

  const maxIsEstimated = useMemo(() => {
    const estimated = estimateMaxHeartRate(profile.data?.body.ageYears ?? null, null);
    return estimated != null && (observedMax == null || estimated >= observedMax);
  }, [profile.data, observedMax]);

  const efforts: ExerciseEffort[] = useMemo(() => {
    if (!series || !primary) return [];
    /* Only sets carrying a `performedAt` can be placed on the clock.
       Historical sets have none — the column cannot be backfilled — so they
       are skipped rather than assumed to have happened at the start. */
    const timed = exercises.flatMap((log) =>
      log.sets
        .filter((set) => set.performedAt != null)
        .map((set) => ({
          exerciseName: log.exercise?.name ?? 'Exercise',
          performedAt: set.performedAt ?? null,
        })),
    );
    if (timed.length === 0) return [];
    return effortByExercise(series, primary.startedAt, timed);
  }, [series, primary, exercises]);

  return {
    series,
    model,
    maxIsEstimated,
    efforts,
    startedAt: primary?.startedAt ?? null,
    endedAt: primary?.endedAt ?? null,
    selectedIndex,
    setSelectedIndex,
  };
}
