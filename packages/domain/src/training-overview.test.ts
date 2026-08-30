import { describe, expect, it } from 'vitest';
import {
  buildWeekStrip,
  describeBlockProgress,
  formatProgramMeta,
  resolveNextUp,
  type OverviewSlot,
} from './training-overview';

const slot = (dayIndex: number, dayTypeName: string, over: Partial<OverviewSlot> = {}): OverviewSlot => ({
  dayIndex,
  dayTypeName,
  weekNumber: null,
  sortOrder: 0,
  ...over,
});

/* 2026-08-24 is a Monday; its week starts Sunday 2026-08-23. */
const base = {
  localDate: '2026-08-24',
  todayLocalDate: '2026-08-24',
  slots: [] as OverviewSlot[],
  completedDates: [] as string[],
  restDates: [] as string[],
};

describe('buildWeekStrip', () => {
  it('renders seven days in the product week order, not the design order', () => {
    /* The Figma frame draws M-first, but WEEK_START_DAY is Sunday and every
       other week figure in the product is built on it. A Monday-first strip
       under the heading "This week" would show two days from a different
       week than the one streaks and weeksTrained count. */
    const strip = buildWeekStrip(base);
    expect(strip.map((d) => d.letter)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(strip[0]!.localDate).toBe('2026-08-23');
    expect(strip[6]!.localDate).toBe('2026-08-29');
  });

  it('marks today, and only today', () => {
    const strip = buildWeekStrip({ ...base, slots: [slot(1, 'Upper A')] });
    expect(strip.filter((d) => d.state === 'today')).toHaveLength(1);
    expect(strip.find((d) => d.state === 'today')!.localDate).toBe('2026-08-24');
  });

  it('lets a completed day beat today, so a finished workout still reads as done', () => {
    const strip = buildWeekStrip({
      ...base,
      slots: [slot(1, 'Upper A')],
      completedDates: ['2026-08-24'],
    });
    expect(strip.find((d) => d.localDate === '2026-08-24')!.state).toBe('done');
  });

  it('treats a day you trained on as trained even if it was marked rest', () => {
    const strip = buildWeekStrip({
      ...base,
      todayLocalDate: '2026-08-28',
      restDates: ['2026-08-24'],
      completedDates: ['2026-08-24'],
    });
    expect(strip.find((d) => d.localDate === '2026-08-24')!.state).toBe('done');
  });

  it('separates a missed past day from an upcoming one', () => {
    const strip = buildWeekStrip({
      ...base,
      todayLocalDate: '2026-08-27',
      slots: [slot(1, 'Upper A'), slot(5, 'Lower B')],
    });
    expect(strip.find((d) => d.localDate === '2026-08-24')!.state).toBe('missed');
    expect(strip.find((d) => d.localDate === '2026-08-28')!.state).toBe('upcoming');
  });

  it('reads an unscheduled day as rest without needing a rest_day row', () => {
    const strip = buildWeekStrip(base);
    expect(strip.every((d) => d.state === 'rest' || d.state === 'today')).toBe(true);
    expect(strip[0]!.caption).toBe('Rest');
  });

  it('keeps several workouts on one day, in sort order, and counts them in the caption', () => {
    /* program_schedule_slot has no unique constraint on (version, dayIndex)
       and carries a sortOrder, so two-a-days are legal in the data model. */
    const strip = buildWeekStrip({
      ...base,
      slots: [slot(1, 'Evening', { sortOrder: 1 }), slot(1, 'Morning', { sortOrder: 0 })],
    });
    const monday = strip.find((d) => d.localDate === '2026-08-24')!;
    expect(monday.workoutNames).toEqual(['Morning', 'Evening']);
    expect(monday.caption).toBe('2 workouts');
  });

  it('applies a week-pinned slot only in its own cycle week', () => {
    const slots = [slot(3, 'Deload', { weekNumber: 4 })];
    const inWeek = buildWeekStrip({ ...base, slots, cycleWeekNumber: 4 });
    const otherWeek = buildWeekStrip({ ...base, slots, cycleWeekNumber: 2 });
    expect(inWeek.find((d) => d.dayIndex === 3)!.workoutNames).toEqual(['Deload']);
    expect(otherWeek.find((d) => d.dayIndex === 3)!.workoutNames).toEqual([]);
  });
});

describe('resolveNextUp', () => {
  it('finds the next scheduled workout from today forward', () => {
    const strip = buildWeekStrip({
      ...base,
      todayLocalDate: '2026-08-25',
      slots: [slot(1, 'Upper A'), slot(4, 'Upper B')],
    });
    expect(resolveNextUp(strip, '2026-08-25')).toEqual({
      localDate: '2026-08-27',
      workoutName: 'Upper B',
    });
  });

  it('skips a day already trained rather than pointing at it', () => {
    const strip = buildWeekStrip({
      ...base,
      slots: [slot(1, 'Upper A'), slot(4, 'Upper B')],
      completedDates: ['2026-08-24'],
    });
    expect(resolveNextUp(strip, '2026-08-24')!.workoutName).toBe('Upper B');
  });

  it('returns null rather than wrapping backwards when the week is done', () => {
    const strip = buildWeekStrip({
      ...base,
      todayLocalDate: '2026-08-28',
      slots: [slot(1, 'Upper A')],
    });
    expect(resolveNextUp(strip, '2026-08-28')).toBeNull();
  });
});

describe('describeBlockProgress', () => {
  it('counts the week within a block', () => {
    const progress = describeBlockProgress({
      cycleLengthWeeks: 8,
      programStartDate: '2026-08-10',
      todayLocalDate: '2026-08-24',
    });
    expect(progress.label).toBe('Week 3 of 8');
    expect(progress.currentWeek).toBe(3);
    expect(progress.ratio).toBeCloseTo(3 / 8);
  });

  it('has no bar to fill in perpetual mode, rather than an empty or full one', () => {
    /* A null cycle length means the plan repeats forever. Drawing that as 0%
       or 100% would both assert something untrue about a plan with no end. */
    const progress = describeBlockProgress({
      cycleLengthWeeks: null,
      programStartDate: '2026-08-10',
      todayLocalDate: '2026-08-24',
    });
    expect(progress).toEqual({ label: 'Repeats weekly', ratio: null, currentWeek: null });
  });

  it('clamps to week 1 before the plan starts, never zero or negative', () => {
    const progress = describeBlockProgress({
      cycleLengthWeeks: 8,
      programStartDate: '2026-09-07',
      todayLocalDate: '2026-08-24',
    });
    expect(progress.currentWeek).toBe(1);
  });

  it('clamps to the last week rather than running past the block', () => {
    const progress = describeBlockProgress({
      cycleLengthWeeks: 4,
      programStartDate: '2026-01-05',
      todayLocalDate: '2026-08-24',
    });
    expect(progress.label).toBe('Week 4 of 4');
    expect(progress.ratio).toBe(1);
  });
});

describe('formatProgramMeta', () => {
  it('joins the block and the cadence', () => {
    const progress = describeBlockProgress({
      cycleLengthWeeks: 8,
      programStartDate: '2026-08-10',
      todayLocalDate: '2026-08-24',
    });
    expect(formatProgramMeta(progress, 4)).toBe('Week 3 of 8 · 4 days a week');
  });

  it('singularises, and omits a cadence it does not have', () => {
    const perpetual = describeBlockProgress({
      cycleLengthWeeks: null,
      programStartDate: null,
      todayLocalDate: '2026-08-24',
    });
    expect(formatProgramMeta(perpetual, 1)).toBe('Repeats weekly · 1 day a week');
    expect(formatProgramMeta(perpetual, 0)).toBe('Repeats weekly');
  });
});
