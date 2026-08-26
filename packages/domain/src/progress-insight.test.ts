import { describe, expect, it } from 'vitest';
import {
  buildProgressInsight,
  describeInsight,
  previousWindowFor,
  type InsightMetric,
} from './progress-insight';
import type { SeriesPoint } from './chart-geometry';

/** Deterministic "today" so calendar arithmetic is stable. 2026-08-25 is a Tuesday. */
const TUESDAY = '2026-08-25';
/**
 * Six of seven days elapsed in the Sunday-anchored week (Sun 23 - Sat 29):
 * still partial, but past the coverage floor an averaging metric needs before
 * its mean may stand for the period. Three days of morning weight is noise,
 * not an average — see `AVERAGING_MIN_COVERAGE`.
 */
const FRIDAY = '2026-08-28';
/** Saturday — the last day of the week, so the period is complete. */
const SATURDAY = '2026-08-29';

function points(entries: Array<[string, number]>): SeriesPoint[] {
  return entries.map(([localDate, value]) => ({ localDate, value }));
}

/** One session logged on each given date, as a count-aggregated series. */
function sessions(dates: string[]): SeriesPoint[] {
  return dates.map((localDate) => ({ localDate, value: 1 }));
}

describe('previousWindowFor', () => {
  it('returns the calendar-equivalent window immediately before', () => {
    // Current week is Sun 23rd - Sat 29th; previous is Sun 16th - Sat 22nd.
    const previous = previousWindowFor('W', { start: '2026-08-23', end: '2026-08-29' });
    expect(previous).toEqual({ start: '2026-08-16', end: '2026-08-22' });
  });

  it('uses real calendar months rather than a fixed day count', () => {
    const previous = previousWindowFor('M', { start: '2026-03-01', end: '2026-03-31' });
    // February, not "30 days" — the month before March starts in February.
    expect(previous!.end).toBe('2026-02-28');
    expect(previous!.start.startsWith('2026-01')).toBe(true);
  });

  it('has no previous period for ALL', () => {
    expect(previousWindowFor('ALL', { start: '2026-01-01', end: TUESDAY })).toBeNull();
  });
});

/**
 * The heart of the story: comparing a partial period against a complete one
 * is an artefact, not a comparison. Accumulating metrics truncate the
 * previous window to the same elapsed days; averaging metrics do not need to.
 */
describe('partial-period comparison', () => {
  it('matches elapsed days for accumulating metrics', () => {
    /* Tuesday is 3 days into the Sunday-anchored week (Sun 23, Mon 24,
       Tue 25). Last week ran Sun 16 - Sat 22 with a session every day, but
       only its first 3 days may be compared against. */
    const raw = sessions([
      '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19',
      '2026-08-20', '2026-08-21', '2026-08-22',
      '2026-08-23', '2026-08-24', '2026-08-25',
    ]);
    const insight = buildProgressInsight(raw, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });

    expect(insight.current.isPartial).toBe(true);
    expect(insight.current.elapsedDays).toBe(3);
    expect(insight.current.value).toBe(3);
    expect(insight.comparisonBasis).toBe('elapsed_matched');
    // Previous window truncated to Sun-Tue, not the full week.
    expect(insight.previous!.end).toBe('2026-08-18');
    expect(insight.previous!.value).toBe(3);
    // Like-for-like: no change, rather than "3 vs 7".
    expect(insight.change!.absolute).toBe(0);
  });

  it('uses the whole previous period for averaging metrics', () => {
    const raw = points([
      ['2026-08-16', 168], ['2026-08-18', 168], ['2026-08-20', 168],
      ['2026-08-23', 170], ['2026-08-24', 170], ['2026-08-25', 170],
    ]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'W',
      endLocalDate: FRIDAY,
      aggregation: 'mean',
    });

    expect(insight.comparisonBasis).toBe('full_period');
    // Full previous week, not truncated to the elapsed days.
    expect(insight.previous!.end).toBe('2026-08-22');
    expect(insight.previous!.value).toBe(168);
    expect(insight.current.value).toBe(170);
    expect(insight.change!.absolute).toBe(2);
  });

  /**
   * `/progress/overview` returns training data pre-aggregated by week, so a
   * previous window truncated to Sunday–Tuesday still contains the whole
   * previous week's bucket. Elapsed-matching that source would reintroduce
   * the artefact it exists to prevent, from the other direction.
   */
  it('falls back to whole periods when the source is only weekly', () => {
    const weekly: SeriesPoint[] = [
      { localDate: '2026-08-16', value: 3 },
      { localDate: '2026-08-23', value: 2 },
    ];
    const insight = buildProgressInsight(weekly, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'sum',
      emptyIsZero: true,
      sourceGranularity: 'week',
    });

    expect(insight.comparisonBasis).toBe('full_period');
    // The whole previous week, not a truncated slice of it.
    expect(insight.previous!.end).toBe('2026-08-22');
    expect(insight.previous!.value).toBe(3);
    expect(insight.current.value).toBe(2);
    // Still flagged partial, so copy says "so far" rather than implying a
    // finished week — the honest reading of an unfinished comparison.
    expect(insight.current.isPartial).toBe(true);
    expect(insight.dataQuality).toContain('partial_current_period');
  });

  it('flags a complete period as not partial', () => {
    const raw = sessions(['2026-08-24', '2026-08-26']);
    const insight = buildProgressInsight(raw, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: SATURDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });
    expect(insight.current.isPartial).toBe(false);
    expect(insight.dataQuality).not.toContain('partial_current_period');
    expect(insight.comparisonBasis).toBe('full_period');
  });
});

