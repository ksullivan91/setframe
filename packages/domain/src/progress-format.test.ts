import { describe, expect, it } from 'vitest';
import { formatDateRangeLabel, formatWeekRange } from './progress-format';

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
