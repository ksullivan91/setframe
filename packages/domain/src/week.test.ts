import { describe, expect, it } from 'vitest';
import { isSameWeek, weekEnd, weekStart } from './week';

/* 2026-08-23 is a Sunday; 2026-08-29 is the following Saturday.
   Cases below deliberately include both boundary days and the Monday that
   used to be the week start, so a regression to ISO weeks fails loudly. */
describe('weekStart', () => {
  it('returns the Sunday that begins the week', () => {
    expect(weekStart('2026-08-26')).toBe('2026-08-23'); // Wednesday
    expect(weekStart('2026-08-29')).toBe('2026-08-23'); // Saturday, last day
  });

  it('treats Sunday as the first day of its own week, not the last of the previous', () => {
    // Under the old ISO rule this returned the *previous* Monday, putting
    // Sunday's session in the week that had already finished.
    expect(weekStart('2026-08-23')).toBe('2026-08-23');
  });

  it('keeps Monday in the week that started the day before', () => {
    expect(weekStart('2026-08-24')).toBe('2026-08-23');
  });

  it('rolls to the previous month and year where the week spans them', () => {
    expect(weekStart('2026-09-01')).toBe('2026-08-30');
    expect(weekStart('2026-01-01')).toBe('2025-12-28');
  });

  it('is stable — the start of a week is its own week start', () => {
    const start = weekStart('2026-08-26');
    expect(weekStart(start)).toBe(start);
  });
});

describe('weekEnd', () => {
  it('returns the Saturday six days after the Sunday start', () => {
    expect(weekEnd('2026-08-23')).toBe('2026-08-29');
  });

  it('crosses a month boundary correctly', () => {
    expect(weekEnd('2026-08-30')).toBe('2026-09-05');
  });

  it('always yields a Saturday', () => {
    for (const date of ['2026-01-04', '2026-03-08', '2026-11-01']) {
      expect(new Date(`${weekEnd(date)}T00:00:00Z`).getUTCDay()).toBe(6);
    }
  });
});

describe('isSameWeek', () => {
  it('groups Sunday through Saturday together', () => {
    expect(isSameWeek('2026-08-23', '2026-08-29')).toBe(true);
  });

  it('separates Saturday from the Sunday that follows it', () => {
    expect(isSameWeek('2026-08-29', '2026-08-30')).toBe(false);
  });

  it('no longer groups Sunday with the preceding Monday', () => {
    // The ISO behaviour this replaces: 2026-08-17 (Mon) and 2026-08-23 (Sun)
    // were the same week. They are now adjacent weeks.
    expect(isSameWeek('2026-08-17', '2026-08-23')).toBe(false);
  });
});
