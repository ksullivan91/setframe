import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { AppleHealthDay, AppleHealthDayStatus } from '@setframe/schemas';
import { healthKit, type HealthSnapshot } from './HealthKitAdapter';
import { useApiClient } from '../lib/api-client';
import { batchDays, localDateKey, planReconcileDays, shiftDays, toDayPayload } from './reconcile';

/** A day we could not read. Shape only; every value null. */
const EMPTY: HealthSnapshot = {
  daily: {
    steps: null, activeEnergyKcal: null, exerciseMinutes: null,
    caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null,
  },
  recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null, vo2Max: null, vo2MaxAt: null },
  body: {
    weightKg: null, heightCm: null, bodyFatPercent: null,
    biologicalSex: null, dateOfBirth: null, ageYears: null,
  },
  nutritionSource: null,
};

/** How far back the rolling self-heal reaches on an ordinary foreground. */
const WINDOW_DAYS = 7;
/** How far back the one-off first-run backfill reaches. */
const BACKFILL_DAYS = 30;

/**
 * Sends what HealthKit knows to the server, on every foreground.
 *
 * This did not exist. `daily_activity_summary` is written by exactly one
 * thing — `POST /v1/integrations/apple-health/reconcile` — and nothing in
 * the app had ever called it, so every metric on Trends read "Nothing
 * recorded yet" except the weight the user types by hand. Log looked fine
 * throughout because it reads HealthKit on the device; the data had simply
 * never crossed to the server.
 *
 * Background delivery is a freshness optimisation; this is the correctness
 * mechanism (architecture §5). It is deliberately cheap on a normal run:
 * today and yesterday always, plus only those days the server says it could
 * not settle.
 */
export function useHealthReconciler(): { reconcileNow: () => Promise<void> } {
  const api = useApiClient();
  const queryClient = useQueryClient();
  /* One run at a time. Foreground and focus can fire within a frame of each
     other, and two concurrent sweeps would read HealthKit twice for the
     same days and race each other's writes. */
  const running = useRef(false);

  const reconcileNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const connection = await healthKit.getConnectionState();
      /* Nothing to send, and nothing to record as a failure — the user has
         not granted access, which is their right, not an error. */
      if (connection !== 'asked' && connection !== 'error') return;

      const today = localDateKey(new Date());
      const from = shiftDays(today, -BACKFILL_DAYS);

      let known: AppleHealthDayStatus[] = [];
      let knownIsTrustworthy = true;
      try {
        const response = await api.get<{ days: AppleHealthDayStatus[] }>(
          `/integrations/apple-health/days?from=${from}&to=${today}`,
        );
        known = response.days ?? [];
      } catch {
        /* Unreachable server. Distinct from "the server has nothing": an
           empty answer means backfill, a failed one must not, or a period of
           server trouble would re-read a month from HealthKit on every
           foreground. Fall back to the rolling window. */
        knownIsTrustworthy = false;
      }

      const dates = planReconcileDays({
        today,
        known,
        windowDays: WINDOW_DAYS,
        backfillDays: BACKFILL_DAYS,
        neverSynced: knownIsTrustworthy && known.length === 0,
      });

      const payloads: AppleHealthDay[] = [];
      for (const localDate of dates) {
        try {
          const snapshot = await healthKit.getSnapshot(localDate);
          payloads.push(toDayPayload(localDate, snapshot, { today }));
        } catch {
          /* Report the failure rather than skipping the day, so the server
             records it as `error` and the next sweep picks it up again. A
             skipped day is indistinguishable from a day with no data. */
          payloads.push({
            ...toDayPayload(localDate, EMPTY, { today }),
            outcome: 'error',
            activity: null,
            nutrition: null,
          });
        }
      }

      if (payloads.length === 0) return;
      for (const batch of batchDays(payloads, 30)) {
        await api.post('/integrations/apple-health/reconcile', { days: batch });
      }

      /* Trends reads the server, so it has to be told the server changed. */
      await queryClient.invalidateQueries({ queryKey: ['trends'] });
    } catch {
      /* A failed sweep is not worth interrupting the user for: the next
         foreground runs it again, and nothing the user did has been lost. */
    } finally {
      running.current = false;
    }
  }, [api, queryClient]);

  useEffect(() => {
    void reconcileNow();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void reconcileNow();
    });
    return () => subscription.remove();
  }, [reconcileNow]);

  return { reconcileNow };
}
