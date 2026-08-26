/**
 * How many training days a program plans for a given calendar week.
 *
 * This is the missing half of "am I training as planned?" — the Progress
 * payload has carried `plannedCount: null` since it was written, with a TODO
 * saying to derive it from the active program version. Until it exists, the
 * completion ratio is unanswerable and the charts can only show what happened,
 * never what was supposed to.
 *
 * The rule mirrors `apps/api/src/routes/dashboard.ts`'s `resolveScheduledDayType`
 * exactly, because the two must agree: `dayIndex` is the real day of week
 * (0 = Sunday .. 6 = Saturday), not an offset from the program start, and a
 * block-mode cycle week is counted forward from the program's start date.
 * Dashboard answers "what is scheduled for this date"; this answers "how many
 * dates in this week were scheduled". Divergence between them would show a
 * user a ratio that disagrees with their own calendar.
 */

export interface ScheduleSlot {
  /** Real day of week, 0 = Sunday .. 6 = Saturday. */
  dayIndex: number;
  /** 1-based cycle week for block mode; null in perpetual mode. */
  weekNumber: number | null;
}

export interface PlannedWeekOptions {
  /** `YYYY-MM-DD` Sunday that starts the calendar week. */
  weekStart: string;
  slots: readonly ScheduleSlot[];
  /** Set for block mode, null for perpetual. */
  cycleLengthWeeks: number | null;
  /** `YYYY-MM-DD`; anchors block-mode cycle counting. */
  programStartDate: string | null;
  /**
   * The window the plan actually applied over. A week outside it returns
   * `null`, never `0`: before a program existed there was no plan to fall
   * short of, and drawing "0 of 5" across a user's early history is a
   * fabricated indictment rather than a fact.
   */
  effectiveFrom: string | null;
  effectiveTo?: string | null;
}

const DAY_MS = 86_400_000;

function toUtc(localDate: string): number {
  return Date.parse(`${localDate}T00:00:00Z`);
}

function addDays(localDate: string, days: number): string {
  return new Date(toUtc(localDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Planned training days in the calendar week beginning `weekStart`, or `null`
 * when the program did not apply for any of it.
 *
 * Counted per *date* rather than per slot: two slots on the same day (a
 * two-a-day, or a duplicate left by an edit) are one training day, and
 * `resolveScheduledDayType` already resolves such a day to a single workout by
 * `sortOrder`. Counting slots would inflate the denominator and report a user
 * as behind on a week they completed.
 */
export function plannedDaysForWeek(options: PlannedWeekOptions): number | null {
  const { weekStart, slots, cycleLengthWeeks, programStartDate, effectiveFrom } = options;
  if (!slots.length) return null;

  const weekEnd = addDays(weekStart, 6);
  // A week is in range when the plan applied for any part of it, so the week
  // a program starts mid-way counts the days it actually covered.
  if (effectiveFrom && weekEnd < effectiveFrom) return null;
  if (options.effectiveTo && weekStart > options.effectiveTo) return null;

  const plannedDates = new Set<string>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(weekStart, offset);
    if (effectiveFrom && date < effectiveFrom) continue;
    if (options.effectiveTo && date > options.effectiveTo) continue;

    const dayIndex = new Date(toUtc(date)).getUTCDay();

    let weekNumber: number | null = null;
    if (cycleLengthWeeks) {
      const start = programStartDate ? toUtc(programStartDate) : toUtc(date);
      const diffDays = Math.floor((toUtc(date) - start) / DAY_MS);
      weekNumber = (Math.floor(Math.max(diffDays, 0) / 7) % cycleLengthWeeks) + 1;
    }

    const matches = slots.some(
      (slot) =>
        slot.dayIndex === dayIndex &&
        (cycleLengthWeeks ? slot.weekNumber === weekNumber : slot.weekNumber === null),
    );
    if (matches) plannedDates.add(date);
  }

  return plannedDates.size;
}

/**
 * Completion ratio for a week, or `null` where it would not mean anything.
 *
 * Deliberately uncapped above 1: training more days than planned is a real
 * thing that happened, and clamping it to 100% would quietly erase the
 * difference between hitting the plan and exceeding it.
 */
export function completionRatio(
  completedCount: number,
  plannedCount: number | null,
): number | null {
  if (plannedCount == null || plannedCount <= 0) return null;
  return completedCount / plannedCount;
}

export type AdherenceVerdict = 'ahead' | 'onPlan' | 'behind' | 'unknown';

/**
 * How a week's adherence should read.
 *
 * `onPlan` covers meeting *or* beating the plan, because a week where you
 * trained an extra day is not a failure state and should not be styled as one.
 * The distinct `ahead` verdict exists so the UI can acknowledge it without
 * implying a problem.
 */
export function adherenceVerdict(
  completedCount: number,
  plannedCount: number | null,
): AdherenceVerdict {
  if (plannedCount == null || plannedCount <= 0) return 'unknown';
  if (completedCount > plannedCount) return 'ahead';
  if (completedCount === plannedCount) return 'onPlan';
  return 'behind';
}

/**
 * A sentence summarising adherence across a window, or null when too little
 * of the window had a plan for the summary to mean anything.
 */
export function describeAdherence(
  weeks: readonly { completedCount: number; plannedCount: number | null; isCurrent: boolean }[],
): string | null {
  // The current week is excluded: it is still in progress, so counting it as
  // a miss would report a shortfall the user still has days to close.
  const settled = weeks.filter((week) => !week.isCurrent && week.plannedCount != null);
  if (settled.length < 2) return null;

  const hit = settled.filter(
    (week) => week.completedCount >= (week.plannedCount ?? 0),
  ).length;
  const totalPlanned = settled.reduce((sum, week) => sum + (week.plannedCount ?? 0), 0);
  const totalDone = settled.reduce((sum, week) => sum + week.completedCount, 0);

  if (totalPlanned === 0) return null;

  return `You hit your plan in ${hit} of ${settled.length} finished weeks — ${totalDone} of ${totalPlanned} planned sessions.`;
}


export interface PlannedWeekLike {
  plannedCount: number | null;
}

/**
 * The weeks a plan actually covered — the only weeks adherence may be drawn
 * for. A `plannedCount` of null means the program did not cover that week, and
 * rendering "0 of 0" across a user's early history invents a shortfall out of
 * an absence.
 *
 * Exported rather than inlined at each call site because both the chart and
 * the section that decides whether to render it need the same answer, and two
 * copies of a predicate means only one of them is ever tested — which is
 * exactly what mutation testing caught here.
 */
export function plannedWeeks<T extends PlannedWeekLike>(weeks: readonly T[]): T[] {
  return weeks.filter((week) => week.plannedCount != null && week.plannedCount > 0);
}
