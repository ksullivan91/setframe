import type { AppleHealthDay, AppleHealthDayStatus } from '@setframe/schemas';
import { needsResync, type HeartRateHistogram } from '@setframe/domain';
import type { HealthSnapshot } from './HealthKitAdapter';

/** `YYYY-MM-DD` in the device's own zone. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDays(localDate: string, delta: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return localDateKey(new Date(y, m - 1, d + delta));
}

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Turn one day's HealthKit snapshot into the wire shape.
 *
 * Nulls are carried rather than dropped. "We read this day and there was no
 * resting heart rate" has to reach the server, or the day can never settle
 * and the sweep re-queries it forever.
 */
export function toDayPayload(
  localDate: string,
  snapshot: HealthSnapshot,
  options: { today: string; now?: Date; histogram?: HeartRateHistogram | null } = {
    today: localDate,
  },
): AppleHealthDay {
  const now = options.now ?? new Date();
  const isToday = localDate === options.today;
  /* Today's read covers up to this moment; a finished day's covers all of
     it. The server compares this against the day's end to decide whether
     the day is settled — see deriveDayStatus. */
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const syncedThrough = isToday ? now : new Date(y, m - 1, d, 23, 59, 59, 999);

  return {
    localDate,
    timezone: localTimezone(),
    syncedThrough: syncedThrough.toISOString(),
    outcome: 'ok',
    activity: {
      steps: snapshot.daily.steps,
      activeEnergyKcal: snapshot.daily.activeEnergyKcal,
      exerciseMinutes: snapshot.daily.exerciseMinutes,
      restingHeartRate: snapshot.recovery.restingHeartRateBpm,
      hrvSdnnMs: snapshot.recovery.hrvMs,
      vo2Max: snapshot.recovery.vo2Max,
      weightKg: snapshot.body.weightKg,
      bodyFatPercentage: snapshot.body.bodyFatPercent,
      sleepTotalMinutes: snapshot.recovery.sleepMinutes,
    },
    nutrition: {
      caloriesKcal: snapshot.daily.caloriesConsumedKcal,
      proteinG: snapshot.daily.proteinG,
      carbsG: snapshot.daily.carbsG,
      fatG: snapshot.daily.fatG,
    },
    sources: snapshot.nutritionSource ? { caloriesKcal: snapshot.nutritionSource } : undefined,
    activeHeartRateHistogram: options.histogram ?? null,
  };
}

export interface PlanOptions {
  /** Today, in the device's zone. */
  today: string;
  /** What the server already holds for the window. */
  known: readonly AppleHealthDayStatus[];
  /** How far back the rolling self-heal reaches. */
  windowDays: number;
  /** How far back a first-run backfill reaches. */
  backfillDays: number;
  /** True until the user has ever reconciled — drives the one-off backfill. */
  neverSynced: boolean;
}

/**
 * Which days this foreground event should read.
 *
 * Architecture §5, made concrete. Today and yesterday always: today is still
 * accruing and yesterday is where late Watch and MyFitnessPal writes land.
 * Beyond that, only days the server says are unsettled — re-reading a
 * settled month on every foreground is how this becomes a battery bug.
 *
 * Newest first. A partial batch that gets interrupted should have filled in
 * the days the user is most likely to be looking at.
 */
export function planReconcileDays(options: PlanOptions): string[] {
  const { today, known, windowDays, backfillDays, neverSynced } = options;
  const byDate = new Map(known.map((day) => [day.localDate, day]));
  const wanted = new Set<string>([today, shiftDays(today, -1)]);

  const reach = neverSynced ? Math.max(backfillDays, windowDays) : windowDays;
  for (let back = 2; back <= reach; back += 1) {
    const date = shiftDays(today, -back);
    const status = byDate.get(date);
    /* Never seen, or seen and still unsettled. A `complete` or `missing`
       day is left alone. */
    if (!status || needsResync(status.syncStatus)) wanted.add(date);
  }

  return [...wanted].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

/** Split into batches the endpoint will accept. */
export function batchDays<T>(days: readonly T[], size = 30): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < days.length; i += size) batches.push(days.slice(i, i + size));
  return batches;
}
