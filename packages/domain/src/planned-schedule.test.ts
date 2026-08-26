import { describe, expect, it } from 'vitest';
import {
  adherenceVerdict,
  completionRatio,
  describeAdherence,
  plannedDaysForWeek,
  plannedWeeks,
  type ScheduleSlot,
} from './planned-schedule';

// 2026-08-24 is a Monday. dayIndex is real day-of-week: Mon = 1, Wed = 3, Fri = 5.
const MONDAY = '2026-08-24';
const perpetual: ScheduleSlot[] = [
  { dayIndex: 1, weekNumber: null },
  { dayIndex: 3, weekNumber: null },
  { dayIndex: 5, weekNumber: null },
];

describe('plannedDaysForWeek', () => {
  it('counts a perpetual week from its day-of-week slots', () => {
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: perpetual, cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-01-01',
      }),
    ).toBe(3);
  });

  it('counts a day once when two slots land on it', () => {
    // Counting slots would inflate the denominator and report a user as
    // behind on a week they actually completed.
    const doubled: ScheduleSlot[] = [...perpetual, { dayIndex: 1, weekNumber: null }];
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: doubled, cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-01-01',
      }),
    ).toBe(3);
  });

  it('returns null for a week before the program existed', () => {
    // "0 of 5" across a user's early history is a fabricated indictment.
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: perpetual, cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-09-01',
      }),
    ).toBeNull();
  });

  it('returns null for a week after the program ended', () => {
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: perpetual, cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-01-01',
        effectiveTo: '2026-08-01',
      }),
    ).toBeNull();
  });

  it('counts only the covered days in the week a program starts mid-way', () => {
    // Program begins Wednesday: Monday's session was never planned.
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: perpetual, cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-08-26',
      }),
    ).toBe(2);
  });

  it('returns null when the program has no schedule at all', () => {
    expect(
      plannedDaysForWeek({
        weekStart: MONDAY, slots: [], cycleLengthWeeks: null,
        programStartDate: null, effectiveFrom: '2026-01-01',
      }),
    ).toBeNull();
  });

  it('selects the right cycle week in block mode', () => {
    const block: ScheduleSlot[] = [
      { dayIndex: 1, weekNumber: 1 },
      { dayIndex: 3, weekNumber: 1 },
      { dayIndex: 1, weekNumber: 2 },
    ];
    const common = {
      slots: block, cycleLengthWeeks: 2,
      programStartDate: MONDAY, effectiveFrom: '2026-01-01',
    };
    expect(plannedDaysForWeek({ ...common, weekStart: MONDAY })).toBe(2);
    // The following week is cycle week 2, which plans only one day.
    expect(plannedDaysForWeek({ ...common, weekStart: '2026-08-31' })).toBe(1);
    // And it wraps back to week 1.
    expect(plannedDaysForWeek({ ...common, weekStart: '2026-09-07' })).toBe(2);
  });
});

describe('completionRatio', () => {
  it('is null when nothing was planned', () => {
    expect(completionRatio(3, null)).toBeNull();
    expect(completionRatio(3, 0)).toBeNull();
  });

  it('reports exceeding the plan rather than clamping to 100%', () => {
    // Clamping would erase the difference between hitting and beating a plan.
    expect(completionRatio(5, 4)).toBeCloseTo(1.25, 6);
  });
});

describe('adherenceVerdict', () => {
  it('does not treat an extra session as a failure', () => {
    expect(adherenceVerdict(4, 3)).toBe('ahead');
    expect(adherenceVerdict(3, 3)).toBe('onPlan');
    expect(adherenceVerdict(2, 3)).toBe('behind');
  });

  it('is unknown, not behind, where there was no plan', () => {
    expect(adherenceVerdict(0, null)).toBe('unknown');
  });
});

describe('describeAdherence', () => {
  const week = (completedCount: number, plannedCount: number | null, isCurrent = false) => ({
    completedCount, plannedCount, isCurrent,
  });

  it('summarises finished weeks', () => {
    expect(
      describeAdherence([week(3, 3), week(2, 3), week(3, 3)]),
    ).toBe('You hit your plan in 2 of 3 finished weeks — 8 of 9 planned sessions.');
  });

  it('excludes the current week, which is still in progress', () => {
    // Counting it would report a shortfall the user still has days to close.
    expect(
      describeAdherence([week(3, 3), week(3, 3), week(0, 3, true)]),
    ).toBe('You hit your plan in 2 of 2 finished weeks — 6 of 6 planned sessions.');
  });

  it('counts beating the plan as hitting it', () => {
    expect(describeAdherence([week(4, 3), week(3, 3)])).toContain('2 of 2 finished weeks');
  });

  it('says nothing when too few weeks had a plan', () => {
    expect(describeAdherence([week(3, 3)])).toBeNull();
    expect(describeAdherence([week(3, null), week(2, null)])).toBeNull();
  });
});

describe('plannedWeeks', () => {
  it('keeps only weeks a plan actually covered', () => {
    const weeks = [
      { weekStart: 'a', plannedCount: null },
      { weekStart: 'b', plannedCount: 0 },
      { weekStart: 'c', plannedCount: 3 },
    ];
    expect(plannedWeeks(weeks).map((week) => week.weekStart)).toEqual(['c']);
  });

  it('returns nothing when no week had a plan', () => {
    expect(plannedWeeks([{ plannedCount: null }, { plannedCount: null }])).toEqual([]);
  });
});
