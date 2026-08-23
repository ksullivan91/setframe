/**
 * Chart geometry — the maths behind every Progress chart, shared by web and
 * mobile so the two cannot drift.
 *
 * This module deliberately knows nothing about rendering. It turns a dated
 * series into coordinates, an SVG path string and axis ticks; web draws that
 * with a native `<svg>` and mobile with `react-native-svg`, both of which
 * accept the identical path syntax. No charting library is involved, which
 * keeps the bundle small and, more importantly, keeps the scale decisions
 * below explicit rather than buried in a vendor default.
 *
 * The scale decision is the whole point. The previous Progress screen drew
 * every metric as a bar of height `value / max`, which meant:
 *   - one observation always rendered as a 100% bar, and
 *   - two body weights of 166.8 and 168.6 rendered at 98.9% and 100%, i.e.
 *     indistinguishable.
 * The bars were decoration. The fix is that the y-domain is chosen per
 * metric type:
 *   - `zeroBased: true` for counts and totals, where zero is meaningful and
 *     truncating the axis would exaggerate differences.
 *   - `zeroBased: false` for measures like body weight, where zero is
 *     absurd and the interesting variation lives in a narrow band. A padded
 *     domain around the actual range is what makes a 2 lb change visible.
 */

export interface SeriesPoint<Meta = unknown> {
  /** `YYYY-MM-DD` in the user's own timezone. */
  localDate: string;
  /** `null` renders as a gap, never as zero. */
  value: number | null;
  meta?: Meta;
}

export interface PlottedPoint<Meta = unknown> {
  localDate: string;
  value: number;
  x: number;
  y: number;
  /** Index into the original series, for selection and drill-down. */
  index: number;
  meta?: Meta;
}

export interface AxisTick {
  value: number;
  y: number;
  label: string;
}

