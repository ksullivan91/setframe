/**
 * Heart-rate zones, time in zone, and the aggregates the completed-workout
 * screen renders (story 45).
 *
 * Zones are **derived, never stored**. HealthKit has no zone type at all —
 * the only `Zone` identifier in its entire surface is `HKTimeZone` — so
 * Apple Watch computes zones for display and never persists them. Keeping
 * the samples and computing the bands means changing the model later
 * re-labels all history instead of stranding it.
 */

/** A heart-rate series as stored: parallel offsets (seconds) and values. */
export interface HeartRateSeries {
  /** Seconds from the workout's start. */
  offsets: readonly number[];
  /** Beats per minute at each offset. */
  values: readonly number[];
}

export interface ZoneModel {
  /** Resting heart rate, from HealthKit where available. */
  restingBpm: number;
  /** Maximum heart rate — see `estimateMaxHeartRate`. */
  maxBpm: number;
}

export interface ZoneBand {
  /** 1–5, ascending in intensity. */
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Inclusive lower bound in bpm. */
  fromBpm: number;
  /** Inclusive upper bound, or null for the open-ended top band. */
  toBpm: number | null;
}

export interface TimeInZone extends ZoneBand {
  seconds: number;
}

/**
 * Tanaka's estimate, `208 − 0.7 × age`.
 *
 * More accurate across adult ages than the familiar `220 − age`, which
 * overestimates for the young and underestimates for the old.
 *
 * An *observed* maximum overrides it when higher: an estimate that says 186
 * is simply wrong for someone HealthKit has recorded at 190, and the zones
 * built on it would put every hard set in Zone 5.
 */
export function estimateMaxHeartRate(
  ageYears: number | null,
  observedMaxBpm: number | null = null,
): number | null {
  const estimated = ageYears != null && ageYears > 0 ? Math.round(208 - 0.7 * ageYears) : null;
  if (estimated == null) return observedMaxBpm;
  if (observedMaxBpm == null) return estimated;
  return Math.max(estimated, observedMaxBpm);
}

/**
 * Zone boundaries by heart-rate **reserve** (Karvonen), not percentage of
 * max.
 *
 * Reserve accounts for resting heart rate, so a fit person with a resting
 * pulse of 48 and an unfit one at 72 do not get the same Zone 2 despite
 * different physiology. The 50/60/70/80/90% steps are the conventional
 * five-zone split.
 */
const RESERVE_STEPS: { zone: ZoneBand['zone']; label: string; from: number }[] = [
  { zone: 1, label: 'Very light', from: 0.0 },
  { zone: 2, label: 'Light', from: 0.5 },
  { zone: 3, label: 'Moderate', from: 0.6 },
  { zone: 4, label: 'Hard', from: 0.7 },
  { zone: 5, label: 'Peak', from: 0.85 },
];

export function zoneBands(model: ZoneModel): ZoneBand[] {
  const reserve = model.maxBpm - model.restingBpm;
  if (!Number.isFinite(reserve) || reserve <= 0) return [];
  const at = (fraction: number) => Math.round(model.restingBpm + reserve * fraction);
  return RESERVE_STEPS.map((step, i) => {
    const next = RESERVE_STEPS[i + 1];
    return {
      zone: step.zone,
      label: step.label,
      /* Zone 1 is open-ended below. Starting it at the resting rate left
         every sub-resting reading in no band at all — and resting heart
         rate is an average, so dipping under it is ordinary. The design
         already says this: Zone 1 renders as "< 124 bpm", not a range. */
      fromBpm: i === 0 ? 0 : at(step.from),
      // Bands are contiguous: each ends one beat below the next begins, so
      // no bpm falls in two zones or in none.
      toBpm: next ? at(next.from) - 1 : null,
    };
  });
}

/** The band a reading falls in. Bands tile [0, ∞), so this always resolves
 *  for a real heart rate. */
export function zoneOf(bpm: number, bands: readonly ZoneBand[]): ZoneBand | null {
  for (let i = bands.length - 1; i >= 0; i -= 1) {
    const band = bands[i]!;
    if (bpm >= band.fromBpm) return band;
  }
  return bands[0] ?? null;
}

/**
 * How long was spent in each zone.
 *
 * A sample's duration is the gap to the *next* sample, so the final reading
 * contributes nothing — it has no successor to measure against. Counting it
 * as a full interval would inflate whichever zone the workout happened to
 * end in, which is usually the cooldown.
 *
 * A gap longer than `maxGapSeconds` is not counted at all: the Watch stops
 * sampling when it loses contact, and treating a twenty-minute hole as
 * twenty minutes at the last-seen heart rate is fiction.
 */
