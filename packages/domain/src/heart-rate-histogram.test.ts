import { describe, it, expect } from 'vitest';
import {
  accumulateSamples, bucketIndexFor, emptyHistogram, histogramTotalMinutes,
  mergeHistograms, roundHistogram, zoneMinutesFromHistogram,
  HISTOGRAM_BUCKET_BPM, HISTOGRAM_MIN_BPM,
} from './heart-rate-histogram';
import { zoneBands } from './heart-rate-zones';

const ATTR = { source: 'exerciseTime' as const, maxGapSeconds: 60, version: 1 };
const bands = zoneBands({ restingBpm: 54, maxBpm: 190 });

describe('bucketing a reading', () => {
  const h = emptyHistogram(ATTR);

  it('puts a reading in the bucket its value falls in', () => {
    expect(bucketIndexFor(40, h)).toBe(0);
    expect(bucketIndexFor(44, h)).toBe(0);
    expect(bucketIndexFor(45, h)).toBe(1);
    expect(bucketIndexFor(142, h)).toBe(Math.floor((142 - HISTOGRAM_MIN_BPM) / HISTOGRAM_BUCKET_BPM));
  });

  it('clamps rather than dropping a reading outside the range', () => {
    // 35 and 240 are real measurements of a real person; discarding them
    // would quietly shorten their active minutes.
    expect(bucketIndexFor(35, h)).toBe(0);
    expect(bucketIndexFor(240, h)).toBe(h.minutes.length - 1);
  });
});

describe('accumulating samples', () => {
  it('gives each sample the time until the next one', () => {
    const h = accumulateSamples(emptyHistogram(ATTR), [
      { at: 0, bpm: 120 }, { at: 60, bpm: 120 }, { at: 120, bpm: 120 },
    ], 60);
    // Two intervals of 60s; the last sample owns nothing.
    expect(histogramTotalMinutes(h)).toBeCloseTo(2, 5);
  });

  it('refuses to attribute a gap longer than the cap', () => {
    // A watch on the nightstand must not bank eight hours at its last
    // reading.
    const h = accumulateSamples(emptyHistogram(ATTR), [
      { at: 0, bpm: 120 }, { at: 8 * 3600, bpm: 60 },
    ], 60);
    expect(histogramTotalMinutes(h)).toBe(0);
  });

  it('ignores a nonsensical reading', () => {
    const h = accumulateSamples(emptyHistogram(ATTR), [
      { at: 0, bpm: 0 }, { at: 60, bpm: 120 }, { at: 120, bpm: 120 },
    ], 60);
    expect(histogramTotalMinutes(h)).toBeCloseTo(1, 5);
  });
});

describe('slicing a histogram into zones', () => {
  it('keeps the zone sum equal to the total', () => {
    // The property that matters: no minute may be invented or lost by
    // re-slicing.
    const h = emptyHistogram(ATTR);
    h.minutes[10] = 12; h.minutes[18] = 30; h.minutes[24] = 9; h.minutes[30] = 4;
    const zones = zoneMinutesFromHistogram(h, bands);
    expect(zones.reduce((a, b) => a + b, 0)).toBe(Math.round(histogramTotalMinutes(h)));
  });

  it('puts a reading in the zone its bpm belongs to', () => {
    const h = emptyHistogram(ATTR);
    // Bucket 20 covers 140–144, midpoint 142.5 — zone 3 for this model.
    h.minutes[20] = 15;
    const zones = zoneMinutesFromHistogram(h, bands);
    const zone3 = bands.findIndex((b) => b.zone === 3);
    expect(zones[zone3]).toBe(15);
  });

  it('re-slices the same stored day under a different model', () => {
    /* The whole reason histograms are stored rather than zone minutes. The
       same day, a fitter athlete: the boundaries move, the split changes,
       the total does not. */
    /* One minute in every bucket, so the split is entirely a function of
       where the boundaries fall. Three hand-picked buckets can happen to sit
       in the same zones under both models, which is how the first version of
       this test passed while proving nothing. */
    const h = emptyHistogram(ATTR);
    h.minutes = h.minutes.map(() => 1);

    const before = zoneMinutesFromHistogram(h, zoneBands({ restingBpm: 54, maxBpm: 190 }));
    const after = zoneMinutesFromHistogram(h, zoneBands({ restingBpm: 44, maxBpm: 190 }));

    expect(before).not.toEqual(after);
    expect(before.reduce((a, b) => a + b, 0)).toBe(after.reduce((a, b) => a + b, 0));
  });

  it('returns nothing rather than guessing when there are no bands', () => {
    const h = emptyHistogram(ATTR);
    h.minutes[20] = 15;
    expect(zoneMinutesFromHistogram(h, [])).toEqual([]);
  });
});

describe('merging days', () => {
  it('adds bucket by bucket', () => {
    const a = emptyHistogram(ATTR); a.minutes[10] = 5;
    const b = emptyHistogram(ATTR); b.minutes[10] = 7; b.minutes[20] = 3;
    const merged = mergeHistograms([a, b])!;
    expect(merged.minutes[10]).toBe(12);
    expect(merged.minutes[20]).toBe(3);
  });

  it('skips a row bucketed differently rather than corrupting the sum', () => {
    const a = emptyHistogram(ATTR); a.minutes[10] = 5;
    const odd = { ...emptyHistogram(ATTR), bucketWidthBpm: 1 }; odd.minutes[10] = 99;
    const merged = mergeHistograms([a, odd])!;
    expect(merged.minutes[10]).toBe(5);
  });

  it('has nothing to merge from nothing', () => {
    expect(mergeHistograms([])).toBeNull();
  });
});

describe('rounding', () => {
  it('stores one decimal, not forty', () => {
    const h = emptyHistogram(ATTR);
    h.minutes[5] = 1 / 3;
    expect(roundHistogram(h).minutes[5]).toBe(0.3);
  });
});