export interface ChartLayout {
  width: number;
  height: number;
  /** Space reserved for axis labels. */
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface LineChartOptions {
  layout: ChartLayout;
  /** See the module comment: false for body weight, true for totals. */
  zeroBased?: boolean;
  /** Number of horizontal gridlines/labels to aim for. */
  tickCount?: number;
  /** Formats a y value for the axis. */
  formatValue?: (value: number) => string;
  /**
   * Minimum height of the y-domain, in value units. Stops a dead-flat
   * series from being drawn on a zero-height domain, which would otherwise
   * amplify floating-point dust into a dramatic-looking line.
   */
  minimumSpan?: number;
  /**
   * Forces the y-domain instead of deriving it from `series`. Required when
   * two series are drawn on the same axes: an overlay (say an EWMA) always
   * has a narrower spread than the raw data it smooths, so letting each
   * derive its own domain would stretch the overlay and draw the same value
   * at two different heights.
   */
  domain?: { min: number; max: number };
  /** Forces the x (date) axis, for the same reason as `domain`. */
  dayBounds?: { first: number; last: number };
}

export interface LineChart<Meta = unknown> {
  points: PlottedPoint<Meta>[];
  /** SVG path for the line. Empty when fewer than two points exist. */
  path: string;
  /** SVG path for the filled area under the line, for a subtle band. */
  areaPath: string;
  ticks: AxisTick[];
  domain: { min: number; max: number };
  /** Day-number extent of the x-axis, for pinning an overlay to it. */
  dayBounds: { first: number; last: number };
  plot: { x: number; y: number; width: number; height: number };
}

const DEFAULT_PADDING = { top: 8, right: 8, bottom: 20, left: 36 };

function plotArea(layout: ChartLayout) {
  const padding = { ...DEFAULT_PADDING, ...layout.padding };
  return {
    x: padding.left,
    y: padding.top,
    width: Math.max(layout.width - padding.left - padding.right, 1),
    height: Math.max(layout.height - padding.top - padding.bottom, 1),
  };
}

function toDayNumber(localDate: string): number {
  return Math.round(Date.parse(`${localDate}T00:00:00Z`) / 86_400_000);
}

/**
 * Rounds a domain outward to human-friendly step boundaries, so axis labels
 * read 170 / 175 / 180 rather than 168.4 / 173.9 / 179.4.
 */
export function niceScale(min: number, max: number, tickCount: number): { min: number; max: number; step: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 1 };
  const span = max - min;
  if (span <= 0) {
    const pad = Math.abs(max) > 0 ? Math.abs(max) * 0.05 : 1;
    return { min: min - pad, max: max + pad, step: pad };
  }
  const rawStep = span / Math.max(tickCount - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const niceNormalised = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  const step = niceNormalised * magnitude;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

export function buildLineChart<Meta>(
  series: readonly SeriesPoint<Meta>[],
  options: LineChartOptions,
): LineChart<Meta> {
  const plot = plotArea(options.layout);
  const tickCount = options.tickCount ?? 4;
  const zeroBased = options.zeroBased ?? false;
  const minimumSpan = options.minimumSpan ?? 0;
  const format = options.formatValue ?? ((value: number) => String(Math.round(value)));

  const present = series.flatMap((point, index) =>
    point.value == null ? [] : [{ ...point, value: point.value, index }],
  );

  if (!present.length) {
    return {
      points: [],
      path: '',
      areaPath: '',
      ticks: [],
      domain: options.domain ?? { min: 0, max: 1 },
      dayBounds: options.dayBounds ?? { first: 0, last: 0 },
      plot,
    };
  }

  const values = present.map((point) => point.value);
  let low = zeroBased ? 0 : Math.min(...values);
  let high = Math.max(...values, zeroBased ? 0 : -Infinity);

  if (high - low < minimumSpan) {
    const centre = (high + low) / 2;
    low = zeroBased ? 0 : centre - minimumSpan / 2;
    high = centre + minimumSpan / 2;
  }

  const scale = niceScale(options.domain?.min ?? low, options.domain?.max ?? high, tickCount);
  const domainMin = options.domain ? options.domain.min : zeroBased ? 0 : scale.min;
  const rawDomainMax = options.domain ? options.domain.max : scale.max;
  const domainMax = rawDomainMax > domainMin ? rawDomainMax : domainMin + (scale.step || 1);
  const span = domainMax - domainMin;

  // The x-axis is a real date axis, so a fortnight's gap between two
  // check-ins is drawn as a fortnight rather than as one even step.
  const days = present.map((point) => toDayNumber(point.localDate));
  const firstDay = options.dayBounds?.first ?? Math.min(...days);
  const lastDay = options.dayBounds?.last ?? Math.max(...days);
  const dayRange = lastDay - firstDay;

  const points: PlottedPoint<Meta>[] = present.map((point) => {
    const day = toDayNumber(point.localDate);
    const ratio = dayRange === 0 ? 0.5 : (day - firstDay) / dayRange;
    return {
      localDate: point.localDate,
      value: point.value,
      index: point.index,
      meta: point.meta,
      x: plot.x + ratio * plot.width,
      y: plot.y + plot.height - ((point.value - domainMin) / span) * plot.height,
    };
  });

  const path =
    points.length < 2
      ? ''
      : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath =
    points.length < 2
      ? ''
      : `${path} L${points.at(-1)!.x.toFixed(2)} ${(plot.y + plot.height).toFixed(2)} L${points[0]!.x.toFixed(2)} ${(plot.y + plot.height).toFixed(2)} Z`;

  const ticks: AxisTick[] = [];
  for (let value = domainMin; value <= domainMax + scale.step / 2; value += scale.step) {
    ticks.push({
      value,
      y: plot.y + plot.height - ((value - domainMin) / span) * plot.height,
      label: format(value),
    });
  }

  return {
    points,
    path,
    areaPath,
    ticks,
    domain: { min: domainMin, max: domainMax },
    dayBounds: { first: firstDay, last: lastDay },
    plot,
  };
}

export interface ColumnChartOptions {
  layout: ChartLayout;
  tickCount?: number;
  formatValue?: (value: number) => string;
  /** Fraction of each slot taken by the bar itself. */
  barRatio?: number;
}

export interface PlottedColumn<Meta = unknown> {
  localDate: string;
  /** `null` for a period with genuinely no data, drawn as an empty slot. */
  value: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  meta?: Meta;
}

export interface ColumnChart<Meta = unknown> {
  columns: PlottedColumn<Meta>[];
  ticks: AxisTick[];
  domain: { min: number; max: number };
  /** Width of one period's slot (bar plus surrounding gap), for hit targets. */
  slotWidth: number;
  plot: { x: number; y: number; width: number; height: number };
}

/**
 * Columns are always zero-based: they encode counts and totals, where the
 * area of the bar is the quantity and a truncated axis would lie about the
 * ratio between periods.
 */
export function buildColumnChart<Meta>(
  series: readonly SeriesPoint<Meta>[],
  options: ColumnChartOptions,
): ColumnChart<Meta> {
  const plot = plotArea(options.layout);
  const tickCount = options.tickCount ?? 3;
  const barRatio = options.barRatio ?? 0.62;
  const format = options.formatValue ?? ((value: number) => String(Math.round(value)));

  const values = series.flatMap((point) => (point.value == null ? [] : [point.value]));
  const scale = niceScale(0, values.length ? Math.max(...values) : 1, tickCount);
  const domainMax = scale.max > 0 ? scale.max : 1;

  const slot = plot.width / Math.max(series.length, 1);
  const barWidth = Math.max(slot * barRatio, 1);

  const columns: PlottedColumn<Meta>[] = series.map((point, index) => {
    const centre = plot.x + slot * index + slot / 2;
    const value = point.value;
    const height = value == null ? 0 : (value / domainMax) * plot.height;
    return {
      localDate: point.localDate,
      value,
      index,
      meta: point.meta,
      x: centre - barWidth / 2,
      width: barWidth,
      y: plot.y + plot.height - height,
      height,
    };
  });

  const ticks: AxisTick[] = [];
  for (let value = 0; value <= domainMax + scale.step / 2; value += scale.step) {
    ticks.push({
      value,
      y: plot.y + plot.height - (value / domainMax) * plot.height,
      label: format(value),
    });
  }

  return { columns, ticks, domain: { min: 0, max: domainMax }, slotWidth: slot, plot };
}

export type ChartRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const chartRanges: readonly ChartRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;

const rangeDays: Record<Exclude<ChartRange, 'ALL'>, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  '6M': 182,
  '1Y': 365,
};

export function rangeLabel(range: ChartRange): string {
  switch (range) {
    case '1W':
      return 'Last week';
    case '1M':
      return 'Last month';
    case '3M':
      return 'Last 3 months';
    case '6M':
      return 'Last 6 months';
    case '1Y':
      return 'Last year';
    case 'ALL':
      return 'All time';
  }
}

/** Trims a series to a trailing range ending at `endLocalDate`. */
export function filterByRange<Meta>(
  series: readonly SeriesPoint<Meta>[],
  range: ChartRange,
  endLocalDate: string,
): SeriesPoint<Meta>[] {
  if (range === 'ALL') return [...series];
  const cutoff = toDayNumber(endLocalDate) - rangeDays[range];
  return series.filter((point) => toDayNumber(point.localDate) >= cutoff);
}

/**
 * The ranges worth offering for a series. A range that would show the same
 * points as the full history is not a choice, it is a decoy, so ranges are
 * only enabled once the data actually extends beyond them.
 */
export function availableRanges<Meta>(
  series: readonly SeriesPoint<Meta>[],
  endLocalDate: string,
): ChartRange[] {
  const present = series.filter((point) => point.value != null);
  if (present.length < 2) return [];
  const earliest = Math.min(...present.map((point) => toDayNumber(point.localDate)));
  const spanDays = toDayNumber(endLocalDate) - earliest;
  const usable = chartRanges.filter((range) => range === 'ALL' || rangeDays[range] < spanDays);
  // 'ALL' alone is not a choice either.
  return usable.length > 1 ? usable : [];
}
