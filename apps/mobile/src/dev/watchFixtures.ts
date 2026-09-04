import type { SessionWatchWorkout } from '@setframe/schemas';

/**
 * Fixtures for the Watch cards, shared by the galleries that show them.
 *
 * They live here rather than in one gallery because the cards appear in two
 * places: on their own, and inside the workout logger's post-completion
 * block, which is where a user actually meets them. Two copies of an hour of
 * heart-rate data would drift apart.
 */
/* A lifter's trace: sets drive it up, rests let it fall back. Deliberately
   low-frequency — the chart buckets to 25 bars by PEAK, so a fast sine
   would put a near-maximum in every bucket and render as a flat ramp,
   which is not what an hour of lifting looks like. */
export const SERIES = (() => {
  const offsets: number[] = [];
  const values: number[] = [];
  const SETS = 14;
  const period = 384 / SETS;
  for (let i = 0; i < 384; i += 1) {
    offsets.push(i * 10);
    const phase = (i % period) / period;
    // Ramp up hard through the set, decay through the rest.
    const effort = phase < 0.45 ? phase / 0.45 : Math.max(0, 1 - (phase - 0.45) / 0.4);
    const drift = (i / 384) * 14; // cardiac drift over the hour
    values.push(Math.round(96 + effort * 62 + drift));
  }
  return { offsets, values };
})();

export const WORKOUT: SessionWatchWorkout = {
  id: 'w1',
  sessionId: 's1',
  externalId: 'hk-lift',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: '2026-09-01T17:32:00.000Z',
  endedAt: '2026-09-01T18:36:00.000Z',
  durationSeconds: 3840,
  activeEnergyKcal: 612,
  totalEnergyKcal: 842,
  avgHeartRateBpm: Math.round(SERIES.values.reduce((n, v) => n + v, 0) / SERIES.values.length),
  peakHeartRateBpm: Math.max(...SERIES.values),
  minHeartRateBpm: Math.min(...SERIES.values),
  distanceValue: null,
  distanceUnit: null,
  deviceName: 'Series 9',
  createdAt: '2026-09-01T18:40:00.000Z',
  updatedAt: '2026-09-01T18:40:00.000Z',
};

export const EFFORTS = [
  { exerciseName: 'Bench Press', avgBpm: 158, peakBpm: 174, setCount: 3 },
  { exerciseName: 'Incline DB Press', avgBpm: 149, peakBpm: 163, setCount: 3 },
  { exerciseName: 'Overhead Press', avgBpm: 141, peakBpm: 157, setCount: 3 },
  { exerciseName: 'Cable Fly', avgBpm: 126, peakBpm: 138, setCount: 3 },
  { exerciseName: 'Triceps Pushdown', avgBpm: 116, peakBpm: 127, setCount: 2 },
];

export const CANDIDATES = [
  {
    relation: 'overlaps' as const,
    workout: {
      externalId: 'hk-lift',
      appleType: 50,
      activityType: 'other' as const,
      title: 'Traditional Strength Training',
      startedAt: '2026-09-01T17:32:00.000Z',
      endedAt: '2026-09-01T18:36:00.000Z',
      durationSeconds: 3840,
      distanceValue: null,
      distanceUnit: null,
      caloriesKcal: 612,
      avgHeartRateBpm: 142,
      peakHeartRateBpm: 171,
    },
  },
  {
    relation: 'after' as const,
    workout: {
      externalId: 'hk-run',
      appleType: 37,
      activityType: 'run' as const,
      title: 'Run',
      startedAt: '2026-09-01T18:41:00.000Z',
      endedAt: '2026-09-01T19:03:00.000Z',
      durationSeconds: 1320,
      distanceValue: 2.4,
      distanceUnit: 'mi' as const,
      caloriesKcal: 268,
      avgHeartRateBpm: 156,
      peakHeartRateBpm: 178,
    },
  },
];
