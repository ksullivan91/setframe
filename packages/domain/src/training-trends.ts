/**
 * Training consistency and volume aggregation.
 *
 * Two defects in the previous Progress implementation are fixed here by
 * construction rather than by convention:
 *
 * 1. Weeks with no training were simply absent from the series, because it
 *    was built by grouping the sessions that existed. An "8 week" chart for
 *    someone who trained twice therefore rendered as two marks, which is
 *    exactly the pattern it was meant to reveal being hidden. `buildWeekWindow`
 *    emits a contiguous window so a missed week is a visible zero.
 * 2. Completion ratio was computed with `plannedCount` set equal to
 *    `completedCount`, so consistency was permanently 100%. Planned counts
 *    are now optional and explicit: when we do not know the plan we report
 *    `null` and the UI says so, rather than flattering the user.
 *
 * On the headline metric: `weeksTrained` ("you trained in 9 of the last 12
 * weeks") is preferred over a streak. A streak has a cliff — one missed week
 * resets a long run to zero, and the resulting "I have ruined it" reaction is
 * a well-documented driver of disengagement rather than of effort. Weeks
 * trained degrades gracefully, so a bad week costs a point instead of
 * everything. Streaks are still returned, because users ask for them, but
 * `longestStreakWeeks` is deliberately un-losable so there is always a
 * record of the best run even after it ends.
 *
 * See docs/research/progress-metrics-motivation.md.
 */

export interface TrainingSessionInput {
  /** Session date in the user's timezone, `YYYY-MM-DD`. */
  localDate: string;
  /** Load volume for the session, already restricted to load-bearing sets. */
  volume?: number | null;
}

export interface TrainingWeek {
  /** Monday of the ISO week, `YYYY-MM-DD`. */
  weekStart: string;
  completedCount: number;
  /** `null` when we do not know how many sessions were planned. */
  plannedCount: number | null;
  /** `null` when planned is unknown or zero, never a fabricated 1.0. */
  completionRatio: number | null;
  /** `null` when no load-bearing work was logged, so 0 is never implied. */
  volume: number | null;
  /** True for the week containing the window's end date. */
  isCurrent: boolean;
}

export interface TrainingTrends {
  weeks: TrainingWeek[];
  /** Weeks in the window containing at least one completed session. */
  weeksTrained: number;
  /** Length of the window, so the UI can render "N of M". */
  windowWeeks: number;
  /** Consecutive trained weeks ending at the current week. */
  currentStreakWeeks: number;
  /** Best run within the window. Never decreases when a streak breaks. */
  longestStreakWeeks: number;
  totalCompleted: number;
  /** Mean sessions per week across the whole window, including zero weeks. */
  averageSessionsPerWeek: number;
}

function toUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00Z`);
}

/** Monday-anchored ISO week start for a `YYYY-MM-DD` string. */
export function isoWeekStart(localDate: string): string {
  const date = toUtc(localDate);
  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - isoDay + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * A contiguous list of Monday-anchored week starts ending with the week that
 * contains `endLocalDate`. Always exactly `weeks` entries, so the chart's
 * x-axis is a fixed window and gaps are real.
 */
export function buildWeekWindow(endLocalDate: string, weeks: number): string[] {
  const lastWeek = toUtc(isoWeekStart(endLocalDate));
  const window: string[] = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(lastWeek);
    start.setUTCDate(start.getUTCDate() - offset * 7);
    window.push(start.toISOString().slice(0, 10));
  }
  return window;
}

export interface TrainingTrendOptions {
  /** Planned sessions per ISO week, where known. */
  plannedByWeek?: Readonly<Record<string, number>>;
}

export function summarizeTrainingTrends(
  sessions: readonly TrainingSessionInput[],
  endLocalDate: string,
  windowWeeks: number,
  options: TrainingTrendOptions = {},
): TrainingTrends {
  const window = buildWeekWindow(endLocalDate, windowWeeks);
  const currentWeek = window.at(-1);

  const completedByWeek = new Map<string, number>();
  const volumeByWeek = new Map<string, number>();
  for (const session of sessions) {
    const week = isoWeekStart(session.localDate);
    // Sessions outside the window are ignored rather than folded into the
    // edge weeks, which would silently inflate the oldest column.
    if (!window.includes(week)) continue;
    completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
    if (session.volume != null && session.volume > 0) {
      volumeByWeek.set(week, (volumeByWeek.get(week) ?? 0) + session.volume);
    }
  }

  const weeks: TrainingWeek[] = window.map((weekStart) => {
    const completedCount = completedByWeek.get(weekStart) ?? 0;
    const plannedCount = options.plannedByWeek?.[weekStart] ?? null;
    return {
      weekStart,
      completedCount,
      plannedCount,
      completionRatio:
        plannedCount != null && plannedCount > 0
          ? Math.min(completedCount / plannedCount, 1)
          : null,
      volume: volumeByWeek.get(weekStart) ?? null,
      isCurrent: weekStart === currentWeek,
    };
  });

  let longestStreakWeeks = 0;
  let running = 0;
  for (const week of weeks) {
    if (week.completedCount > 0) {
      running += 1;
      longestStreakWeeks = Math.max(longestStreakWeeks, running);
    } else {
      running = 0;
    }
  }

  // The current week is still in progress, so it does not break the streak
  // just by being empty on a Monday morning; we count back from the last
  // completed week instead.
  let currentStreakWeeks = 0;
  const streakStart = weeks.at(-1)?.completedCount === 0 ? weeks.length - 2 : weeks.length - 1;
  for (let index = streakStart; index >= 0; index -= 1) {
    if (weeks[index]!.completedCount > 0) currentStreakWeeks += 1;
    else break;
  }

  const totalCompleted = weeks.reduce((sum, week) => sum + week.completedCount, 0);

  return {
    weeks,
    weeksTrained: weeks.filter((week) => week.completedCount > 0).length,
    windowWeeks,
    currentStreakWeeks,
    longestStreakWeeks,
    totalCompleted,
    averageSessionsPerWeek: weeks.length ? totalCompleted / weeks.length : 0,
  };
}
