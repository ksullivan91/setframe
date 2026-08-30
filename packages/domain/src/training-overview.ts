import { WEEK_START_DAY, weekStart } from './week';
import type { ScheduleSlot } from './planned-schedule';

/**
 * The Training overview's derived state: the week strip, what is next, and
 * how far through a block the user is.
 *
 * Pure, and shared, for the usual reason — web and mobile render this page
 * with different primitives, and a week strip that disagreed between them
 * about which day is "today" would be worse than no strip at all.
 *
 * ## The week starts where the rest of the product says it starts
 *
 * The Figma frame draws the strip `M T W T F S S`, but `WEEK_START_DAY` is
 * `0` (Sunday) and every other week-shaped number in the product — streaks,
 * `weeksTrained`, the progress charts — is built on it. Rendering the strip
 * Monday-first while `weekStart()` returns Sundays would put two days of a
 * *different* product week on screen under the heading "This week".
 *
 * So the order is derived from `WEEK_START_DAY` rather than hard-coded. Today
 * that yields `S M T W T F S`. If the product ever moves its week to Monday,
 * this strip follows automatically and the design matches with no code change.
 * Whether the week itself should move is a product decision, noted in
 * `week.ts`, and deliberately not made here.
 */

/** 0 = Sunday .. 6 = Saturday, matching `Date.getUTCDay()` and `ScheduleSlot`. */
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type WeekDayState =
  /** Trained. A success tint in the design. */
  | 'done'
  /** Today, whatever else is true of it. Solid accent. */
  | 'today'
  /** Scheduled, still to come. */
  | 'upcoming'
  /** Explicitly a rest day, or simply nothing scheduled. */
  | 'rest'
  /** Past, was scheduled, was not trained. */
  | 'missed';

export interface WeekStripDay {
  /** `YYYY-MM-DD`. */
  localDate: string;
  /** 0 = Sunday .. 6 = Saturday. */
  dayIndex: number;
  /** The single letter under the chip. Not unique — two days read `T`. */
  letter: string;
  /** For an accessible label, where one letter is not enough. */
  dayName: string;
  state: WeekDayState;
  /**
   * Every workout scheduled that day, in `sortOrder`. A day can hold more
   * than one: `program_schedule_slot` has no unique constraint on
   * `(programVersionId, dayIndex)`.
   */
  workoutNames: string[];
  /** What the design prints under the chip. `Rest` when nothing is on. */
  caption: string;
}

export interface OverviewSlot extends ScheduleSlot {
  /** Resolved name of the assigned day type. */
  dayTypeName: string;
  /** Orders several workouts sharing one day. */
  sortOrder: number;
}

export interface WeekStripOptions {
  /** Any date inside the week to render. */
  localDate: string;
  /** Today, so exactly one chip can be `today`. */
  todayLocalDate: string;
  slots: readonly OverviewSlot[];
  /** Dates with a completed session. */
  completedDates: readonly string[];
  /** Dates explicitly marked rest. */
  restDates: readonly string[];
  /** 1-based cycle week for block mode; null in perpetual mode. */
  cycleWeekNumber?: number | null;
}

function addDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The seven chips, in the product's own week order.
 *
 * Precedence is deliberate and is the part worth reading: **done beats
 * today**. A user who has already trained today should see the reward, not a
 * chip that still says "go". Rest loses to both — a rest day you trained on
 * is a day you trained.
 */
