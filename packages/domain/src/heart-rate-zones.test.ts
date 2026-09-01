import { describe, expect, it } from 'vitest';
import {
  effortByExercise,
  estimateMaxHeartRate,
  summariseSeries,
  timeInZone,
  zoneBands,
  zoneOf,
} from './heart-rate-zones';

describe('maximum heart rate', () => {
  it('uses Tanaka rather than 220 minus age', () => {
    // 208 − 0.7 × 34 = 184.2 → 184. The familiar 220 − 34 would say 186.
    expect(estimateMaxHeartRate(34)).toBe(184);
  });

  it('prefers an observed maximum when it exceeds the estimate', () => {
    /* An estimate of 184 is simply wrong for someone HealthKit has recorded
       at 191, and zones built on it would put every hard set in Zone 5. */
    expect(estimateMaxHeartRate(34, 191)).toBe(191);
  });

  it('keeps the estimate when the observed maximum is lower', () => {
    // Never seen working hard is not evidence of a low ceiling.
    expect(estimateMaxHeartRate(34, 150)).toBe(184);
  });

  it('falls back to the observed maximum when age is unknown', () => {
    expect(estimateMaxHeartRate(null, 178)).toBe(178);
    expect(estimateMaxHeartRate(null, null)).toBeNull();
  });
});

describe('zone bands', () => {
  const model = { restingBpm: 54, maxBpm: 186 };

  it('leaves Zone 1 open-ended below', () => {
    /* Resting heart rate is an average, so dipping under it is ordinary —
       and a reading in no band at all would vanish from time-in-zone. */
    const bands = zoneBands(model);
    expect(bands[0]!.fromBpm).toBe(0);
    expect(zoneOf(42, bands)?.zone).toBe(1);
  });

  it('splits by heart-rate reserve, not percentage of max', () => {
    /* Reserve accounts for resting pulse: 50% of reserve for someone
       resting at 54 with a max of 186 is 120, where 50% of max would be 93
       — a number they exceed while asleep. */
    const bands = zoneBands(model);
    expect(bands.find((b) => b.zone === 2)?.fromBpm).toBe(120);
    expect(bands.find((b) => b.zone === 5)?.fromBpm).toBe(166);
  });

  it('leaves no gap and no overlap between bands', () => {
    const bands = zoneBands(model);
    for (let i = 0; i < bands.length - 1; i += 1) {
      expect(bands[i]!.toBpm! + 1).toBe(bands[i + 1]!.fromBpm);
    }
    expect(bands.at(-1)!.toBpm).toBeNull();
  });

  it('places every plausible bpm in exactly one band', () => {
    const bands = zoneBands(model);
    for (let bpm = 40; bpm <= 210; bpm += 1) {
      const matches = bands.filter(
        (b) => bpm >= b.fromBpm && (b.toBpm == null || bpm <= b.toBpm),
      );
      expect(matches).toHaveLength(1);
      expect(zoneOf(bpm, bands)).toEqual(matches[0]);
    }
  });

  it('returns nothing when the reserve is impossible', () => {
    expect(zoneBands({ restingBpm: 190, maxBpm: 186 })).toEqual([]);
  });
});

