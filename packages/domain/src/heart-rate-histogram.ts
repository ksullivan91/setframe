import type { ZoneBand } from './heart-rate-zones';

/**
 * Minutes spent at each heart rate, bucketed.
 *
 * Persisted per day instead of zone minutes, because zone boundaries are
 * derived from resting and max heart rate and both drift. Stored zone
 * minutes are frozen under the model of the day they were computed, so a
 * long series silently compares different boundaries and cannot be
 * corrected — the raw samples are long gone. A histogram makes zones a
 * read-time view. See docs/design/heart-rate-zone-trends.md §3.
 */
export interface HeartRateHistogram {
  /** Self-describing, so a stored row needs no external constants to read. */
  bucketWidthBpm: number;
  minBpm: number;
  /** Minutes in each bucket, ascending from `minBpm`. */
  minutes: number[];
  attribution: {
    source: 'exerciseTime' | 'workouts';
    /** Longest gap between samples that still counts as continuous. */
    maxGapSeconds: number;
    version: number;
  };
}

export const HISTOGRAM_BUCKET_BPM = 5;
export const HISTOGRAM_MIN_BPM = 40;
export const HISTOGRAM_MAX_BPM = 220;
export const HISTOGRAM_VERSION = 1;
const BUCKET_COUNT = Math.ceil((HISTOGRAM_MAX_BPM - HISTOGRAM_MIN_BPM) / HISTOGRAM_BUCKET_BPM);

export function emptyHistogram(
  attribution: HeartRateHistogram['attribution'],
): HeartRateHistogram {
  return {
    bucketWidthBpm: HISTOGRAM_BUCKET_BPM,
    minBpm: HISTOGRAM_MIN_BPM,
    minutes: new Array<number>(BUCKET_COUNT).fill(0),
    attribution,
  };
}

/** The bucket a reading falls in, clamped at both ends. */
export function bucketIndexFor(bpm: number, histogram: Pick<HeartRateHistogram, 'bucketWidthBpm' | 'minBpm' | 'minutes'>): number {
  const raw = Math.floor((bpm - histogram.minBpm) / histogram.bucketWidthBpm);
  /* Clamped rather than dropped: a reading of 35 or 240 is a real
     measurement of a real person, and discarding it would quietly shorten
     their total active minutes. */
  return Math.min(Math.max(raw, 0), histogram.minutes.length - 1);
}

export interface HeartRateSample {
  /** Seconds from an arbitrary origin; only differences matter. */
  at: number;
  bpm: number;
}

/**
 * Accumulate samples into a histogram.
 *
 * Each sample owns the time until the next one, capped at `maxGapSeconds` —
 * a watch taken off must not attribute eight hours to its last reading. The
 * final sample owns nothing, having no successor to bound it.
 */
export function accumulateSamples(
  histogram: HeartRateHistogram,
  samples: readonly HeartRateSample[],
  maxGapSeconds: number,
): HeartRateHistogram {
  for (let i = 0; i < samples.length - 1; i += 1) {
    const sample = samples[i];
    const next = samples[i + 1];
    if (!sample || !next) continue;
    const gap = next.at - sample.at;
    if (gap <= 0 || gap > maxGapSeconds) continue;
    if (!Number.isFinite(sample.bpm) || sample.bpm <= 0) continue;
    const index = bucketIndexFor(sample.bpm, histogram);
    histogram.minutes[index] = (histogram.minutes[index] ?? 0) + gap / 60;
  }
  return histogram;
}

/** Round every bucket, so a stored row is not forty decimals of noise. */
export function roundHistogram(histogram: HeartRateHistogram): HeartRateHistogram {
  return {
    ...histogram,
    minutes: histogram.minutes.map((m) => Math.round(m * 10) / 10),
  };
}

export function histogramTotalMinutes(histogram: HeartRateHistogram): number {
  return histogram.minutes.reduce((sum, m) => sum + m, 0);
}

/**
 * Slice a histogram into zone minutes, under the model given now.
 *
 * A bucket is attributed by its midpoint, so a bucket straddling a zone edge
 * lands wholly on one side. At 5 bpm that is at most a 2.5 bpm error on one
 * bucket per boundary — far smaller than the uncertainty in an age-estimated
 * maximum heart rate, and it keeps the sum of the zones equal to the total.
 */
export function zoneMinutesFromHistogram(
  histogram: HeartRateHistogram,
  bands: readonly ZoneBand[],
): number[] {
  const totals = bands.map(() => 0);
  if (bands.length === 0) return totals;

  histogram.minutes.forEach((minutes, index) => {
    if (minutes <= 0) return;
    const midpoint =
      histogram.minBpm + index * histogram.bucketWidthBpm + histogram.bucketWidthBpm / 2;
    const bandIndex = bands.findIndex(
      (band) => midpoint >= band.fromBpm && (band.toBpm == null || midpoint <= band.toBpm),
    );
    /* Bands tile [0, ∞), so this resolves for any real reading. Falling back
       to the top band rather than dropping the minutes keeps the zone sum
       equal to the histogram total. */
    const target = bandIndex === -1 ? bands.length - 1 : bandIndex;
    totals[target] = (totals[target] ?? 0) + minutes;
  });

  return totals.map((m) => Math.round(m));
}

/** Sum several days into one histogram. Shapes must match. */
export function mergeHistograms(
  histograms: readonly HeartRateHistogram[],
): HeartRateHistogram | null {
  const first = histograms[0];
  if (!first) return null;
  const merged = emptyHistogram(first.attribution);
  for (const histogram of histograms) {
    if (
      histogram.bucketWidthBpm !== merged.bucketWidthBpm ||
      histogram.minBpm !== merged.minBpm
    ) {
      /* A row written under a different bucketing cannot be added without
         re-bucketing it, and silently mixing the two would corrupt the
         series. Skipped and visible in the version, rather than wrong. */
      continue;
    }
    histogram.minutes.forEach((m, i) => {
      merged.minutes[i] = (merged.minutes[i] ?? 0) + m;
    });
  }
  return merged;
}
