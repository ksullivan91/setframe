import { describe, expect, it } from 'vitest';
import type { SeriesPoint } from './chart-geometry';
import {
  bucketForRange,
  bucketStart,
  bucketWindow,
  buildProgressSeries,
  comparePeriods,
  countBucketForRange,
  currentPeriodLabel,
  daysBetween,
  defaultRange,
  monthStart,
  describeBucketValue,
  formatBucketPeriod,
  progressRangeLabel,
  progressRanges,
  rangeOptions,
  subtractMonths,
  windowForRange,
} from './progress-range';
import { isoWeekStart } from './training-trends';

/* Deterministic fixtures, per the story's list. `END` is a Tuesday, so the
   Monday-anchored week boundary is exercised rather than accidentally
   avoided by picking a Sunday or Monday. */
const END = '2026-08-25'; // Tuesday

function daily(startLocalDate: string, count: number, valueAt: (index: number) => number | null): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  const start = Date.parse(`${startLocalDate}T00:00:00Z`);
  for (let index = 0; index < count; index += 1) {
    points.push({
      localDate: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
      value: valueAt(index),
    });
  }
  return points;
}

const fourDays = daily('2026-08-22', 4, (i) => 170 + i);
const fourWeeks = daily('2026-07-29', 28, (i) => 170 + i * 0.1);
const fourMonths = daily('2026-04-28', 120, (i) => 175 - i * 0.05);
const oneYear = daily('2025-08-25', 366, (i) => 180 - i * 0.03);
/* A fortnight logged, a fortnight missing, a fortnight logged — a real
   training break, not scattered single-day holes. */
const withGap = daily('2026-06-30', 56, (i) => (i >= 14 && i < 28 ? null : 172 + i * 0.02));

describe('calendar arithmetic', () => {
  it('subtracts months by calendar, clamping to the last valid day', () => {
    expect(subtractMonths('2026-03-31', 1)).toBe('2026-02-28');
    expect(subtractMonths('2026-08-25', 3)).toBe('2026-05-25');
    expect(subtractMonths('2026-01-15', 12)).toBe('2025-01-15');
  });

  it('does not drift the way a fixed day count does', () => {
    // 3 months before 2026-08-25 is 2026-05-25. A 91-day window — what the
    // superseded model used — lands on 2026-05-26, a day out.
    expect(windowForRange('3M', END).start).toBe('2026-05-25');
    expect(daysBetween('2026-05-25', END)).not.toBe(91);
  });

  it('anchors the week window to Monday, matching "since Monday" copy', () => {
    // END is a Tuesday; its week starts the day before.
    expect(windowForRange('W', END).start).toBe('2026-08-24');
    expect(bucketStart('2026-08-30', 'week')).toBe('2026-08-24'); // Sunday → same Monday
    expect(bucketStart('2026-08-31', 'week')).toBe('2026-08-31'); // next Monday
  });

  it('starts month buckets on the first', () => {
    expect(monthStart('2026-08-25')).toBe('2026-08-01');
  });
});

describe('bucketForRange', () => {
  it('never uses one bucket size for every range', () => {
    const buckets = new Set(progressRanges.map((range) => bucketForRange(range, 500)));
    expect(buckets.size).toBeGreaterThan(1);
  });

  it('scales ALL by how much history exists', () => {
    expect(bucketForRange('ALL', 20)).toBe('day');
    expect(bucketForRange('ALL', 200)).toBe('week');
    expect(bucketForRange('ALL', 900)).toBe('month');
  });
});

