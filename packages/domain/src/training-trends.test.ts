import { describe, expect, it } from 'vitest';
import {
  buildWeekWindow,
  isoWeekStart,
  summarizeTrainingTrends,
  type TrainingSessionInput,
} from './training-trends';

// 2025-08-04, 2025-08-11 and 2025-08-18 are Mondays.
const END = '2025-08-22';

function sessions(...dates: string[]): TrainingSessionInput[] {
  return dates.map((localDate) => ({ localDate }));
}

describe('week window', () => {
  it('anchors weeks on Monday', () => {
    expect(isoWeekStart('2025-08-04')).toBe('2025-08-04');
    expect(isoWeekStart('2025-08-10')).toBe('2025-08-04');
    expect(isoWeekStart('2025-08-11')).toBe('2025-08-11');
  });

  it('emits a contiguous window of exactly the requested length', () => {
    const window = buildWeekWindow(END, 8);
    expect(window).toHaveLength(8);
    expect(window.at(-1)).toBe('2025-08-18');
    expect(window[0]).toBe('2025-06-30');
  });

  it('ends with the week containing the end date', () => {
    expect(buildWeekWindow('2025-08-18', 3).at(-1)).toBe('2025-08-18');
    expect(buildWeekWindow('2025-08-24', 3).at(-1)).toBe('2025-08-18');
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
      plannedByWeek: { '2025-08-18': 4 },
    });
    expect(trends.weeks.at(-1)!.completionRatio).toBe(0.5);
  });

  it('caps the ratio at 1 when a user trains more than planned', () => {
    const trends = summarizeTrainingTrends(
      sessions('2025-08-18', '2025-08-19', '2025-08-20'),
      END,
      8,
      { plannedByWeek: { '2025-08-18': 2 } },
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
  const end = '2025-03-30';

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
    const rest = result.weeks.find((week) => week.weekStart === isoWeekStart(weekOf(1)));
    const gap = result.weeks.find((week) => week.weekStart === isoWeekStart(weekOf(2)));
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