describe('availability', () => {
  it('reports insufficient_data with nothing logged', () => {
    const insight = buildProgressInsight([], {
      metric: 'body_weight',
      range: 'M',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    expect(insight.availability).toBe('insufficient_data');
    expect(insight.change).toBeNull();
    expect(describeInsight(insight, { unit: 'lb' })).toBeNull();
  });

  it('reports no_comparison when history starts inside the current period', () => {
    const raw = points([['2026-08-24', 168], ['2026-08-25', 169], ['2026-08-27', 168.5]]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'W',
      endLocalDate: FRIDAY,
      aggregation: 'mean',
    });
    expect(insight.availability).toBe('no_comparison');
    expect(insight.dataQuality).toContain('no_previous_period');
    // Nothing to compare against means nothing worth saying.
    expect(describeInsight(insight, { unit: 'lb' })).toBeNull();
  });

  it('reports no_comparison for ALL, which has no previous period', () => {
    const raw = points([['2026-06-01', 170], ['2026-07-01', 169], ['2026-08-01', 168]]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'ALL',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    expect(insight.previous).toBeNull();
    expect(insight.comparisonBasis).toBe('none');
    expect(insight.availability).toBe('no_comparison');
  });
});

describe('data quality flags', () => {
  it('flags a single observation', () => {
    const raw = points([['2026-08-25', 168]]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    expect(insight.dataQuality).toContain('single_observation');
  });

  it('flags sparse previous data', () => {
    const raw = points([
      ['2026-08-18', 170],
      ['2026-08-24', 168], ['2026-08-25', 168],
    ]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
      minimumSamples: 3,
    });
    expect(insight.dataQuality).toContain('sparse_previous_period');
  });

  it('flags gaps only where absence is genuinely unknown', () => {
    // Body weight: unweighed days are unknown, so a gap is real.
    const weight = buildProgressInsight(points([['2026-08-24', 168]]), {
      metric: 'body_weight',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    expect(weight.dataQuality).toContain('gaps_in_window');

    // Sessions: a day with no session is a real zero, not a gap.
    const frequency = buildProgressInsight(sessions(['2026-08-24']), {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });
    expect(frequency.dataQuality).not.toContain('gaps_in_window');
  });
});

describe('change and direction', () => {
  it('leaves percent null when the previous value is zero', () => {
    /* History has to start before last week for last week's emptiness to be a
       real zero rather than an absence of data — an empty week the user was
       not yet around for is not something to compare against. */
    const raw = sessions(['2026-08-05', '2026-08-24', '2026-08-25']);
    const insight = buildProgressInsight(raw, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });
    // Previous week is empty -> 0 sessions. "Up from nothing" has no percentage.
    expect(insight.previous!.value).toBe(0);
    expect(insight.change!.percent).toBeNull();
    expect(insight.change!.absolute).toBe(2);
  });

  /**
   * `emptyIsZero` must not manufacture a baseline out of a period that
   * predates the user's first observation. Otherwise someone's very first
   * logged week reads as "2 sessions, compared with 0 last week" — a
   * comparison against a week they had not started logging in.
   */
  it('does not treat a period before any data as a zero baseline', () => {
    const raw = sessions(['2026-08-24', '2026-08-25']);
    const insight = buildProgressInsight(raw, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });

    expect(insight.availability).toBe('no_comparison');
    expect(insight.change).toBeNull();
    expect(insight.dataQuality).toContain('no_previous_period');
    expect(describeInsight(insight)).toBeNull();
  });

  it('reports a small relative move as flat rather than a direction', () => {
    const raw = points([
      ['2026-07-20', 168], ['2026-07-22', 168], ['2026-07-24', 168],
      ['2026-08-20', 168.1], ['2026-08-22', 168.1], ['2026-08-24', 168.1],
    ]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'M',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    expect(insight.trend!.direction).toBe('flat');
  });

  it('raises confidence with sample count, not with magnitude', () => {
    const sparse = buildProgressInsight(points([['2026-08-24', 168], ['2026-08-25', 169]]), {
      metric: 'body_weight', range: 'W', endLocalDate: FRIDAY, aggregation: 'mean',
    });
    expect(sparse.trend!.confidence).toBe('low');

    const dense = buildProgressInsight(
      points(Array.from({ length: 9 }, (_, i) => [`2026-08-${17 + i}`, 168] as [string, number])),
      { metric: 'body_weight', range: 'M', endLocalDate: TUESDAY, aggregation: 'mean' },
    );
    expect(dense.trend!.confidence).toBe('high');
  });
});

/**
 * `describeInsight` is where "no insight is better than a meaningless
 * insight" is enforced, so its silences matter as much as its sentences.
 */
describe('describeInsight', () => {
  it('states a frequency comparison against the matched span', () => {
    const raw = sessions(['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-24']);
    const insight = buildProgressInsight(raw, {
      metric: 'training_frequency',
      range: 'W',
      endLocalDate: TUESDAY,
      aggregation: 'count',
      emptyIsZero: true,
    });
    const copy = describeInsight(insight);
    expect(copy).toContain('1 session');
    expect(copy).toContain('so far');
    // Names the matched span rather than implying all of last week.
    expect(copy).toContain('by this point last week');
  });

  it('states body weight against its average, never a day-over-day delta', () => {
    const raw = points([
      ['2026-07-20', 167.5], ['2026-07-22', 167.5], ['2026-07-24', 167.5],
      ['2026-08-20', 168.5], ['2026-08-22', 168.5], ['2026-08-24', 168.5],
    ]);
    const insight = buildProgressInsight(raw, {
      metric: 'body_weight',
      range: 'M',
      endLocalDate: TUESDAY,
      aggregation: 'mean',
    });
    const copy = describeInsight(insight, { unit: 'lb' })!;
    expect(copy).toContain('average');
    expect(copy).toContain('168.5 lb');
    expect(copy).toContain('above');
  });

  it('says nothing when there is nothing to compare against', () => {
    const insight = buildProgressInsight(points([['2026-08-25', 168]]), {
      metric: 'body_weight', range: 'W', endLocalDate: TUESDAY, aggregation: 'mean',
    });
    expect(describeInsight(insight, { unit: 'lb' })).toBeNull();
  });

  it('never evaluates the direction it reports', () => {
    const gaining = buildProgressInsight(
      points([
        ['2026-07-20', 165], ['2026-07-22', 165], ['2026-07-24', 165],
        ['2026-08-20', 172], ['2026-08-22', 172], ['2026-08-24', 172],
      ]),
      { metric: 'body_weight', range: 'M', endLocalDate: TUESDAY, aggregation: 'mean' },
    );
    const copy = describeInsight(gaining, { unit: 'lb' })!;
    // Reports movement without praising or warning about it. A user
    // deliberately bulking is succeeding when this number rises.
    expect(copy).toMatch(/above/);
    expect(copy).not.toMatch(/great|nice|good|bad|careful|watch out|keep it up/i);
  });

  it('does not merely restate the headline number', () => {
    const insight = buildProgressInsight(
      points([
        ['2026-07-20', 167], ['2026-07-22', 167],
        ['2026-08-20', 168], ['2026-08-24', 168],
      ]),
      { metric: 'body_weight', range: 'M', endLocalDate: TUESDAY, aggregation: 'mean' },
    );
    const copy = describeInsight(insight, { unit: 'lb' })!;
    // Every insight carries a comparison, which is what separates it from
    // the value already printed above the chart.
    expect(copy).toMatch(/above|below|unchanged/);
  });

  it('produces nothing for every metric when data is insufficient', () => {
    const metrics: InsightMetric[] = ['body_weight', 'training_frequency', 'training_volume'];
    for (const metric of metrics) {
      const insight = buildProgressInsight([], {
        metric, range: 'M', endLocalDate: TUESDAY, aggregation: 'mean',
      });
      expect(describeInsight(insight)).toBeNull();
    }
  });
});
