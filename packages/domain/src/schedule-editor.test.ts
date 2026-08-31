import { describe, expect, it } from 'vitest';
import {
  buildScheduleDays,
  describeRepeatMode,
  planBadge,
  planSwitchLabel,
} from './schedule-editor';
import type { OverviewSlot } from './training-overview';

const slot = (dayIndex: number, dayTypeName: string, over: Partial<OverviewSlot> = {}): OverviewSlot => ({
  dayIndex,
  dayTypeName,
  weekNumber: null,
  sortOrder: 0,
  ...over,
});

describe('buildScheduleDays', () => {
  it('lists seven days Sunday-first, matching the product week', () => {
    const days = buildScheduleDays([]);
    expect(days.map((d) => d.dayName)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });

  it('reads an unassigned day as Rest without needing a rest row', () => {
    /* dayTypeId is NOT NULL, so Rest cannot be a slot pointing at nothing —
       it is the absence of one. */
    expect(buildScheduleDays([])[0]!.summary).toBe('Rest');
  });

  it('keeps several workouts on one day, in sort order', () => {
    /* No unique constraint on (programVersionId, dayIndex), and sortOrder
       exists — two-a-days are legal in the data model. */
    const days = buildScheduleDays([
      slot(1, 'Evening', { sortOrder: 1 }),
      slot(1, 'Morning', { sortOrder: 0 }),
    ]);
    const monday = days.find((d) => d.dayName === 'Monday')!;
    expect(monday.workoutNames).toEqual(['Morning', 'Evening']);
    expect(monday.summary).toBe('Morning + Evening');
  });

  it('applies a week-pinned slot only in its own cycle week', () => {
    const slots = [slot(3, 'Deload', { weekNumber: 4 })];
    expect(buildScheduleDays(slots, 4).find((d) => d.dayIndex === 3)!.summary).toBe('Deload');
    expect(buildScheduleDays(slots, 2).find((d) => d.dayIndex === 3)!.summary).toBe('Rest');
  });
});

describe('describeRepeatMode', () => {
  it('names a block by its length, and perpetual by its behaviour', () => {
    expect(describeRepeatMode(8)).toBe('runs as a 8-week block');
    expect(describeRepeatMode(null)).toBe('repeats every week');
    expect(describeRepeatMode(0)).toBe('repeats every week');
  });
});

describe('plan labels', () => {
  it('badges the active plan by what it does, not the word Active', () => {
    expect(planBadge(true)).toBe('Active');
    expect(planBadge(false)).toBeNull();
  });

  it('changes the switch copy for a plan that has been run before', () => {
    /* The label does the reassuring a dialog would otherwise have to. */
    expect(planSwitchLabel(false)).toBe('Use this plan');
    expect(planSwitchLabel(true)).toBe('Run this again');
  });
});
