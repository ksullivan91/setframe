import { describe, expect, it } from 'vitest';
import { plotRect, timeAxis, valueAxis } from './plot';
import { buildStackedChart, compositionShare, type StackedBucket } from './stacked';
import { buildSmallMultiples, type LiftSeries } from './small-multiples';

const rect = plotRect({ width: 320, height: 160 });

describe('valueAxis', () => {
  it('never labels two gridlines the same when minStep is 1', () => {
    // The exact Story 50 defect: a session count topping out at 1 produced a
    // step of 0.5 and an axis reading "0, 1, 1".
    const axis = valueAxis([0, 1, 1], rect, { zeroBased: true, minStep: 1, tickCount: 4 });
    const labels = axis.ticks.map((tick) => tick.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual(['0', '1']);
  });

  it('rounds a body-weight domain outward to friendly bounds', () => {
    const axis = valueAxis([168.4, 173.9, 171.2], rect, { zeroBased: false, tickCount: 4 });
    expect(axis.domain.min).toBeLessThanOrEqual(168.4);
    expect(axis.domain.max).toBeGreaterThanOrEqual(173.9);
    // nice() must produce round numbers, not the raw extent.
    expect(axis.domain.min % 1).toBe(0);
    expect(axis.domain.max % 1).toBe(0);
  });

  it('forces zero into the domain for additive totals', () => {
    const axis = valueAxis([8200, 9100, 7600], rect, { zeroBased: true });
    expect(axis.domain.min).toBe(0);
  });

  it('keeps zero out of the domain for body weight', () => {
    const axis = valueAxis([168, 172], rect, { zeroBased: false });
    expect(axis.domain.min).toBeGreaterThan(100);
  });

  it('gives a dead-flat series a domain instead of dividing by zero', () => {
    const axis = valueAxis([170, 170, 170], rect, { zeroBased: false, minimumSpan: 4 });
    expect(axis.domain.max).toBeGreaterThan(axis.domain.min);
    expect(Number.isFinite(axis.scale(170))).toBe(true);
  });

  it('maps the domain minimum to the bottom of the plot and the max to the top', () => {
    const axis = valueAxis([0, 100], rect, { zeroBased: true });
    expect(axis.scale(axis.domain.min)).toBeCloseTo(rect.y + rect.height, 5);
    expect(axis.scale(axis.domain.max)).toBeCloseTo(rect.y, 5);
  });
});

describe('timeAxis', () => {
  it('spaces points by real elapsed time, not by even steps', () => {
    // Three observations, the gap between the last two six times the first.
    const axis = timeAxis(['2026-01-01', '2026-01-02', '2026-01-08'], rect);
    const [a, b, c] = ['2026-01-01', '2026-01-02', '2026-01-08'].map((date) =>
      axis.scale(Date.parse(`${date}T00:00:00Z`)),
    );
    expect((c as number) - (b as number)).toBeCloseTo(((b as number) - (a as number)) * 6, 4);
  });

  it('centres a single observation rather than dividing by a zero extent', () => {
    const axis = timeAxis(['2026-03-04'], rect);
    expect(axis.scale(Date.parse('2026-03-04T00:00:00Z'))).toBeCloseTo(rect.x + rect.width / 2, 5);
  });

  it('picks calendar boundaries across a long span', () => {
    const axis = timeAxis(['2026-01-01', '2026-12-31'], rect, { tickCount: 4 });
    // Every tick should land on a month start, not an arbitrary numeric slice.
    for (const tick of axis.ticks) {
      expect(new Date(tick.value).getUTCDate()).toBe(1);
    }
  });
});

describe('buildStackedChart', () => {
  const buckets: StackedBucket[] = [
    { localDate: '2026-06-01', values: { squat: 4000, hinge: 3000, push: 1000 } },
    { localDate: '2026-06-08', values: { squat: 5000, push: 2000 } },
    { localDate: '2026-06-15', values: { squat: 2000, hinge: 6000 } },
  ];
  const keys = ['squat', 'hinge', 'push'] as const;

  it('stacks segments so each column totals the sum of its parts', () => {
    const chart = buildStackedChart(buckets, rect, { keys });
    for (const column of chart.columns) {
      const summed = column.segments.reduce((sum, segment) => sum + segment.value, 0);
      expect(summed).toBeCloseTo(column.total, 6);
    }
    expect(chart.columns.map((column) => column.total)).toEqual([8000, 7000, 8000]);
  });

  it('stacks in the given key order, bottom first', () => {
    const chart = buildStackedChart(buckets, rect, { keys });
    const first = chart.columns[0]!;
    const squat = first.segments.find((s) => s.key === 'squat')!;
    const hinge = first.segments.find((s) => s.key === 'hinge')!;
    // Lower in the stack means a larger y (SVG y grows downward).
    expect(squat.y).toBeGreaterThan(hinge.y);
  });

  it('omits a key entirely absent from the window, so the legend cannot lie', () => {
    const chart = buildStackedChart(buckets, rect, { keys: [...keys, 'carry'] });
    expect(chart.keys).not.toContain('carry');
    expect(chart.segments.some((segment) => segment.key === 'carry')).toBe(false);
  });

  it('draws no segment for a pattern untrained in one bucket', () => {
    const chart = buildStackedChart(buckets, rect, { keys });
    const second = chart.columns[1]!;
    expect(second.segments.some((segment) => segment.key === 'hinge')).toBe(false);
  });

  it('is always zero-based, so bar heights state the real ratio', () => {
    const chart = buildStackedChart(buckets, rect, { keys });
    expect(chart.domain.min).toBe(0);
  });

  it('keeps a tiny contribution visible rather than sub-pixel', () => {
    const chart = buildStackedChart(
      [{ localDate: '2026-06-01', values: { squat: 10000, push: 1 } }],
      rect,
      { keys, minSegmentHeight: 2 },
    );
    const push = chart.segments.find((segment) => segment.key === 'push')!;
    expect(push.height).toBeGreaterThanOrEqual(2);
  });

  it('reports composition share largest first', () => {
    const share = compositionShare(buckets, keys);
    expect(share.map((entry) => entry.key)).toEqual(['squat', 'hinge', 'push']);
    expect(share.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1, 6);
  });
});

describe('buildSmallMultiples', () => {
  const lifts: LiftSeries[] = [
    {
      id: 'squat',
      name: 'Back Squat',
      points: [
        { localDate: '2026-05-01', value: 300 },
        { localDate: '2026-06-01', value: 315, isPr: true },
        { localDate: '2026-07-01', value: 330, isPr: true },
      ],
    },
    {
      id: 'curl',
      name: 'Biceps Curl',
      points: [
        { localDate: '2026-05-01', value: 40 },
        { localDate: '2026-07-01', value: 42.5 },
      ],
    },
    { id: 'row', name: 'Barbell Row', points: [{ localDate: '2026-06-01', value: 185 }] },
  ];

  it('gives every panel the same time axis so columns line up', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    const squat = result.panels.find((panel) => panel.id === 'squat')!;
    const curl = result.panels.find((panel) => panel.id === 'curl')!;
    // Same date must land on the same x in both panels.
    expect(squat.points[0]!.x).toBeCloseTo(curl.points[0]!.x, 6);
  });

  it('gives each panel its own value domain, so a light lift is not flattened', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    const squat = result.panels.find((panel) => panel.id === 'squat')!;
    const curl = result.panels.find((panel) => panel.id === 'curl')!;
    expect(curl.domain.max).toBeLessThan(squat.domain.min);
    // Both must actually use the panel's vertical space.
    const curlSpread = Math.abs(curl.points[0]!.y - curl.points[1]!.y);
    expect(curlSpread).toBeGreaterThan(10);
  });

  it('surfaces personal records as an annotation layer', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    const squat = result.panels.find((panel) => panel.id === 'squat')!;
    expect(squat.personalRecords.map((point) => point.localDate)).toEqual([
      '2026-06-01',
      '2026-07-01',
    ]);
  });

  it('omits a lift with too little history instead of drawing a dot', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    expect(result.panels.some((panel) => panel.id === 'row')).toBe(false);
    expect(result.omitted).toEqual([{ id: 'row', name: 'Barbell Row', pointCount: 1 }]);
  });

  it('orders panels by how much the lift actually moved', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    expect(result.panels[0]!.id).toBe('squat');
    expect(result.panels[0]!.change).toBe(30);
  });

  it('does not inflate a small real change into a dramatic climb', () => {
    const flat: LiftSeries[] = [
      {
        id: 'bench',
        name: 'Bench Press',
        points: [
          { localDate: '2026-05-01', value: 225 },
          { localDate: '2026-07-01', value: 227.5 },
        ],
      },
    ];
    const result = buildSmallMultiples(flat, {
      panel: { width: 300, height: 90 },
      minimumSpan: 20,
    });
    const panel = result.panels[0]!;
    expect(panel.domain.max - panel.domain.min).toBeGreaterThanOrEqual(20);
    const rise = Math.abs(panel.points[0]!.y - panel.points[1]!.y);
    expect(rise).toBeLessThan(panel.plot.height / 2);
  });

  it('reports staleness for a lift dropped part-way through the window', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    const squat = result.panels.find((panel) => panel.id === 'squat')!;
    expect(squat.staleness).toBeCloseTo(0, 6);
  });

  it('emits a real SVG path, not an empty string, for a plotted panel', () => {
    const result = buildSmallMultiples(lifts, { panel: { width: 300, height: 90 } });
    expect(result.panels[0]!.path).toMatch(/^M[\d.-]+,[\d.-]+/);
  });
});
