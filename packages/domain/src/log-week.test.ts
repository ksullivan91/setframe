import { describe, expect, it } from 'vitest';
import { addDays, buildLogWeek, startOfWeek, weekdayIndex } from './log-week';

const base = {
  selectedDate: '2026-09-03', // a Thursday
  today: '2026-09-03',
  trainedDates: [] as string[],
  restDates: [] as string[],
};

describe('the log week', () => {
  it('runs Sunday to Saturday around the selected date', () => {
    const week = buildLogWeek(base);
    expect(week).toHaveLength(7);
    expect(week[0]!.localDate).toBe('2026-08-30');
    expect(week[6]!.localDate).toBe('2026-09-05');
    expect(week.map((d) => d.letter)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('follows the selected date into another week, and drops today’s marker', () => {
    const week = buildLogWeek({ ...base, selectedDate: '2026-08-25' });
    expect(week[0]!.localDate).toBe('2026-08-23');
    expect(week.some((d) => d.isToday)).toBe(false);
    expect(week.find((d) => d.isSelected)!.localDate).toBe('2026-08-25');
  });

  it('marks trained and rest days', () => {
    const week = buildLogWeek({
      ...base,
      trainedDates: ['2026-08-31'],
      restDates: ['2026-09-04'],
    });
    expect(week.find((d) => d.localDate === '2026-08-31')!.state).toBe('trained');
    expect(week.find((d) => d.localDate === '2026-09-04')!.state).toBe('rest');
    expect(week.find((d) => d.localDate === '2026-09-01')!.state).toBe('none');
  });

  it('lets training win when a day is somehow both', () => {
    // Log's own precedence: a real session always beats a logged rest day.
    const week = buildLogWeek({
      ...base,
      trainedDates: ['2026-09-01'],
      restDates: ['2026-09-01'],
    });
    expect(week.find((d) => d.localDate === '2026-09-01')!.state).toBe('trained');
  });

  it('knows which days are still ahead', () => {
    const week = buildLogWeek(base);
    expect(week.find((d) => d.localDate === '2026-09-02')!.isFuture).toBe(false);
    expect(week.find((d) => d.localDate === '2026-09-03')!.isFuture).toBe(false);
    expect(week.find((d) => d.localDate === '2026-09-04')!.isFuture).toBe(true);
  });

  it('does not slip a day west of Greenwich', () => {
    // `new Date('2026-09-03')` is UTC midnight, which is 2 September in
    // Chicago. Every one of these must stay on the date it was given.
    for (const d of ['2026-01-01', '2026-03-08', '2026-09-03', '2026-12-31']) {
      expect(addDays(d, 0)).toBe(d);
      expect(addDays(addDays(d, 5), -5)).toBe(d);
    }
  });

  it('finds the Sunday on or before a date', () => {
    expect(startOfWeek('2026-09-03')).toBe('2026-08-30');
    expect(startOfWeek('2026-08-30')).toBe('2026-08-30');
    expect(weekdayIndex('2026-08-30')).toBe(0);
    expect(weekdayIndex('2026-09-03')).toBe(4);
  });

  it('crosses a month and a year boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(startOfWeek('2026-01-01')).toBe('2025-12-28');
  });
});