export function buildWeekStrip(options: WeekStripOptions): WeekStripDay[] {
  const start = weekStart(options.localDate);
  const completed = new Set(options.completedDates);
  const rest = new Set(options.restDates);

  return Array.from({ length: 7 }, (_, offset) => {
    const localDate = addDays(start, offset);
    const dayIndex = (WEEK_START_DAY + offset) % 7;

    /* A slot applies this week if it repeats (null weekNumber) or pins to
       this cycle week. In perpetual mode every slot repeats. */
    const daySlots = options.slots
      .filter((slot) => slot.dayIndex === dayIndex)
      .filter(
        (slot) =>
          slot.weekNumber == null ||
          options.cycleWeekNumber == null ||
          slot.weekNumber === options.cycleWeekNumber,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const workoutNames = daySlots.map((slot) => slot.dayTypeName);
    const isPast = localDate < options.todayLocalDate;
    const isToday = localDate === options.todayLocalDate;

    const state: WeekDayState = completed.has(localDate)
      ? 'done'
      : isToday
        ? 'today'
        : rest.has(localDate) || workoutNames.length === 0
          ? 'rest'
          : isPast
            ? 'missed'
            : 'upcoming';

    return {
      localDate,
      dayIndex,
      letter: DAY_LETTERS[dayIndex]!,
      dayName: DAY_NAMES[dayIndex]!,
      state,
      workoutNames,
      /* Several workouts on one day would overflow a 42px column, so the
         count stands in for the names rather than truncating one of them. */
      caption:
        workoutNames.length === 0
          ? 'Rest'
          : workoutNames.length === 1
            ? workoutNames[0]!
            : `${workoutNames.length} workouts`,
    };
  });
}

/**
 * The next scheduled workout, for the "Next up" pill.
 *
 * Looks forward from today within the rendered week only. Returns `null`
 * rather than wrapping to the start of the week — a pill pointing backwards
 * would be worse than no pill.
 */
export function resolveNextUp(
  strip: readonly WeekStripDay[],
  todayLocalDate: string,
): { localDate: string; workoutName: string } | null {
  for (const day of strip) {
    if (day.localDate < todayLocalDate) continue;
    if (day.state === 'done') continue;
    const name = day.workoutNames[0];
    if (name) return { localDate: day.localDate, workoutName: name };
  }
  return null;
}

export interface BlockProgress {
  /** `Week 3 of 8`, or `Repeats weekly` in perpetual mode. */
  label: string;
  /** 0..1 for the progress fill, or null when there is no block to fill. */
  ratio: number | null;
  currentWeek: number | null;
}

/**
 * How far through a block the user is.
 *
 * `cycle_length_weeks` set means a block; null means it repeats every week
 * and there is no end to progress toward — so the bar is absent rather than
 * full or empty, both of which would assert something untrue.
 */
export function describeBlockProgress(options: {
  cycleLengthWeeks: number | null;
  programStartDate: string | null;
  todayLocalDate: string;
}): BlockProgress {
  const { cycleLengthWeeks, programStartDate, todayLocalDate } = options;
  if (!cycleLengthWeeks || cycleLengthWeeks <= 0 || !programStartDate) {
    return { label: 'Repeats weekly', ratio: null, currentWeek: null };
  }

  const startWeek = weekStart(programStartDate);
  const thisWeek = weekStart(todayLocalDate);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsed = Math.round(
    (new Date(`${thisWeek}T00:00:00Z`).getTime() - new Date(`${startWeek}T00:00:00Z`).getTime()) /
      msPerWeek,
  );

  /* Before the start date the user is in week 1, not week zero or negative. */
  const currentWeek = Math.min(Math.max(elapsed + 1, 1), cycleLengthWeeks);
  return {
    label: `Week ${currentWeek} of ${cycleLengthWeeks}`,
    ratio: currentWeek / cycleLengthWeeks,
    currentWeek,
  };
}

/**
 * The overview header's one-line summary of the plan.
 *
 * `Week 3 of 8 · 4 days a week`, with each half omitted when unknown rather
 * than printed empty.
 */
export function formatProgramMeta(progress: BlockProgress, scheduledDaysPerWeek: number): string {
  const segments = [progress.label];
  if (scheduledDaysPerWeek > 0) {
    segments.push(
      scheduledDaysPerWeek === 1 ? '1 day a week' : `${scheduledDaysPerWeek} days a week`,
    );
  }
  return segments.join(' · ');
}
