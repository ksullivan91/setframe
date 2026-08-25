import { describe, expect, it } from 'vitest';
import {
  checkInsUntilTrend,
  computeWeightTrend,
  weekOverWeekChange,
  weekStartOf,
  type WeightCheckIn,
  type WeightWeek,
} from './weight-trend';

function series(start: string, values: number[], unit: 'lb' | 'kg' = 'lb'): WeightCheckIn[] {
  const base = Date.parse(`${start}T00:00:00Z`);
  return values.map((weightValue, index) => ({
    localDate: new Date(base + index * 86_400_000).toISOString().slice(0, 10),
    weightValue,
    weightUnit: unit,
  }));
}

describe('empty and sparse data', () => {
  it('reports no data without throwing', () => {
    const trend = computeWeightTrend([]);
    expect(trend.sufficiency).toBe('none');
    expect(trend.points).toEqual([]);
    expect(trend.currentAverage).toBeNull();
    expect(trend.ratePerWeek).toBeNull();
    expect(trend.direction).toBeNull();
  });

  // The single most important guarantee: one check-in is a data point, not a trend.
  it('does not claim a trend from a single check-in', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180]));
    expect(trend.sufficiency).toBe('establishing');
    expect(trend.ratePerWeek).toBeNull();
    expect(trend.direction).toBeNull();
    expect(trend.currentAverage).toBeNull();
    expect(trend.points).toHaveLength(1);
    expect(trend.points[0]!.raw).toBe(180);
  });

  it('still exposes the raw check-in while establishing', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180, 178]));
    expect(trend.latestCheckIn?.weightValue).toBe(178);
    expect(trend.latestCheckIn?.localDate).toBe('2025-08-02');
    expect(trend.sufficiency).toBe('establishing');
  });

  it('withholds the rolling average until enough readings sit in the window', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180, 181]));
    expect(trend.points.every((point) => point.rollingAverage === null)).toBe(true);
  });

  it('withholds a trend when the readings are numerous but span under a week', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180, 181, 179, 180, 182, 181]));
    // Six readings, but only six days — too short a base to fit a weekly rate.
    expect(trend.sufficiency).toBe('establishing');
    expect(trend.ratePerWeek).toBeNull();
  });

  it('counts down the check-ins still needed', () => {
    expect(checkInsUntilTrend({ checkInCount: 2, sufficiency: 'establishing' })).toBe(3);
    expect(checkInsUntilTrend({ checkInCount: 0, sufficiency: 'none' })).toBe(5);
    expect(checkInsUntilTrend({ checkInCount: 9, sufficiency: 'ready' })).toBe(0);
  });
});

describe('no day-over-day delta is exposed', () => {
  it('exposes only rate-per-week as a change measure', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180, 183, 179, 181, 180, 182, 178, 180]));
    // A guard against anyone re-adding a "since yesterday" figure: the shape
    // simply has nowhere to put one.
    expect(Object.keys(trend)).not.toContain('dailyDelta');
    expect(Object.keys(trend)).not.toContain('changeSinceYesterday');
    expect(trend).toHaveProperty('ratePerWeek');
  });

  // A +3 lb overnight swing is water, not fat, and must not move the headline.
  it('barely moves the smoothed trend for a single large overnight spike', () => {
    const steady = series('2025-08-01', [180, 180, 180, 180, 180, 180, 180, 180, 180, 180]);
    const spiked = [...steady];
    spiked[9] = { ...spiked[9]!, weightValue: 185 };
    const trend = computeWeightTrend(spiked);
    const last = trend.points.at(-1)!;
    expect(last.raw).toBe(185);
    // The trend absorbs a tenth of the deviation, so it moves by ~0.5 not 5.
    expect(last.trend).toBeGreaterThan(180);
    expect(last.trend).toBeLessThan(180.6);
  });
});

