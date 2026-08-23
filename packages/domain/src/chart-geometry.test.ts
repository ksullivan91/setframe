import { describe, expect, it } from 'vitest';
import {
  availableRanges,
  buildColumnChart,
  buildLineChart,
  filterByRange,
  niceScale,
  rangeLabel,
  type SeriesPoint,
} from './chart-geometry';

const layout = { width: 300, height: 120, padding: { top: 8, right: 8, bottom: 20, left: 36 } };

function points(entries: [string, number | null][]): SeriesPoint[] {
  return entries.map(([localDate, value]) => ({ localDate, value }));
}

describe('nice scale', () => {
  it('rounds a domain outward to readable steps', () => {
    const scale = niceScale(166.8, 181.2, 4);
    expect(scale.min).toBeLessThanOrEqual(166.8);
    expect(scale.max).toBeGreaterThanOrEqual(181.2);
    expect(scale.step).toBeGreaterThan(0);
  });

  it('gives a flat domain some height instead of collapsing to zero', () => {
    const scale = niceScale(180, 180, 4);
    expect(scale.max).toBeGreaterThan(scale.min);
  });

  it('survives non-finite input', () => {
    expect(niceScale(Number.NaN, 10, 4)).toEqual({ min: 0, max: 1, step: 1 });
  });
});

describe('line chart scaling', () => {
  // The whole reason this module exists: value/max scaling made one point a
  // full bar and two similar weights indistinguishable.
  it('does not baseline body weight at zero', () => {
    const chart = buildLineChart(points([['2025-08-01', 166.8], ['2025-08-08', 168.6]]), {
      layout,
      zeroBased: false,
    });
    expect(chart.domain.min).toBeGreaterThan(100);
  });

  it('separates two similar weights across most of the plot height', () => {
    const chart = buildLineChart(points([['2025-08-01', 166.8], ['2025-08-08', 168.6]]), {
      layout,
      zeroBased: false,
    });
    const [first, second] = chart.points;
    // Under the old value/max rule these differed by ~1% of the height.
    expect(Math.abs(first!.y - second!.y)).toBeGreaterThan(chart.plot.height * 0.3);
  });

  it('baselines totals at zero so bar ratios are honest', () => {
    const chart = buildLineChart(points([['2025-08-01', 5000], ['2025-08-08', 8000]]), {
      layout,
      zeroBased: true,
    });
    expect(chart.domain.min).toBe(0);
  });

  it('renders a single point without drawing a line', () => {
    const chart = buildLineChart(points([['2025-08-01', 180]]), { layout });
    expect(chart.points).toHaveLength(1);
    expect(chart.path).toBe('');
    expect(chart.areaPath).toBe('');
  });

  it('returns an empty chart rather than throwing when there is no data', () => {
    const chart = buildLineChart([], { layout });
    expect(chart.points).toEqual([]);
    expect(chart.ticks).toEqual([]);
    expect(chart.path).toBe('');
  });

  it('skips null values instead of plotting them as zero', () => {
    const chart = buildLineChart(points([['2025-08-01', 180], ['2025-08-02', null], ['2025-08-03', 178]]), {
      layout,
    });
    expect(chart.points).toHaveLength(2);
    expect(chart.points.every((point) => point.value > 0)).toBe(true);
  });

  it('keeps the original index on each point so selection can drill down', () => {
    const chart = buildLineChart(points([['2025-08-01', 180], ['2025-08-02', null], ['2025-08-03', 178]]), {
      layout,
    });
    expect(chart.points.map((point) => point.index)).toEqual([0, 2]);
  });

  it('spaces points by real date distance, not by position', () => {
    const chart = buildLineChart(
      points([['2025-08-01', 180], ['2025-08-02', 181], ['2025-08-31', 179]]),
      { layout },
    );
    const [a, b, c] = chart.points;
    // Aug 1 -> Aug 2 is one day; Aug 2 -> Aug 31 is twenty-nine.
    expect(b!.x - a!.x).toBeLessThan((c!.x - b!.x) / 10);
  });

  it('centres a single-date series rather than dividing by a zero range', () => {
    const chart = buildLineChart(points([['2025-08-01', 180]]), { layout });
    expect(Number.isFinite(chart.points[0]!.x)).toBe(true);
  });

  it('gives a dead-flat series a minimum span so it is not amplified', () => {
    const chart = buildLineChart(points([['2025-08-01', 180], ['2025-08-08', 180]]), {
      layout,
      minimumSpan: 4,
    });
    expect(chart.domain.max - chart.domain.min).toBeGreaterThanOrEqual(4);
    expect(Math.abs(chart.points[0]!.y - chart.points[1]!.y)).toBeLessThan(1);
  });

  it('keeps every plotted point inside the plot area', () => {
    const chart = buildLineChart(
      points([['2025-08-01', 166.8], ['2025-08-05', 181.2], ['2025-08-09', 172]]),
      { layout },
    );
    for (const point of chart.points) {
      expect(point.y).toBeGreaterThanOrEqual(chart.plot.y - 0.01);
      expect(point.y).toBeLessThanOrEqual(chart.plot.y + chart.plot.height + 0.01);
      expect(point.x).toBeGreaterThanOrEqual(chart.plot.x - 0.01);
      expect(point.x).toBeLessThanOrEqual(chart.plot.x + chart.plot.width + 0.01);
    }
  });

  it('closes the area path back to the baseline', () => {
    const chart = buildLineChart(points([['2025-08-01', 180], ['2025-08-08', 178]]), { layout });
    expect(chart.areaPath.endsWith('Z')).toBe(true);
    expect(chart.path.startsWith('M')).toBe(true);
  });
});

