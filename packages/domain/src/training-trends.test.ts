import { describe, expect, it } from 'vitest';
import {
  buildWeekWindow,
  weekStart,
  summarizeTrainingTrends,
  type TrainingSessionInput,
} from './training-trends';

/* Setframe weeks run Sunday-Saturday (see `week.ts`). 2025-08-03, 2025-08-10
   and 2025-08-17 are Sundays; END (2025-08-22) is the Friday inside the last
   of them. Dates below were chosen so the boundary is exercised rather than
   sidestepped by landing mid-week. */
const END = '2025-08-22';

function sessions(...dates: string[]): TrainingSessionInput[] {
  return dates.map((localDate) => ({ localDate }));
}

describe('week window', () => {
  it('anchors weeks on Sunday', () => {
    expect(weekStart('2025-08-03')).toBe('2025-08-03'); // Sunday itself
    expect(weekStart('2025-08-09')).toBe('2025-08-03'); // Saturday, last day
    expect(weekStart('2025-08-10')).toBe('2025-08-10'); // next Sunday
    // The old ISO rule put Sunday at the *end* of the previous week.
    expect(weekStart('2025-08-04')).toBe('2025-08-03'); // Monday
  });

  it('emits a contiguous window of exactly the requested length', () => {
    const window = buildWeekWindow(END, 8);
    expect(window).toHaveLength(8);
    expect(window.at(-1)).toBe('2025-08-17');
    expect(window[0]).toBe('2025-06-29');
  });

  it('ends with the week containing the end date', () => {
    // Monday and the Saturday six days later are the same Sunday-anchored
    // week, so both windows end on the same date.
    expect(buildWeekWindow('2025-08-18', 3).at(-1)).toBe('2025-08-17');
    expect(buildWeekWindow('2025-08-23', 3).at(-1)).toBe('2025-08-17');
    // The Sunday after it opens a new week rather than closing that one.
    expect(buildWeekWindow('2025-08-24', 3).at(-1)).toBe('2025-08-24');
  });
});

describe('zero-session weeks are visible', () => {
  // The core Story 14 regression: an "8 week" chart used to render as one
  // dot because untrained weeks were simply missing from the series.
  it('returns every week in the window even when only one has sessions', () => {
    const trends = summarizeTrainingTrends(sessions('2025-08-19'), END, 8);
    expect(trends.weeks).toHaveLength(8);
    expect(trends.weeks.filter((week) => week.completedCount === 0)).toHaveLength(7);
    expect(trends.weeks.at(-1)!.completedCount).toBe(1);
  });

  it('returns a full window of zeroes for a user who has never trained', () => {
    const trends = summarizeTrainingTrends([], END, 8);
    expect(trends.weeks).toHaveLength(8);
    expect(trends.totalCompleted).toBe(0);
    expect(trends.weeksTrained).toBe(0);
    expect(trends.currentStreakWeeks).toBe(0);
    expect(trends.averageSessionsPerWeek).toBe(0);
  });

  it('marks the current week so the chart can distinguish it', () => {
    const trends = summarizeTrainingTrends([], END, 8);
    expect(trends.weeks.filter((week) => week.isCurrent)).toHaveLength(1);
    expect(trends.weeks.at(-1)!.isCurrent).toBe(true);
  });

  it('ignores sessions outside the window instead of folding them into the edge', () => {
    const trends = summarizeTrainingTrends(sessions('2024-01-01', '2025-08-19'), END, 8);
    expect(trends.totalCompleted).toBe(1);
    expect(trends.weeks[0]!.completedCount).toBe(0);
  });
});

describe('completion ratio', () => {
  // Previously plannedCount was set equal to completedCount, so the ratio
  // was always 1.0 and the metric said nothing at all.
  it('reports null rather than 100% when the plan is unknown', () => {
    const trends = summarizeTrainingTrends(sessions('2025-08-19', '2025-08-20'), END, 8);
    expect(trends.weeks.at(-1)!.plannedCount).toBeNull();
    expect(trends.weeks.at(-1)!.completionRatio).toBeNull();
  });

  it('computes a real ratio when the plan is known', () => {
    const trends = summarizeTrainingTrends(sessions('2025-08-19', '2025-08-20'), END, 8, {
      plannedByWeek: { '2025-08-17': 4 },
    });
    expect(trends.weeks.at(-1)!.completionRatio).toBe(0.5);
  });

  it('caps the ratio at 1 when a user trains more than planned', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-08-18', '2025-08-19', '2025-08-20'),
      END,
      8,
      { plannedByWeek: { '2025-08-17': 2 } },
    );
    expect(trends.weeks.at(-1)!.completionRatio).toBe(1);
  });

  it('reports null for a week planned as zero rather than dividing by zero', () => {
    const trends = summarizeTrainingTrends([], END, 8, { plannedByWeek: { '2025-08-18': 0 } });
    expect(trends.weeks.at(-1)!.completionRatio).toBeNull();
  });
});

