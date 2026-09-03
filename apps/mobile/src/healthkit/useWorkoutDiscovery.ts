import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { healthKit } from './HealthKitAdapter';
import { dismissWorkout, loadDismissedWorkouts } from './dismissed-workouts';
import {
  partitionWorkouts,
  type DiscoveredWorkout,
  type LoggedSession,
  type SuppressedWorkout,
} from './workout-discovery';

export interface WorkoutDiscovery {
  /** null while we are still asking; false means workouts were never shared. */
  canRead: boolean | null;
  suggestions: DiscoveredWorkout[];
  suppressed: SuppressedWorkout[];
  dismiss: (externalId: string) => void;
  /** Shows Apple's sheet for the types not yet asked about, then re-reads. */
  grant: () => Promise<void>;
  granting: boolean;
  refresh: () => Promise<void>;
}

/**
 * Story 44 — find today's Apple Health workouts and decide which to offer.
 *
 * Re-reads on focus and on foreground for the same reason the health card
 * does: Apple's sheet never moves AppState, and coming back from the Health
 * app never remounts Today.
 */
export function useWorkoutDiscovery({
  localDate,
  sessions,
  importedExternalIds,
  enabled = true,
}: {
  localDate: string;
  sessions: LoggedSession[];
  importedExternalIds: readonly string[];
  /**
   * False when the screen is showing a day other than the device's today.
   *
   * `healthKit.getTodayWorkouts()` takes no date — it is always the current
   * day. Reading it while a past date is on screen offers workouts that
   * happened today as though they belonged to that day.
   */
  enabled?: boolean;
}): WorkoutDiscovery {
  const [canRead, setCanRead] = useState<boolean | null>(null);
  const [workouts, setWorkouts] = useState<DiscoveredWorkout[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [granting, setGranting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const read = useCallback(async () => {
    if (!enabled) {
      setCanRead(false);
      setWorkouts([]);
      return;
    }
    const allowed = await healthKit.canReadWorkouts();
    if (!mounted.current) return;
    setCanRead(allowed);
    // Dismissals are loaded regardless: they must survive the app being
    // closed and reopened, which is the whole reason they are on disk.
    const stored = await loadDismissedWorkouts(localDate);
    if (!mounted.current) return;
    setDismissedIds(stored);
    if (!allowed) {
      setWorkouts([]);
      return;
    }
    const found = await healthKit.getTodayWorkouts();
    if (!mounted.current) return;
    setWorkouts(found);
  }, [localDate]);

  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void read();
    });
    return () => subscription.remove();
  }, [read]);

  const dismiss = useCallback(
    (externalId: string) => {
      // Optimistic so the row leaves immediately, then written through.
      setDismissedIds((prev) => (prev.includes(externalId) ? prev : [...prev, externalId]));
      void dismissWorkout(localDate, externalId).then((ids) => {
        if (mounted.current) setDismissedIds(ids);
      });
    },
    [localDate],
  );

  const grant = useCallback(async () => {
    setGranting(true);
    try {
      await healthKit.requestAuthorization();
      await read();
    } finally {
      if (mounted.current) setGranting(false);
    }
  }, [read]);

  const { suggestions, suppressed } = useMemo(
    () => partitionWorkouts(workouts, sessions, { dismissedIds, importedExternalIds }),
    [workouts, sessions, dismissedIds, importedExternalIds],
  );

  return { canRead, suggestions, suppressed, dismiss, grant, granting, refresh: read };
}