describe('column chart', () => {
  it('emits a slot for every period including empty ones', () => {
    const chart = buildColumnChart(
      points([['2025-08-04', 3], ['2025-08-11', null], ['2025-08-18', 2]]),
      { layout },
    );
    expect(chart.columns).toHaveLength(3);
    expect(chart.columns[1]!.value).toBeNull();
    expect(chart.columns[1]!.height).toBe(0);
  });

  it('reports a slot width that tiles the plot, for full-width hit targets', () => {
    const chart = buildColumnChart(
      points([['2025-08-04', 3], ['2025-08-11', 1], ['2025-08-18', 2]]),
      { layout },
    );
    expect(chart.slotWidth).toBeCloseTo(chart.plot.width / 3, 5);
    // The bar is narrower than its slot, so a bar-width hit target would leave
    // dead gaps a slot-width target does not.
    expect(chart.columns[0]!.width).toBeLessThan(chart.slotWidth);
  });

  it('is always zero-based so the height ratio is truthful', () => {
    const chart = buildColumnChart(points([['2025-08-04', 4], ['2025-08-11', 2]]), { layout });
    expect(chart.domain.min).toBe(0);
    expect(chart.columns[1]!.height).toBeCloseTo(chart.columns[0]!.height / 2, 5);
  });

  it('does not make a lone column full height', () => {
    // A single week of 1 session should not read as "100% of something".
    const chart = buildColumnChart(points([['2025-08-18', 1]]), { layout });
    expect(chart.domain.max).toBeGreaterThanOrEqual(1);
    expect(chart.columns[0]!.height).toBeLessThanOrEqual(chart.plot.height + 0.01);
  });

  it('handles an all-empty window without dividing by zero', () => {
    const chart = buildColumnChart(points([['2025-08-04', null], ['2025-08-11', null]]), { layout });
    expect(chart.columns.every((column) => column.height === 0)).toBe(true);
    expect(Number.isFinite(chart.domain.max)).toBe(true);
  });

  it('keeps columns within the plot width', () => {
    const chart = buildColumnChart(
      points(Array.from({ length: 12 }, (_, index) => [`2025-06-0${(index % 9) + 1}`, index])),
      { layout },
    );
    for (const column of chart.columns) {
      expect(column.x).toBeGreaterThanOrEqual(chart.plot.x - 0.01);
      expect(column.x + column.width).toBeLessThanOrEqual(chart.plot.x + chart.plot.width + 0.01);
    }
  });
});