describe('weeks trained and streaks', () => {
  it('counts weeks trained across the window regardless of gaps', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-06-30', '2025-07-14', '2025-08-18'),
      END,
      8,
    );
    expect(trends.weeksTrained).toBe(3);
    expect(trends.windowWeeks).toBe(8);
  });

  // The point of preferring weeks-trained over streak: a single missed week
  // costs one point here, where a streak would reset to zero.
  it('degrades gracefully when a week is missed', () => {
    const unbroken = summarizeTrainingTrends(
      sessions('2025-06-30', '2025-07-07', '2025-07-14', '2025-07-21'),
      '2025-07-25',
      4,
    );
    const missed = summarizeTrainingTrends(
      sessions('2025-06-30', '2025-07-07', '2025-07-21'),
      '2025-07-25',
      4,
    );
    expect(unbroken.weeksTrained).toBe(4);
    expect(missed.weeksTrained).toBe(3);
    expect(missed.currentStreakWeeks).toBe(1);
  });

  it('keeps the longest streak after the current one breaks', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-06-30', '2025-07-07', '2025-07-14', '2025-08-18'),
      END,
      8,
    );
    expect(trends.longestStreakWeeks).toBe(3);
    expect(trends.currentStreakWeeks).toBe(1);
  });

  // An empty Monday must not read as "streak broken" while the week is live.
  it('does not break the streak just because the current week is still empty', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-08-04', '2025-08-11'),
      '2025-08-19',
      4,
    );
    expect(trends.weeks.at(-1)!.completedCount).toBe(0);
    expect(trends.currentStreakWeeks).toBe(2);
  });

  it('counts the current week in the streak once it has a session', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-08-04', '2025-08-11', '2025-08-19'),
      '2025-08-19',
      4,
    );
    expect(trends.currentStreakWeeks).toBe(3);
  });
});

describe('weekly volume', () => {
  it('sums volume per week and leaves untrained weeks null rather than zero', () => {
    const trends = summarizeTrainingTrends(
      [
        { localDate: '2025-08-19', volume: 5000 },
        { localDate: '2025-08-20', volume: 3005 },
      ],
      END,
      8,
    );
    expect(trends.weeks.at(-1)!.volume).toBe(8005);
    expect(trends.weeks[0]!.volume).toBeNull();
  });

  // Cardio and bodyweight sessions carry no load, so they must not create a
  // zero-volume week that looks like a failed training week.
  it('leaves volume null for a week of non-load training', () => {
    const trends = summarizeTrainingTrends([{ localDate: '2025-08-19', volume: null }], END, 8);
    expect(trends.weeks.at(-1)!.completedCount).toBe(1);
    expect(trends.weeks.at(-1)!.volume).toBeNull();
  });
});

describe('averages', () => {
  it('averages sessions across the whole window including empty weeks', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-08-18', '2025-08-19', '2025-08-20', '2025-08-21'),
      END,
      4,
    );
    expect(trends.totalCompleted).toBe(4);
    expect(trends.averageSessionsPerWeek).toBe(1);
  });
});

describe('rest days', () => {
  /* Saturday, so it shares a Sunday-anchored week with `weekOf(0)`
     (2025-03-24, the Monday of that same week). Under the old Monday rule the
     Sunday 2025-03-30 closed that week; under Sunday weeks it opens the next
     one, which would put `end` and `weekOf(0)` in different weeks. */
  const end = '2025-03-29';

  function weekOf(offsetWeeks: number) {
    const base = Date.parse('2025-03-24T00:00:00Z');
    return new Date(base - offsetWeeks * 7 * 86_400_000).toISOString().slice(0, 10);
  }

  it('does not count a rest-only week as a trained week', () => {
    const result = summarizeTrainingTrends(
      [{ localDate: weekOf(2) }, { localDate: weekOf(0) }],
      end,
      4,
      { restDates: [weekOf(1), weekOf(1)] },
    );
    expect(result.weeksTrained).toBe(2);
    expect(result.totalRestDays).toBe(2);
  });

  // The rule the user chose: neutral. Resting must not manufacture a streak.
  it('bridges a streak across a rest-only week without extending it', () => {
    const rested = summarizeTrainingTrends(
      [{ localDate: weekOf(2) }, { localDate: weekOf(0) }],
      end,
      4,
      { restDates: [weekOf(1)] },
    );
    expect(rested.currentStreakWeeks).toBe(2);
    expect(rested.longestStreakWeeks).toBe(2);
  });

  it('still breaks a streak on a week that was neither trained nor rested', () => {
    const abandoned = summarizeTrainingTrends(
      [{ localDate: weekOf(2) }, { localDate: weekOf(0) }],
      end,
      4,
      {},
    );
    expect(abandoned.currentStreakWeeks).toBe(1);
  });

  it('cannot build a streak out of rest days alone', () => {
    const result = summarizeTrainingTrends([], end, 4, {
      restDates: [weekOf(0), weekOf(1), weekOf(2), weekOf(3)],
    });
    expect(result.currentStreakWeeks).toBe(0);
    expect(result.longestStreakWeeks).toBe(0);
    expect(result.weeksTrained).toBe(0);
  });

  it('marks a rest-only week so the UI can distinguish it from a gap', () => {
    const result = summarizeTrainingTrends([{ localDate: weekOf(0) }], end, 3, {
      restDates: [weekOf(1)],
    });
    const rest = result.weeks.find((week) => week.weekStart === weekStart(weekOf(1)));
    const gap = result.weeks.find((week) => week.weekStart === weekStart(weekOf(2)));
    expect(rest?.isRestWeek).toBe(true);
    expect(rest?.restCount).toBe(1);
    expect(gap?.isRestWeek).toBe(false);
  });

  it('does not treat a week with both training and rest as a rest week', () => {
    const result = summarizeTrainingTrends([{ localDate: weekOf(0) }], end, 2, {
      restDates: [weekOf(0)],
    });
    const current = result.weeks.at(-1)!;
    expect(current.isRestWeek).toBe(false);
    expect(current.restCount).toBe(1);
    expect(current.completedCount).toBe(1);
  });

  it('ignores rest days outside the window', () => {
    const result = summarizeTrainingTrends([], end, 2, { restDates: ['2024-01-01'] });
    expect(result.totalRestDays).toBe(0);
  });
});