describe('direction and rate', () => {
  it('detects a genuine downward trend and reports it as falling', () => {
    // Roughly -1 lb/week over four weeks, with daily noise on top.
    const values = Array.from({ length: 28 }, (_, index) => 200 - index / 7 + (index % 3) * 0.4);
    const trend = computeWeightTrend(series('2025-07-01', values));
    expect(trend.sufficiency).toBe('ready');
    expect(trend.direction).toBe('falling');
    expect(trend.ratePerWeek!).toBeLessThan(0);
  });

  it('detects a genuine upward trend and reports it as rising', () => {
    const values = Array.from({ length: 28 }, (_, index) => 160 + index / 7);
    const trend = computeWeightTrend(series('2025-07-01', values));
    expect(trend.direction).toBe('rising');
    expect(trend.ratePerWeek!).toBeGreaterThan(0);
  });

  it('reports noisy but flat data as steady rather than inventing a direction', () => {
    const values = Array.from({ length: 28 }, (_, index) => 175 + ((index % 4) - 1.5) * 0.8);
    const trend = computeWeightTrend(series('2025-07-01', values));
    expect(trend.direction).toBe('steady');
    expect(Math.abs(trend.ratePerWeek!)).toBeLessThan(0.25);
  });

  it('is unvalenced: rising and falling are mirror images with no good/bad marker', () => {
    const up = computeWeightTrend(series('2025-07-01', Array.from({ length: 28 }, (_, i) => 160 + i / 7)));
    const down = computeWeightTrend(series('2025-07-01', Array.from({ length: 28 }, (_, i) => 160 - i / 7)));
    expect(up.ratePerWeek!).toBeCloseTo(-down.ratePerWeek!, 6);
    expect(Object.keys(up)).not.toContain('status');
    expect(Object.keys(up)).not.toContain('isGood');
  });

  it('measures the rate over the trailing window only', () => {
    // Twelve weeks flat, then four weeks climbing: the reported rate must
    // reflect the recent climb, not be diluted by the flat history.
    const flat = Array.from({ length: 84 }, () => 170);
    const climbing = Array.from({ length: 28 }, (_, index) => 170 + index / 7);
    const trend = computeWeightTrend(series('2025-05-01', [...flat, ...climbing]));
    expect(trend.direction).toBe('rising');
    expect(trend.ratePerWeek!).toBeGreaterThan(0.5);
  });
});

describe('rolling average', () => {
  it('averages the trailing seven calendar days once enough readings exist', () => {
    const trend = computeWeightTrend(series('2025-08-01', [180, 182, 178, 181, 179, 180, 181]));
    const last = trend.points.at(-1)!;
    expect(last.rollingAverage).toBeCloseTo((180 + 182 + 178 + 181 + 179 + 180 + 181) / 7, 6);
  });

  it('windows by date rather than by position, so gaps do not reach back further', () => {
    const checkIns: WeightCheckIn[] = [
      { localDate: '2025-07-01', weightValue: 200, weightUnit: 'lb' },
      { localDate: '2025-08-01', weightValue: 180, weightUnit: 'lb' },
      { localDate: '2025-08-02', weightValue: 181, weightUnit: 'lb' },
      { localDate: '2025-08-03', weightValue: 179, weightUnit: 'lb' },
    ];
    const trend = computeWeightTrend(checkIns);
    const last = trend.points.at(-1)!;
    // The July reading is a month old and must not be averaged in.
    expect(last.rollingAverage).toBeCloseTo(180, 6);
  });

  it('averages multiple check-ins on the same date instead of double-counting', () => {
    const checkIns: WeightCheckIn[] = [
      { localDate: '2025-08-01', weightValue: 180, weightUnit: 'lb' },
      { localDate: '2025-08-01', weightValue: 182, weightUnit: 'lb' },
      { localDate: '2025-08-02', weightValue: 181, weightUnit: 'lb' },
    ];
    const trend = computeWeightTrend(checkIns);
    expect(trend.points).toHaveLength(2);
    expect(trend.points[0]!.raw).toBe(181);
  });

  it('accepts unsorted input', () => {
    const trend = computeWeightTrend([
      { localDate: '2025-08-03', weightValue: 179, weightUnit: 'lb' },
      { localDate: '2025-08-01', weightValue: 180, weightUnit: 'lb' },
      { localDate: '2025-08-02', weightValue: 181, weightUnit: 'lb' },
    ]);
    expect(trend.points.map((point) => point.localDate)).toEqual([
      '2025-08-01',
      '2025-08-02',
      '2025-08-03',
    ]);
  });
});