describe('time in zone', () => {
  const bands = zoneBands({ restingBpm: 54, maxBpm: 186 });

  it('measures each sample by the gap to the next one', () => {
    const series = { offsets: [0, 5, 10, 15], values: [100, 100, 170, 170] };
    const result = timeInZone(series, bands);
    // Three gaps of 5s: two at 100 bpm (Zone 1) and one at 170 (Zone 5).
    // The final sample has no successor and contributes nothing.
    expect(result.find((z) => z.zone === 1)?.seconds).toBe(10);
    expect(result.find((z) => z.zone === 5)?.seconds).toBe(5);
  });

  it('does not credit the last sample with a full interval', () => {
    /* Otherwise the zone a workout happens to end in — usually the cooldown
       — is inflated by one whole gap. */
    const series = { offsets: [0, 5], values: [100, 175] };
    const result = timeInZone(series, bands);
    expect(result.find((z) => z.zone === 5)?.seconds).toBe(0);
  });

  it('discards an implausible gap rather than inventing minutes', () => {
    /* The Watch stops sampling when it loses contact. Treating a
       twenty-minute hole as twenty minutes at the last-seen heart rate is
       fiction, and it would dominate every total. */
    const series = { offsets: [0, 1200, 1205], values: [170, 170, 170] };
    const result = timeInZone(series, bands);
    expect(result.find((z) => z.zone === 5)?.seconds).toBe(5);
  });

  it('totals no more than the elapsed span', () => {
    const series = {
      offsets: Array.from({ length: 60 }, (_, i) => i * 5),
      values: Array.from({ length: 60 }, () => 140),
    };
    const total = timeInZone(series, bands).reduce((n, z) => n + z.seconds, 0);
    expect(total).toBeLessThanOrEqual(series.offsets.at(-1)!);
  });
});

describe('series summary', () => {
  it('reports average, peak and minimum', () => {
    const s = summariseSeries({ offsets: [0, 5, 10], values: [100, 150, 200] });
    expect(s).toEqual({ avgBpm: 150, peakBpm: 200, minBpm: 100, sampleCount: 3 });
  });

  it('reports nothing rather than zero for an empty series', () => {
    // Zero bpm is a claim about the user that no one survives.
    expect(summariseSeries({ offsets: [], values: [] }).avgBpm).toBeNull();
  });
});

describe('effort by exercise', () => {
  const start = '2026-09-01T17:32:00.000Z';
  const at = (seconds: number) => new Date(Date.parse(start) + seconds * 1000).toISOString();
  const series = {
    offsets: Array.from({ length: 240 }, (_, i) => i * 5),
    // Ramps from 100 to ~220 across twenty minutes, so later sets read higher.
    values: Array.from({ length: 240 }, (_, i) => 100 + i),
  };

  it('groups heart rate by the exercise being worked', () => {
    const result = effortByExercise(series, start, [
      { exerciseName: 'Bench Press', performedAt: at(120) },
      { exerciseName: 'Bench Press', performedAt: at(180) },
      { exerciseName: 'Lateral Raise', performedAt: at(900) },
    ]);
    expect(result.map((r) => r.exerciseName)).toEqual(['Lateral Raise', 'Bench Press']);
    expect(result[0]!.avgBpm).toBeGreaterThan(result[1]!.avgBpm);
  });

  it('sorts hardest first, because that is the question', () => {
    const result = effortByExercise(series, start, [
      { exerciseName: 'Early', performedAt: at(60) },
      { exerciseName: 'Late', performedAt: at(1000) },
    ]);
    expect(result[0]!.exerciseName).toBe('Late');
  });

  it('looks back before the set and a little after it', () => {
    /* performedAt marks when the set FINISHED, so the heart rate that
       matters came from the reps just before — and heart rate lags effort,
       so the peak often lands after the bar is racked. */
    const flat = { offsets: [0, 100, 200, 300], values: [90, 90, 170, 90] };
    const result = effortByExercise(flat, start, [
      { exerciseName: 'Squat', performedAt: at(215) },
    ]);
    expect(result[0]!.peakBpm).toBe(170);
  });

  it('omits an exercise whose window caught no samples', () => {
    // A bar at zero bpm is a claim, and a false one.
    const sparse = { offsets: [0, 5], values: [120, 120] };
    const result = effortByExercise(sparse, start, [
      { exerciseName: 'Much Later', performedAt: at(5000) },
    ]);
    expect(result).toEqual([]);
  });

  it('ignores sets that were never placed on the clock', () => {
    /* performedAt cannot be backfilled, so historical sets have none. They
       are skipped rather than assumed to have happened at the start. */
    const result = effortByExercise(series, start, [
      { exerciseName: 'Unknown', performedAt: null },
    ]);
    expect(result).toEqual([]);
  });
});