describe('bucketWindow', () => {
  it('emits empty buckets so a gap occupies real space on the axis', () => {
    const starts = bucketWindow({ start: '2026-08-01', end: '2026-08-05' }, 'day');
    expect(starts).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('covers the end date even when it falls mid-bucket', () => {
    const starts = bucketWindow({ start: '2026-08-01', end: END }, 'week');
    expect(starts.at(-1)).toBe('2026-08-24'); // the Monday of END's week
  });
});

describe('buildProgressSeries — the defect this story fixes', () => {
  /* The superseded `filterByRange` trimmed a window but never re-bucketed,
     so mark count grew without bound: 383 marks at ALL over a 500-day
     fixture. These assert the opposite property — that a longer range does
     not simply mean more marks. */
  it('holds mark count roughly constant as the range grows', () => {
    const counts = (['M', '3M', '6M', 'Y'] as const).map(
      (range) =>
        buildProgressSeries(oneYear, { range, endLocalDate: END, aggregation: 'mean' }).points.length,
    );
    for (const count of counts) {
      expect(count).toBeGreaterThan(4);
      expect(count).toBeLessThanOrEqual(56);
    }
  });

  it('renders a year as weeks, not 366 daily marks', () => {
    const series = buildProgressSeries(oneYear, { range: 'Y', endLocalDate: END, aggregation: 'mean' });
    expect(series.bucket).toBe('week');
    expect(series.points.length).toBeLessThan(60);
  });

  it('changes bucket size between ranges over identical raw data', () => {
    const month = buildProgressSeries(fourMonths, { range: 'M', endLocalDate: END, aggregation: 'mean' });
    const halfYear = buildProgressSeries(fourMonths, { range: '6M', endLocalDate: END, aggregation: 'mean' });
    expect(month.bucket).toBe('day');
    expect(halfYear.bucket).toBe('week');
  });

  it('reports the window it actually displayed', () => {
    const series = buildProgressSeries(fourMonths, { range: '3M', endLocalDate: END, aggregation: 'mean' });
    expect(series.window).toEqual({ start: '2026-05-25', end: END });
  });
});

describe('buildProgressSeries — missing is missing', () => {
  it('yields null for an empty bucket, never zero', () => {
    const series = buildProgressSeries(withGap, { range: 'M', endLocalDate: END, aggregation: 'mean' });
    const empty = series.points.filter((point) => point.value === null);
    expect(empty.length).toBeGreaterThan(0);
    expect(series.points.some((point) => point.value === 0)).toBe(false);
  });

  it('emits zero only when absence genuinely means zero', () => {
    const series = buildProgressSeries(withGap, {
      range: 'M',
      endLocalDate: END,
      aggregation: 'count',
      emptyIsZero: true,
    });
    expect(series.points.some((point) => point.value === 0)).toBe(true);
    expect(series.points.some((point) => point.value === null)).toBe(false);
  });

  it('reports how many observations backed each bucket', () => {
    const twicePerDay: SeriesPoint[] = [
      { localDate: '2026-08-24', value: 170 },
      { localDate: '2026-08-24', value: 172 },
      { localDate: '2026-08-25', value: 171 },
    ];
    const series = buildProgressSeries(twicePerDay, { range: 'W', endLocalDate: END, aggregation: 'mean' });
    const monday = series.points.find((point) => point.localDate === '2026-08-24')!;
    expect(monday.sampleCount).toBe(2);
    expect(monday.value).toBe(171); // mean of the two check-ins
  });

  it('excludes observations outside the window rather than clamping them in', () => {
    const series = buildProgressSeries(oneYear, { range: 'W', endLocalDate: END, aggregation: 'mean' });
    expect(series.points.every((point) => point.localDate >= series.window.start)).toBe(true);
    expect(series.points.every((point) => point.localDate <= series.window.end)).toBe(true);
  });
});

describe('buildProgressSeries — aggregation', () => {
  it('sums volume-style data and counts session-style data', () => {
    const three: SeriesPoint[] = [
      { localDate: '2026-08-24', value: 100 },
      { localDate: '2026-08-24', value: 250 },
      { localDate: '2026-08-25', value: 50 },
    ];
    const summed = buildProgressSeries(three, { range: 'W', endLocalDate: END, aggregation: 'sum' });
    expect(summed.points.find((p) => p.localDate === '2026-08-24')!.value).toBe(350);

    const counted = buildProgressSeries(three, { range: 'W', endLocalDate: END, aggregation: 'count' });
    expect(counted.points.find((p) => p.localDate === '2026-08-24')!.value).toBe(2);
  });
});

describe('rangeOptions — shown-and-disabled, not hidden', () => {
  /* The superseded `availableRanges` returned [] below a threshold and the
     selector rendered null under two options, so sparse data made the
     control vanish and a reviewer concluded it was never built. */
  it('always offers every range, even with a single observation', () => {
    const options = rangeOptions([{ localDate: END, value: 170 }], END);
    expect(options.map((option) => option.range)).toEqual([...progressRanges]);
  });

  it('offers every range even with no data at all', () => {
    expect(rangeOptions([], END)).toHaveLength(progressRanges.length);
  });

  it('disables ranges that would show the same picture as a shorter one', () => {
    const options = rangeOptions(fourDays, END);
    const byRange = Object.fromEntries(options.map((option) => [option.range, option.disabled]));
    expect(byRange.W).toBe(false); // four days fits inside this week
    expect(byRange.Y).toBe(true); // a year of axis for four days of data
    expect(byRange.ALL).toBe(false); // ALL is always meaningful
  });

  /* The chart must never open on an option it simultaneously renders as
     unavailable. An earlier cut disabled *every* range that covered the
     data — including the tightest one, which is exactly what defaultRange
     selects — so body weight opened on a greyed-out 6M. Caught by looking
     at the screen, not by a test, which is why this one now exists. */
  it('never disables the range the chart opens on', () => {
    for (const fixture of [fourDays, fourWeeks, fourMonths, oneYear, withGap, []]) {
      const chosen = defaultRange(fixture, END);
      const option = rangeOptions(fixture, END).find((entry) => entry.range === chosen)!;
      expect({ range: chosen, disabled: option.disabled }).toEqual({ range: chosen, disabled: false });
    }
  });

  it('keeps the first covering range usable and disables only longer ones', () => {
    // ~5 months of data: 6M is the tightest covering range, Y is redundant.
    const fiveMonths = daily('2026-03-28', 150, (i) => 186 - i * 0.035);
    const byRange = Object.fromEntries(
      rangeOptions(fiveMonths, END).map((option) => [option.range, option.disabled]),
    );
    expect(byRange['6M']).toBe(false);
    expect(byRange.Y).toBe(true);
  });

  it('enables longer ranges once the history reaches them', () => {
    const byRange = Object.fromEntries(
      rangeOptions(oneYear, END).map((option) => [option.range, option.disabled]),
    );
    expect(byRange['3M']).toBe(false);
    expect(byRange['6M']).toBe(false);
  });
});

describe('defaultRange', () => {
  it('opens on the tightest window that still shows every observation', () => {
    // Four days spanning a Monday boundary do not fit inside "this week",
    // so the month is the tightest honest frame.
    expect(defaultRange(fourDays, END)).toBe('M');
    expect(defaultRange(fourWeeks, END)).toBe('M');
    expect(defaultRange(fourMonths, END)).toBe('6M');
  });

  it('never opens on a window that would omit older data', () => {
    for (const fixture of [fourDays, fourWeeks, fourMonths, oneYear]) {
      const range = defaultRange(fixture, END);
      const series = buildProgressSeries(fixture, { range, endLocalDate: END, aggregation: 'mean' });
      const earliest = fixture.filter((p) => p.value != null)[0]!.localDate;
      expect(series.window.start <= earliest).toBe(true);
    }
  });

  it('falls back to ALL with no data, and when history outgrows every window', () => {
    expect(defaultRange([], END)).toBe('ALL');
    expect(defaultRange(daily('2020-01-01', 5, () => 170), END)).toBe('ALL');
  });
});

describe('progressRangeLabel', () => {
  it('names every range', () => {
    for (const range of progressRanges) {
      expect(progressRangeLabel(range).length).toBeGreaterThan(0);
    }
  });
});

describe('meta survives bucketing', () => {
  /* The per-exercise chart navigates to `meta.sessionId`. A bucketed point
     that dropped its meta would be a mark the user can tap with nothing
     happening — drill-down silently dead. */
  const sessions: SeriesPoint<{ sessionId: string }>[] = [
    { localDate: '2026-08-24', value: 200, meta: { sessionId: 'mon' } },
    { localDate: '2026-08-25', value: 205, meta: { sessionId: 'tue' } },
  ];

  it('carries meta onto a day bucket', () => {
    const series = buildProgressSeries(sessions, { range: 'W', endLocalDate: END, aggregation: 'last' });
    expect(series.points.find((p) => p.localDate === '2026-08-25')?.meta).toEqual({ sessionId: 'tue' });
  });

  it('represents a multi-observation bucket by its most recent one', () => {
    const series = buildProgressSeries(sessions, { range: '6M', endLocalDate: END, aggregation: 'last' });
    expect(series.bucket).toBe('week');
    const week = series.points.find((p) => p.sampleCount === 2)!;
    expect(week.meta).toEqual({ sessionId: 'tue' });
  });
});

describe('ALL spans the data, not the calendar since the data', () => {
  /* Extending ALL to today would pad the axis with every empty day since
     the user last logged — and because bucket size derives from the
     window's span, a long silence silently coarsened the bucket. Twenty
     daily check-ins from a year ago collapsed into a single monthly dot,
     which is the opposite of what "all time" should show. */
  const staleButDense = daily('2025-07-01', 20, (i) => 180 - i * 0.15);

  it('keeps a dense old cluster at daily resolution', () => {
    const series = buildProgressSeries(staleButDense, {
      range: 'ALL',
      endLocalDate: END, // over a year after the last check-in
      aggregation: 'mean',
    });
    expect(series.bucket).toBe('day');
    expect(series.points).toHaveLength(20);
  });

  it('ends the window at the last observation, not today', () => {
    const series = buildProgressSeries(staleButDense, {
      range: 'ALL',
      endLocalDate: END,
      aggregation: 'mean',
    });
    expect(series.window).toEqual({ start: '2025-07-01', end: '2025-07-20' });
  });
});

/**
 * A bucketed mark is keyed by its bucket's *start* date. Rendering that key
 * with a plain day formatter states something false — at 6M a mark is a
 * week's mean, so "Aug 19" tells the user they weighed that value on the
 * 19th, a morning they may not have weighed at all.
 */
describe('formatBucketPeriod', () => {
  it('names a day bucket as the single day it is', () => {
    expect(formatBucketPeriod('2026-08-19', 'day')).toBe('Aug 19');
  });

  it('names a week bucket as its Monday-Sunday span, never its start day alone', () => {
    const label = formatBucketPeriod('2026-08-17', 'week');
    expect(label).toBe('Aug 17–23');
    // The precise failure being prevented: a week mark must not render as
    // the bare date of its first day.
    expect(label).not.toBe('Aug 17');
  });

  it('names a month bucket as its full span', () => {
    // Day-precise rather than "Aug": the span is short enough that
    // formatDateRangeLabel keeps day numbers, which is strictly more
    // informative and still true.
    expect(formatBucketPeriod('2026-08-01', 'month')).toBe('Aug 1–31');
  });

  it('handles a short February without running into March', () => {
    expect(formatBucketPeriod('2026-02-01', 'month')).toBe('Feb 1–28');
  });

  it('spans a week that crosses a month boundary', () => {
    expect(formatBucketPeriod('2026-08-31', 'week')).toBe('Aug 31 – Sep 6');
  });
});

describe('describeBucketValue', () => {
  it('says nothing for a single daily reading — that mark is the reading', () => {
    expect(describeBucketValue({ sampleCount: 1 }, 'day', 'mean')).toBeNull();
  });

  it('reports how many check-ins an averaged mark combines', () => {
    expect(describeBucketValue({ sampleCount: 5 }, 'week', 'mean')).toBe('average of 5 check-ins');
  });

  it('distinguishes a lone check-in in a week from a real average', () => {
    // Identical on the plot, very different confidence.
    expect(describeBucketValue({ sampleCount: 1 }, 'week', 'mean')).toBe('the only check-in that week');
  });

  it('says nothing for an empty bucket', () => {
    expect(describeBucketValue({ sampleCount: 0 }, 'week', 'mean')).toBeNull();
  });
});

/**
 * Story 50. A count chart may legitimately draw an empty period as zero —
 * "you trained no times that week" is a fact — but only for periods the user
 * was actually around for. Unbounded, selecting Y on a two-week-old account
 * renders fifty bars of a year of not training that never happened.
 */
describe('buildProgressSeries zeroFrom', () => {
  const oneSession: SeriesPoint[] = [{ localDate: '2026-08-24', value: 2 }];

  it('leaves buckets ending before the first activity unknown, not zero', () => {
    const series = buildProgressSeries(oneSession, {
      range: 'M',
      endLocalDate: '2026-08-25',
      aggregation: 'sum',
      emptyIsZero: true,
      zeroFrom: '2026-08-20',
    });
    const before = series.points.filter((point) => point.localDate < '2026-08-20');
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((point) => point.value === null)).toBe(true);
  });

  it('zeroes empty buckets once the user was logging', () => {
    const series = buildProgressSeries(oneSession, {
      range: 'M',
      endLocalDate: '2026-08-25',
      aggregation: 'sum',
      emptyIsZero: true,
      zeroFrom: '2026-08-20',
    });
    const after = series.points.filter((point) => point.localDate >= '2026-08-20');
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((point) => point.value !== null)).toBe(true);
  });

  it('zeroes an empty bucket the bound falls inside, rather than nulling it', () => {
    /* The week of Mon 2026-08-17 is empty, and the user's first session lands
       mid-week on the 20th. The bound must be compared against the bucket's
       *end*: comparing its start would null the very bucket the history
       begins in and punch a hole at the left edge of every chart. */
    const series = buildProgressSeries([{ localDate: '2026-08-31', value: 1 }], {
      range: '3M',
      endLocalDate: '2026-09-07',
      aggregation: 'sum',
      emptyIsZero: true,
      zeroFrom: '2026-08-20',
    });
    const boundWeek = series.points.find((point) => point.localDate === '2026-08-17');
    expect(boundWeek).toBeDefined();
    expect(boundWeek?.sampleCount).toBe(0);
    expect(boundWeek?.value).toBe(0);

    // ...while the week entirely before the bound stays unknown.
    const priorWeek = series.points.find((point) => point.localDate === '2026-08-10');
    expect(priorWeek?.value).toBeNull();
  });

  it('accepts a bucket override so a count chart can differ from a measurement', () => {
    const series = buildProgressSeries(oneSession, {
      range: 'M',
      endLocalDate: '2026-08-25',
      aggregation: 'sum',
      bucket: countBucketForRange('M', 31),
    });
    expect(series.bucket).toBe('week');
    // Every mark must land on a Monday once weekly.
    expect(series.points.every((point) => isoWeekStart(point.localDate) === point.localDate)).toBe(
      true,
    );
  });

  it('zeroes every empty bucket when no bound is given', () => {
    const series = buildProgressSeries(oneSession, {
      range: 'M',
      endLocalDate: '2026-08-25',
      aggregation: 'sum',
      emptyIsZero: true,
    });
    expect(series.points.every((point) => point.value !== null)).toBe(true);
  });
});