describe('weekly summaries', () => {
  it('buckets by Monday-anchored ISO weeks with high and low', () => {
    // 2025-08-04 is a Monday.
    const trend = computeWeightTrend(series('2025-08-04', [180, 184, 176, 181, 179, 182, 178]));
    expect(trend.weeks).toHaveLength(1);
    const week = trend.weeks[0]!;
    expect(week.weekStart).toBe('2025-08-04');
    expect(week.checkInCount).toBe(7);
    expect(week.low).toBe(176);
    expect(week.high).toBe(184);
    expect(week.average).toBeCloseTo(180, 6);
  });

  it('splits check-ins that straddle a week boundary', () => {
    // 2025-08-03 is a Sunday, so it belongs to the week starting 2025-07-28.
    const trend = computeWeightTrend(series('2025-08-03', [180, 181, 182]));
    expect(trend.weeks.map((week) => week.weekStart)).toEqual(['2025-07-28', '2025-08-04']);
    expect(trend.weeks[0]!.checkInCount).toBe(1);
    expect(trend.weeks[1]!.checkInCount).toBe(2);
  });

  it('anchors ISO weeks on Monday', () => {
    expect(weekStartOf('2025-08-04')).toBe('2025-08-04');
    expect(weekStartOf('2025-08-10')).toBe('2025-08-04');
    expect(weekStartOf('2025-08-11')).toBe('2025-08-11');
  });
});

describe('units', () => {
  it('reports in the unit of the latest check-in by default', () => {
    expect(computeWeightTrend(series('2025-08-01', [82, 81.5], 'kg')).unit).toBe('kg');
  });

  it('normalises a mixed-unit history to one display unit', () => {
    const trend = computeWeightTrend(
      [
        { localDate: '2025-08-01', weightValue: 80, weightUnit: 'kg' },
        { localDate: '2025-08-02', weightValue: 176.37, weightUnit: 'lb' },
      ],
      { displayUnit: 'lb' },
    );
    expect(trend.unit).toBe('lb');
    expect(trend.points[0]!.raw).toBeCloseTo(176.37, 1);
    // Both readings are the same weight, so the trend must be flat, not a
    // 96 lb cliff caused by comparing kilograms with pounds.
    expect(Math.abs(trend.points[1]!.raw - trend.points[0]!.raw)).toBeLessThan(0.1);
  });

  it('converts the reported rate into the display unit', () => {
    const kgTrend = computeWeightTrend(
      series('2025-07-01', Array.from({ length: 28 }, (_, index) => 80 - index / 7), 'kg'),
      { displayUnit: 'kg' },
    );
    const lbTrend = computeWeightTrend(
      series('2025-07-01', Array.from({ length: 28 }, (_, index) => 80 - index / 7), 'kg'),
      { displayUnit: 'lb' },
    );
    expect(lbTrend.ratePerWeek!).toBeCloseTo(kgTrend.ratePerWeek! / 0.45359237, 4);
  });
});

describe('weekOverWeekChange', () => {
  function week(weekStart: string, average: number, checkInCount = 4): WeightWeek {
    return { weekStart, average, low: average - 1, high: average + 1, checkInCount };
  }

  it('reports the signed change against the immediately preceding week', () => {
    const result = weekOverWeekChange([week('2026-01-05', 168.2), week('2026-01-12', 167.8)]);
    expect(result?.change).toBeCloseTo(-0.4, 5);
    expect(result?.previous.weekStart).toBe('2026-01-05');
    expect(result?.current.weekStart).toBe('2026-01-12');
  });

  /*
   * The load-bearing case: a gap must not be bridged. Labelling three weeks
   * of drift as "vs previous week" attributes it all to seven days.
   */
  it('withholds a comparison when the two weeks are not adjacent', () => {
    expect(weekOverWeekChange([week('2025-12-15', 170.0), week('2026-01-12', 167.8)])).toBeNull();
  });

  it('withholds a comparison when either week is a single check-in', () => {
    expect(
      weekOverWeekChange([week('2026-01-05', 168.2, 1), week('2026-01-12', 167.8, 4)]),
    ).toBeNull();
    expect(
      weekOverWeekChange([week('2026-01-05', 168.2, 4), week('2026-01-12', 167.8, 1)]),
    ).toBeNull();
  });

  it('has nothing to compare against in the first week', () => {
    expect(weekOverWeekChange([week('2026-01-12', 167.8)])).toBeNull();
    expect(weekOverWeekChange([])).toBeNull();
  });

  it('reports an unchanged average as zero rather than withholding it', () => {
    const result = weekOverWeekChange([week('2026-01-05', 168.0), week('2026-01-12', 168.0)]);
    expect(result?.change).toBe(0);
  });
});
