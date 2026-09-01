import { effortByExercise, estimateMaxHeartRate, summariseSeries } from '@setframe/domain';

/**
 * The join the insights hook performs, exercised through the domain
 * functions it composes.
 *
 * The hook itself is assembly — React state and a query — so the rules
 * worth pinning are the ones that decide what the screen can honestly show.
 */
const series = {
  offsets: Array.from({ length: 200 }, (_, i) => i * 5),
  values: Array.from({ length: 200 }, (_, i) => 110 + (i % 40)),
};

it('takes the observed peak as the ceiling when it beats the estimate', () => {
  const observed = summariseSeries(series).peakBpm;
  expect(observed).toBe(149);
  // Tanaka for 34 is 184, so the estimate still wins here.
  expect(estimateMaxHeartRate(34, observed)).toBe(184);
  // But a genuinely high observation must not be capped by the formula.
  expect(estimateMaxHeartRate(34, 191)).toBe(191);
});

it('produces no effort rows when no set carries a time', () => {
  /* performedAt cannot be backfilled, so every session logged before it
     existed has none. The card must render nothing rather than invent an
     alignment. */
  const result = effortByExercise(series, '2026-09-01T17:32:00.000Z', [
    { exerciseName: 'Bench Press', performedAt: null },
    { exerciseName: 'Incline DB Press', performedAt: null },
  ]);
  expect(result).toEqual([]);
});

it('aligns only the sets that do carry a time', () => {
  const start = '2026-09-01T17:32:00.000Z';
  const at = (s: number) => new Date(Date.parse(start) + s * 1000).toISOString();
  const result = effortByExercise(series, start, [
    { exerciseName: 'Bench Press', performedAt: at(200) },
    { exerciseName: 'Ghost', performedAt: null },
  ]);
  expect(result.map((r) => r.exerciseName)).toEqual(['Bench Press']);
});