/**
 * Story 50 — the W and M ranges need day resolution. Weekly buckets are the
 * wrong grain there: a seven-bar week chart drawn from `weeks` is one bar.
 */
describe('daily rollup', () => {
  it('reports each training day separately', () => {
    const result = summarizeTrainingTrends(sessions('2025-08-19', '2025-08-21'), END, 2);
    expect(result.days).toEqual([
      { localDate: '2025-08-19', completedCount: 1, volume: null },
      { localDate: '2025-08-21', completedCount: 1, volume: null },
    ]);
  });

  it('sums two sessions logged on the same day', () => {
    const result = summarizeTrainingTrends(sessions('2025-08-19', '2025-08-19'), END, 2);
    expect(result.days).toHaveLength(1);
    expect(result.days[0]!.completedCount).toBe(2);
  });

  it('agrees with the weekly totals it is built from', () => {
    const result = summarizeTrainingTrends(
      sessions('2025-08-19', '2025-08-21', '2025-08-12'),
      END,
      2,
    );
    const dayTotal = result.days.reduce((sum, day) => sum + day.completedCount, 0);
    expect(dayTotal).toBe(result.totalCompleted);
  });

  it('omits a day with no session rather than emitting a zero', () => {
    // Whether an absence *means* zero depends on when the user started
    // logging — a question for the consumer, via firstActivityDate.
    const result = summarizeTrainingTrends(sessions('2025-08-19'), END, 2);
    expect(result.days.map((day) => day.localDate)).toEqual(['2025-08-19']);
  });

  it('keeps volume null for a day of non-load training', () => {
    const result = summarizeTrainingTrends([{ localDate: '2025-08-19', volume: null }], END, 2);
    expect(result.days[0]!.volume).toBeNull();
  });

  it('sums volume across a day, and never folds null into a 0', () => {
    const result = summarizeTrainingTrends(
      [
        { localDate: '2025-08-19', volume: 1000 },
        { localDate: '2025-08-19', volume: null },
        { localDate: '2025-08-19', volume: 500 },
      ],
      END,
      2,
    );
    expect(result.days[0]!.volume).toBe(1500);
  });

  it('excludes sessions outside the window, as the weekly buckets do', () => {
    const result = summarizeTrainingTrends(sessions('2025-08-19', '2024-01-05'), END, 2);
    expect(result.days.map((day) => day.localDate)).toEqual(['2025-08-19']);
  });
});

describe('firstActivityDate', () => {
  it('is the earliest session date', () => {
    const result = summarizeTrainingTrends(sessions('2025-08-21', '2025-08-12'), END, 2);
    expect(result.firstActivityDate).toBe('2025-08-12');
  });

  it('is null when nothing has been logged', () => {
    expect(summarizeTrainingTrends([], END, 2).firstActivityDate).toBeNull();
  });

  it('prefers the caller-supplied date over the earliest session in view', () => {
    // The API knows the unwindowed answer from its own query; `sessions` here
    // is already trimmed, so deriving from it would pin the user's history to
    // the window's own start.
    const result = summarizeTrainingTrends(sessions('2025-08-21'), END, 2, {
      firstActivityDate: '2023-11-02',
    });
    expect(result.firstActivityDate).toBe('2023-11-02');
  });

  it('honours an explicit null from a caller that knows there is no history', () => {
    const result = summarizeTrainingTrends(sessions('2025-08-21'), END, 2, {
      firstActivityDate: null,
    });
    expect(result.firstActivityDate).toBeNull();
  });

  it('counts a session older than the window as evidence the user was logging', () => {
    // The question is "had they started by then", and a session that predates
    // the window still answers yes — even though it is excluded from `weeks`.
    const result = summarizeTrainingTrends(sessions('2025-08-21', '2024-01-05'), END, 2);
    expect(result.firstActivityDate).toBe('2024-01-05');
  });
});
