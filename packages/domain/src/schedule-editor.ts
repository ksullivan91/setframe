import type { OverviewSlot } from './training-overview';
import { WEEK_START_DAY } from './week';

/**
 * The weekly schedule editor's derived state.
 *
 * Figma: `Explore/Mobile/Training 5 · Plan the week` (150:708) and
 * `Training 6 · Assign a day` (156:708).
 *
 * Two schema facts drive the whole design, and both were checked rather than
 * assumed:
 *
 * - **A day can hold several workouts.** `program_schedule_slot` has no
 *   unique constraint on `(programVersionId, dayIndex)` and carries a
 *   `sortOrder`. Designing the assign sheet as single-select would have ruled
 *   out two-a-days the data model already allows.
 * - **Rest is the absence of a slot.** `dayTypeId` is `NOT NULL`, so Rest
 *   cannot be a slot pointing at nothing — choosing it *deletes* the day's
 *   slots. That is why it is a different kind of action from the workouts
 *   above it.
 */

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface ScheduleDay {
  /** 0 = Sunday .. 6 = Saturday. */
  dayIndex: number;
  dayName: string;
  /** Assigned workouts, in `sortOrder`. Empty means rest. */
  workoutNames: string[];
  /** What the row shows on its right: names, or the word Rest. */
  summary: string;
}

/**
 * The seven rows of the weekly template, in the product's week order.
 *
 * Order comes from `WEEK_START_DAY` for the same reason the overview strip's
 * does — a Monday-first list under a Sunday-based week would disagree with
 * every other week figure in the product.
 */
export function buildScheduleDays(
  slots: readonly OverviewSlot[],
  cycleWeekNumber?: number | null,
): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const dayIndex = (WEEK_START_DAY + offset) % 7;
    const workoutNames = slots
      .filter((slot) => slot.dayIndex === dayIndex)
      .filter(
        (slot) =>
          slot.weekNumber == null ||
          cycleWeekNumber == null ||
          slot.weekNumber === cycleWeekNumber,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((slot) => slot.dayTypeName);

    return {
      dayIndex,
      dayName: DAY_NAMES[dayIndex]!,
      workoutNames,
      /* Several names join with a plus rather than being truncated — the row
         is full width here, unlike the overview strip's 42px column. */
      summary: workoutNames.length === 0 ? 'Rest' : workoutNames.join(' + '),
    };
  });
}

/**
 * How the schedule header describes the plan's repeat mode.
 *
 * `cycle_length_weeks` is real in the schema — set means a block, null means
 * it repeats every week — and nothing in the product has ever shown it.
 */
export function describeRepeatMode(cycleLengthWeeks: number | null): string {
  return cycleLengthWeeks && cycleLengthWeeks > 0
    ? `runs as a ${cycleLengthWeeks}-week block`
    : 'repeats every week';
}

/**
 * The plans list's badge for the active plan.
 *
 * Says what the plan *does* rather than using the word Active: stories 24-26
 * built a deliberate selected-versus-active distinction, and on a phone there
 * is no editing context to hold, so the only thing that matters is which one
 * drives Today.
 */
export function planBadge(isActive: boolean): string | null {
  return isActive ? 'Driving Today' : null;
}

/**
 * The label on a plan's switch button.
 *
 * A plan that has been run before gets different copy, so the label does the
 * reassuring a dialog would otherwise have to.
 */
export function planSwitchLabel(hasHistory: boolean): string {
  return hasHistory ? 'Run this again' : 'Use this plan';
}
