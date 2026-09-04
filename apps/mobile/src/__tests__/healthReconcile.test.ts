import { planReconcileDays, shiftDays, toDayPayload, batchDays } from '../healthkit/reconcile';
import type { AppleHealthDayStatus } from '@setframe/schemas';

const status = (localDate: string, syncStatus: AppleHealthDayStatus['syncStatus']): AppleHealthDayStatus => ({
  localDate, syncStatus, syncedThrough: null, reconciledAt: null,
});

const base = { today: '2026-09-10', windowDays: 7, backfillDays: 30, neverSynced: false };

describe('planning a foreground reconcile', () => {
  it('always takes today and yesterday', () => {
    // Today is still accruing; yesterday is where late Watch and
    // MyFitnessPal writes land.
    const days = planReconcileDays({ ...base, known: [status('2026-09-10', 'complete'), status('2026-09-09', 'complete')] });
    expect(days).toContain('2026-09-10');
    expect(days).toContain('2026-09-09');
  });

  it('leaves settled days alone', () => {
    const known = Array.from({ length: 8 }, (_, i) => status(shiftDays('2026-09-10', -i), 'complete'));
    const days = planReconcileDays({ ...base, known });
    // Only the two that are always re-read.
    expect(days).toEqual(['2026-09-10', '2026-09-09']);
  });

  it('re-reads a day the server could not settle', () => {
    const known = Array.from({ length: 8 }, (_, i) => status(shiftDays('2026-09-10', -i), 'complete'));
    known[4] = status(shiftDays('2026-09-10', -4), 'stale');
    const days = planReconcileDays({ ...base, known });
    expect(days).toContain('2026-09-06');
  });

  it('does not re-read a day that genuinely held nothing', () => {
    // Re-querying an empty Tuesday on every foreground is a battery bug.
    const known = Array.from({ length: 8 }, (_, i) => status(shiftDays('2026-09-10', -i), 'complete'));
    known[3] = status(shiftDays('2026-09-10', -3), 'missing');
    const days = planReconcileDays({ ...base, known });
    expect(days).not.toContain('2026-09-07');
  });

  it('reads a day the server has never heard of', () => {
    const days = planReconcileDays({ ...base, known: [] });
    expect(days).toHaveLength(8); // today + 7 back
  });

  it('reaches back further on a first run, so Trends has history at once', () => {
    const days = planReconcileDays({ ...base, known: [], neverSynced: true });
    expect(days).toHaveLength(31); // today + 30 back
    expect(days[0]).toBe('2026-09-10');
    expect(days.at(-1)).toBe('2026-08-11');
  });

  it('returns newest first, so an interrupted run covers what matters', () => {
    const days = planReconcileDays({ ...base, known: [] });
    expect(days).toEqual([...days].sort((a, b) => (a < b ? 1 : -1)));
  });
});

describe('turning a snapshot into a day payload', () => {
  const snapshot = {
    daily: { steps: 8000, activeEnergyKcal: 500, exerciseMinutes: 30, caloriesConsumedKcal: 2100, proteinG: 150, carbsG: 200, fatG: 70 },
    recovery: { sleepMinutes: 430, hrvMs: 61, restingHeartRateBpm: 54, vo2Max: 44.2, vo2MaxAt: null },
    body: { weightKg: 80.4, heightCm: null, bodyFatPercent: 18.1, biologicalSex: null, dateOfBirth: null, ageYears: null },
    nutritionSource: 'MyFitnessPal',
  } as never;

  it('carries nulls rather than dropping them', () => {
    // A dropped null leaves the day unsettleable, and the sweep re-queries
    // it forever.
    const empty = {
      daily: { steps: null, activeEnergyKcal: null, exerciseMinutes: null, caloriesConsumedKcal: null, proteinG: null, carbsG: null, fatG: null },
      recovery: { sleepMinutes: null, hrvMs: null, restingHeartRateBpm: null, vo2Max: null, vo2MaxAt: null },
      body: { weightKg: null, heightCm: null, bodyFatPercent: null, biologicalSex: null, dateOfBirth: null, ageYears: null },
      nutritionSource: null,
    } as never;
    const payload = toDayPayload('2026-09-01', empty, { today: '2026-09-10' });
    expect(payload.activity).toHaveProperty('steps', null);
    expect(payload.activity).toHaveProperty('restingHeartRate', null);
  });

  it('maps every metric Trends charts', () => {
    const payload = toDayPayload('2026-09-01', snapshot, { today: '2026-09-10' });
    expect(payload.activity).toMatchObject({
      steps: 8000, activeEnergyKcal: 500, exerciseMinutes: 30,
      restingHeartRate: 54, hrvSdnnMs: 61, vo2Max: 44.2,
      weightKg: 80.4, bodyFatPercentage: 18.1, sleepTotalMinutes: 430,
    });
  });

  it('covers a finished day to its end, and today only to now', () => {
    const now = new Date('2026-09-10T14:00:00');
    const past = toDayPayload('2026-09-01', snapshot, { today: '2026-09-10', now });
    expect(past.syncedThrough).toBe(new Date(2026, 8, 1, 23, 59, 59, 999).toISOString());

    const today = toDayPayload('2026-09-10', snapshot, { today: '2026-09-10', now });
    expect(today.syncedThrough).toBe(now.toISOString());
  });
});

describe('batching', () => {
  it('never exceeds what the endpoint accepts', () => {
    const days = Array.from({ length: 31 }, (_, i) => i);
    const batches = batchDays(days, 30);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(30);
    expect(batches[1]).toHaveLength(1);
  });
});
