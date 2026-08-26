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
 *
 * Story 45 — metric-inclusion matrix. `TrainingSessionInput` only ever
 * represents a scheduled `workout_session`; Additional Activity
 * (packages/schemas' AdditionalActivity — a walk, yoga, mobility work
 * logged outside the program) has no representation here at all, so a
 * recovery day with one scheduled workout and three logged activities
 * still counts as exactly one session, never four:
 *
 * | Metric                         | Scheduled workout | Additional activity |
 * |---------------------------------|:---:|:---:|
 * | weeksTrained / totalCompleted   | Yes | No  |
 * | currentStreakWeeks / longest    | Yes | No  |
 * | averageSessionsPerWeek          | Yes | No  |
 * | Program adherence (consistency) | Yes | No  |
 *
 * `apps/api/src/routes/progress.ts` doesn't import the `additionalActivity`
 * table at all, so there's no code path for it to reach any of the above —
 * see apps/api/src/routes/progress.test.ts for a pinned regression case. A
 * future metric that intentionally combines both (e.g. "total activity
 * minutes") must use a new, honestly-named field rather than folding into
 * one of these.
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
  /** Days in the week the user deliberately took off. */
  restCount: number;
  /**
   * True when nothing was trained but at least one rest day was logged, so
   * the UI can tell a deliberate week off apart from a disappearance.
   */
  isRestWeek: boolean;
  /** True for the week containing the window's end date. */
  isCurrent: boolean;
}

/**
 * One calendar day of training, for ranges too short for weekly buckets.
 *
 * `weeks` is the wrong resolution for the W and M ranges — a seven-bar chart
 * of one bar is not a chart. These carry the same facts a day at a time, so
 * the client can bucket to whatever the selected range calls for
 * (`buildProgressSeries` in progress-range.ts) rather than the API deciding
 * a single granularity for every range.
 *
 * Only days with activity appear. A day with no session is absent, not zero:
 * whether that absence *means* zero depends on whether the user had started
 * logging yet, which is a question for the consumer and is what
 * `firstActivityDate` below exists to answer.
 */
export interface TrainingDay {
  /** `YYYY-MM-DD` in the user's timezone. */
  localDate: string;
  completedCount: number;
  /** `null` for a day of non-load training, so 0 never implies wasted work. */
  volume: number | null;
}

export interface TrainingTrends {
  weeks: TrainingWeek[];
  /** Per-day counts and volume, for sub-weekly ranges. */
  days: TrainingDay[];
  /**
   * The earliest date with any recorded training, or `null` if there is none.
   *
   * A chart may legitimately render an empty period as zero — you trained no
   * times that week — but only *within* the span the user was actually using
   * the app. Before their first session there is no fact to report, and
   * drawing a row of zeros there invents a history of not training out of an
   * account that did not exist yet.
   */
  firstActivityDate: string | null;
  /** Weeks in the window containing at least one completed session. */
  weeksTrained: number;
  /** Length of the window, so the UI can render "N of M". */
  windowWeeks: number;
  /** Consecutive trained weeks ending at the current week. */
  currentStreakWeeks: number;
  /** Best run within the window. Never decreases when a streak breaks. */
  longestStreakWeeks: number;
  totalCompleted: number;
  /** Rest days logged across the window. */
  totalRestDays: number;
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
  /** Dates the user marked as rest, `YYYY-MM-DD`. */
  restDates?: readonly string[];
  /**
   * The user's true first training date, where the caller knows it.
   *
   * `sessions` is normally already trimmed to the requested window, so the
   * earliest one in it is the window's own start rather than the user's. A
   * caller holding the unwindowed answer — the API runs a separate query for
   * exactly this — passes it here so `firstActivityDate` means what it says.
   */
  firstActivityDate?: string | null;
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
  const restByWeek = new Map<string, number>();
  for (const localDate of options.restDates ?? []) {
    const week = isoWeekStart(localDate);
    if (!window.includes(week)) continue;
    restByWeek.set(week, (restByWeek.get(week) ?? 0) + 1);
  }
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
    const restCount = restByWeek.get(weekStart) ?? 0;
    return {
      weekStart,
      completedCount,
      restCount,
      isRestWeek: completedCount === 0 && restCount > 0,
      plannedCount,
      completionRatio:
        plannedCount != null && plannedCount > 0
          ? Math.min(completedCount / plannedCount, 1)
          : null,
      volume: volumeByWeek.get(weekStart) ?? null,
      isCurrent: weekStart === currentWeek,
    };
  });

  // Rest weeks are transparent to streaks: they neither extend a run nor end
  // one. Counting them as trained would let someone reach a 52-week streak
  // without training, which would make the number meaningless; ending a run
  // on them would punish the recovery the feature exists to encourage.
  let longestStreakWeeks = 0;
  let running = 0;
  for (const week of weeks) {
    if (week.completedCount > 0) {
      running += 1;
      longestStreakWeeks = Math.max(longestStreakWeeks, running);
    } else if (!week.isRestWeek) {
      running = 0;
    }
  }

  // The current week is still in progress, so it does not break the streak
  // just by being empty on a Monday morning; we count back from the last
  // completed week instead.
  let currentStreakWeeks = 0;
  const streakStart = weeks.at(-1)?.completedCount === 0 ? weeks.length - 2 : weeks.length - 1;
  for (let index = streakStart; index >= 0; index -= 1) {
    const week = weeks[index]!;
    if (week.completedCount > 0) currentStreakWeeks += 1;
    else if (!week.isRestWeek) break;
  }

  const totalCompleted = weeks.reduce((sum, week) => sum + week.completedCount, 0);

  /* Daily rollup, built from the same sessions the weekly buckets use so the
     two can never disagree about a total. Sessions outside the window are
     excluded here for the same reason they are there: folding them into an
     edge day would silently inflate it. */
  const dayCounts = new Map<string, { completedCount: number; volume: number | null }>();
  for (const session of sessions) {
    if (!window.includes(isoWeekStart(session.localDate))) continue;
    const entry = dayCounts.get(session.localDate) ?? { completedCount: 0, volume: null };
    entry.completedCount += 1;
    if (session.volume != null) entry.volume = (entry.volume ?? 0) + session.volume;
    dayCounts.set(session.localDate, entry);
  }
  const days: TrainingDay[] = [...dayCounts.entries()]
    .map(([localDate, entry]) => ({ localDate, ...entry }))
    .sort((a, b) => a.localDate.localeCompare(b.localDate));

  /* Falls back to the earliest session supplied — every session, not just
     those inside the window, since a session older than the window is still
     evidence the user had started logging. `options.firstActivityDate` wins
     where the caller knows the unwindowed truth. */
  const derivedFirstActivity = sessions.length
    ? sessions.reduce((min, s) => (s.localDate < min ? s.localDate : min), sessions[0]!.localDate)
    : null;
  const firstActivityDate =
    options.firstActivityDate !== undefined ? options.firstActivityDate : derivedFirstActivity;

  return {
    weeks,
    days,
    firstActivityDate,
    weeksTrained: weeks.filter((week) => week.completedCount > 0).length,
    windowWeeks,
    currentStreakWeeks,
    longestStreakWeeks,
    totalCompleted,
    totalRestDays: weeks.reduce((sum, week) => sum + week.restCount, 0),
    averageSessionsPerWeek: weeks.length ? totalCompleted / weeks.length : 0,
  };
}