describe('comparePeriods', () => {
  function weekly(points: SeriesPoint[], end = '2026-08-25') {
    return buildProgressSeries(points, {
      range: '3M',
      endLocalDate: end,
      aggregation: 'sum',
      bucket: 'week',
      emptyIsZero: true,
      zeroFrom: points[0]?.localDate ?? null,
    });
  }

  it('reports the change between the last two periods', () => {
    const series = weekly([
      { localDate: '2026-08-03', value: 3 },
      { localDate: '2026-08-10', value: 2 },
      { localDate: '2026-08-24', value: 5 },
    ]);
    const comparison = comparePeriods(series, '2026-08-25')!;
    expect(comparison.current.value).toBe(5);
    // The week of the 17th was empty but the user was logging, so it is a
    // real zero and the change is measured against it.
    expect(comparison.previous?.value).toBe(0);
    expect(comparison.change).toBe(5);
  });

  it('withholds a comparison when the previous period predates the user', () => {
    /* The Story 51 trap: an unknown prior week treated as zero manufactures a
       baseline from a period the user was not there for — "compared with 0
       last week" for a week before they had an account. */
    const series = weekly([{ localDate: '2026-08-24', value: 2 }]);
    const previousUnknown = {
      ...series,
      points: [
        { localDate: '2026-08-17', value: null, sampleCount: 0 },
        series.points.at(-1)!,
      ],
    };
    const comparison = comparePeriods(previousUnknown, '2026-08-25')!;
    expect(comparison.previous?.value).toBeNull();
    expect(comparison.change).toBeNull();
  });

  it('flags a week still being lived in as partial', () => {
    // 2026-08-25 is a Tuesday; its week does not close until Sunday the 30th.
    expect(comparePeriods(weekly([{ localDate: '2026-08-24', value: 2 }]), '2026-08-25')!.isPartial).toBe(true);
  });

  it('treats a week as partial right up to its final day', () => {
    // Sunday the 30th closes the week, but it is still being lived in: the
    // user can train that evening, so the bar is not yet a finished total.
    const series = weekly([{ localDate: '2026-08-24', value: 2 }], '2026-08-30');
    expect(comparePeriods(series, '2026-08-30')!.isPartial).toBe(true);
  });

  it('does not flag a finished period a user has since stopped logging in', () => {
    /* ALL ends at the last observation rather than today, so its final bucket
       is genuinely complete — nothing more can land in a week that ended a
       month ago, and calling it "current" would be wrong. */
    const series = buildProgressSeries(
      [
        { localDate: '2026-06-08', value: 3 },
        { localDate: '2026-06-15', value: 2 },
      ],
      { range: 'ALL', endLocalDate: '2026-08-25', aggregation: 'sum', bucket: 'week' },
    );
    expect(comparePeriods(series, '2026-08-25')!.isPartial).toBe(false);
  });

  it('returns null when there are no buckets at all', () => {
    expect(comparePeriods({ range: 'W', window: { start: '2026-08-24', end: '2026-08-25' }, bucket: 'day', points: [] }, '2026-08-25')).toBeNull();
  });
});

describe('currentPeriodLabel', () => {
  it('names each bucket the way the user would say it', () => {
    expect(currentPeriodLabel('day')).toBe('Today');
    expect(currentPeriodLabel('week')).toBe('Current week');
    expect(currentPeriodLabel('month')).toBe('This month');
  });
});