describe('ranges', () => {
  const series = points(
    Array.from({ length: 200 }, (_, index) => [
      new Date(Date.UTC(2025, 0, 1) + index * 86_400_000).toISOString().slice(0, 10),
      180,
    ]),
  );

  it('trims to the trailing window', () => {
    const trimmed = filterByRange(series, '1M', '2025-07-19');
    expect(trimmed.length).toBeLessThan(series.length);
    expect(trimmed.length).toBeGreaterThan(25);
  });

  it('returns everything for ALL', () => {
    expect(filterByRange(series, 'ALL', '2025-07-19')).toHaveLength(series.length);
  });

  it('offers no ranges when there is nothing to range over', () => {
    expect(availableRanges(points([['2025-08-01', 180]]), '2025-08-01')).toEqual([]);
    expect(availableRanges([], '2025-08-01')).toEqual([]);
  });

  it('offers only ranges the data actually spans', () => {
    const short = points([['2025-08-01', 180], ['2025-08-20', 178]]);
    const ranges = availableRanges(short, '2025-08-22');
    expect(ranges).toContain('1W');
    expect(ranges).not.toContain('1Y');
  });

  it('labels every range', () => {
    for (const range of ['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const) {
      expect(rangeLabel(range).length).toBeGreaterThan(0);
    }
  });
});

describe('shared domains for overlaid series', () => {
  const layout = { width: 320, height: 160, padding: { top: 10, right: 10, bottom: 22, left: 40 } };

  it('draws the same value at the same height in both series', () => {
    const raw = [
      { localDate: '2025-07-01', value: 170 },
      { localDate: '2025-07-02', value: 165 },
      { localDate: '2025-07-03', value: 175 },
    ];
    const trend = [
      { localDate: '2025-07-01', value: 170 },
      { localDate: '2025-07-02', value: 169.5 },
      { localDate: '2025-07-03', value: 170.2 },
    ];
    const domainChart = buildLineChart([...raw, ...trend], { layout });
    const shared = { domain: domainChart.domain, dayBounds: domainChart.dayBounds };
    const rawChart = buildLineChart(raw, { layout, ...shared });
    const trendChart = buildLineChart(trend, { layout, ...shared });

    expect(rawChart.domain).toEqual(trendChart.domain);
    // 170 appears in both series; it must land on one y.
    expect(rawChart.points[0]!.y).toBeCloseTo(trendChart.points[0]!.y, 6);
  });

  it('pins both series to the same date axis when their spans differ', () => {
    const raw = [
      { localDate: '2025-07-01', value: 10 },
      { localDate: '2025-07-31', value: 20 },
    ];
    const short = [
      { localDate: '2025-07-10', value: 12 },
      { localDate: '2025-07-20', value: 16 },
    ];
    const domainChart = buildLineChart([...raw, ...short], { layout });
    const shared = { domain: domainChart.domain, dayBounds: domainChart.dayBounds };
    const shortChart = buildLineChart(short, { layout, ...shared });

    // Without shared bounds the short series would span the full plot width.
    expect(shortChart.points[0]!.x).toBeGreaterThan(shortChart.plot.x);
    expect(shortChart.points.at(-1)!.x).toBeLessThan(shortChart.plot.x + shortChart.plot.width);
  });

  it('reports day bounds so an overlay can adopt them', () => {
    const chart = buildLineChart(
      [
        { localDate: '2025-07-01', value: 1 },
        { localDate: '2025-07-08', value: 2 },
      ],
      { layout },
    );
    expect(chart.dayBounds.last - chart.dayBounds.first).toBe(7);
  });
});