export function timeInZone(
  series: HeartRateSeries,
  bands: readonly ZoneBand[],
  { maxGapSeconds = 60 }: { maxGapSeconds?: number } = {},
): TimeInZone[] {
  const totals = new Map<number, number>();
  for (const band of bands) totals.set(band.zone, 0);

  for (let i = 0; i < series.values.length - 1; i += 1) {
    const bpm = series.values[i];
    const start = series.offsets[i];
    const next = series.offsets[i + 1];
    if (bpm == null || start == null || next == null) continue;
    const gap = next - start;
    if (gap <= 0 || gap > maxGapSeconds) continue;
    const band = zoneOf(bpm, bands);
    if (!band) continue;
    totals.set(band.zone, (totals.get(band.zone) ?? 0) + gap);
  }

  return bands.map((band) => ({ ...band, seconds: totals.get(band.zone) ?? 0 }));
}

export interface SeriesSummary {
  avgBpm: number | null;
  peakBpm: number | null;
  minBpm: number | null;
  sampleCount: number;
}

export function summariseSeries(series: HeartRateSeries): SeriesSummary {
  const values = series.values.filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) {
    return { avgBpm: null, peakBpm: null, minBpm: null, sampleCount: 0 };
  }
  const sum = values.reduce((n, v) => n + v, 0);
  return {
    avgBpm: Math.round(sum / values.length),
    peakBpm: Math.max(...values),
    minBpm: Math.min(...values),
    sampleCount: values.length,
  };
}

/** A set placed on the clock, for aligning heart rate to work. Distinct
 *  from session-to-workout's `PerformedSet`, which is about prescriptions. */
export interface TimedSet {
  exerciseName: string;
  /** When the set was performed. Sets without one cannot be aligned. */
  performedAt: string | null;
}

export interface ExerciseEffort {
  exerciseName: string;
  avgBpm: number;
  peakBpm: number;
  setCount: number;
}

/**
 * Average and peak heart rate while each exercise was being worked.
 *
 * The chart that cannot exist in Apple Health, which has no set log, or in a
 * lifting app, which has no heart rate.
 *
 * A set's window runs from `performedAt` back by `leadSeconds`, because
 * `performedAt` marks when the set *finished* — the heart rate that matters
 * was produced during the reps just before it. Heart rate also lags effort,
 * so the window extends `lagSeconds` past the set to catch the peak that
 * arrives after the bar is racked.
 */
export function effortByExercise(
  series: HeartRateSeries,
  workoutStartedAt: string,
  sets: readonly TimedSet[],
  { leadSeconds = 45, lagSeconds = 20 }: { leadSeconds?: number; lagSeconds?: number } = {},
): ExerciseEffort[] {
  const start = new Date(workoutStartedAt).getTime();
  if (!Number.isFinite(start)) return [];

  const byExercise = new Map<string, { values: number[]; setCount: number }>();

  for (const set of sets) {
    if (!set.performedAt) continue;
    const at = new Date(set.performedAt).getTime();
    if (!Number.isFinite(at)) continue;
    const centre = (at - start) / 1000;
    const from = centre - leadSeconds;
    const to = centre + lagSeconds;

    const entry = byExercise.get(set.exerciseName) ?? { values: [], setCount: 0 };
    entry.setCount += 1;
    for (let i = 0; i < series.offsets.length; i += 1) {
      const offset = series.offsets[i];
      const bpm = series.values[i];
      if (offset == null || bpm == null) continue;
      if (offset >= from && offset <= to) entry.values.push(bpm);
    }
    byExercise.set(set.exerciseName, entry);
  }

  const out: ExerciseEffort[] = [];
  for (const [exerciseName, entry] of byExercise) {
    // An exercise whose window caught no samples is omitted rather than
    // shown at zero — a bar of zero bpm is a claim, and a false one.
    if (entry.values.length === 0) continue;
    const sum = entry.values.reduce((n, v) => n + v, 0);
    out.push({
      exerciseName,
      avgBpm: Math.round(sum / entry.values.length),
      peakBpm: Math.max(...entry.values),
      setCount: entry.setCount,
    });
  }
  // Hardest first: the question this chart answers is "what cost me most".
  return out.sort((a, b) => b.avgBpm - a.avgBpm);
}
