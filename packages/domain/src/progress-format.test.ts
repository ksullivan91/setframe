import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatDateRangeLabel,
  formatWeekRange,
  weekEndDate,
} from './progress-format';

describe('formatDateRangeLabel', () => {
  it('collapses to a single date when start equals end', () => {
    expect(formatDateRangeLabel('2026-08-24', '2026-08-24')).toBe('Aug 24');
  });

  it('formats a range within one month as "Aug 18–24"', () => {
    expect(formatDateRangeLabel('2026-08-18', '2026-08-24')).toBe('Aug 18–24');
  });

  it('formats a range crossing a month boundary within one year as "Mar–Aug"', () => {
    expect(formatDateRangeLabel('2026-03-01', '2026-08-24')).toBe('Mar–Aug');
  });

  it('spells the year on each end when the range crosses a year boundary', () => {
    expect(formatDateRangeLabel('2025-12-15', '2026-02-10')).toBe('Dec 2025 – Feb 2026');
  });
});

describe('formatWeekRange', () => {
  // 2026-08-17 is a Monday.
  it('formats a Monday-anchored week within one month', () => {
    expect(formatWeekRange('2026-08-17')).toBe('Aug 17–23');
  });

  // 2026-08-31 is a Monday; the week ends 2026-09-06.
  it('formats a week that crosses a month boundary', () => {
    expect(formatWeekRange('2026-08-31')).toBe('Aug 31 – Sep 6');
  });

  // 2025-12-29 is a Monday; the week ends 2026-01-04, crossing a year.
  it('stays day-precise and spells out the year when a week crosses a year boundary', () => {
    expect(formatWeekRange('2025-12-29')).toBe('Dec 29 – Jan 4, 2026');
  });
});

/**
 * The single shared implementation web and mobile both call to find the
 * last day of a Monday-anchored week — previously two byte-for-byte
 * identical copies, one per app.
 */
describe('weekEndDate', () => {
  it('returns the Sunday of a Monday-anchored week', () => {
    expect(weekEndDate('2026-08-17')).toBe('2026-08-23');
  });

  it('crosses a month boundary correctly', () => {
    expect(weekEndDate('2026-08-31')).toBe('2026-09-06');
  });

  it('crosses a year boundary correctly', () => {
    expect(weekEndDate('2025-12-29')).toBe('2026-01-04');
  });
});

describe('formatCompactNumber', () => {
  it('leaves a number that already fits alone', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(4)).toBe('4');
    expect(formatCompactNumber(999)).toBe('999');
  });

  it('abbreviates thousands the way the story asks', () => {
    expect(formatCompactNumber(10_000)).toBe('10k');
    expect(formatCompactNumber(20_000)).toBe('20k');
  });

  it('keeps a decimal below 10k, where it still carries information', () => {
    expect(formatCompactNumber(1_200)).toBe('1.2k');
    expect(formatCompactNumber(12_420)).toBe('12k');
  });

  it('drops a trailing .0 rather than printing 10.0k', () => {
    expect(formatCompactNumber(1_000)).toBe('1k');
    expect(formatCompactNumber(2_000_000)).toBe('2M');
  });

  it('handles millions, which a year of volume reaches', () => {
    expect(formatCompactNumber(1_250_000)).toBe('1.3M');
  });

  it('keeps a negative sign', () => {
    // Volume is never negative, but a change between periods is.
    expect(formatCompactNumber(-12_420)).toBe('-12k');
  });
});
