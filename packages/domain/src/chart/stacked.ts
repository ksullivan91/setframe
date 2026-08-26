/**
 * Stacked composition — "what did I actually train?", which a single weekly
 * volume total cannot answer.
 *
 * A total destroys composition: 12,000 lb of squatting and 12,000 lb split
 * evenly across six patterns render as the same bar, and only one of them is
 * a balanced week. The total stays recoverable from the parts; the parts are
 * not recoverable from the total, so the parts are what we store and draw.
 *
 * Columns, not an area chart. Weekly buckets are discrete periods, and a
 * stacked area's slopes would imply the user trained continuously between two
 * Sundays. Bars claim nothing about the space between them.
 */

import { stack, stackOrderNone, stackOffsetNone } from 'd3-shape';
import { scaleBand } from 'd3-scale';
import { valueAxis, type PlotRect, type Tick, type ValueAxisOptions } from './plot';

export interface StackedBucket {
  /** Bucket start, `YYYY-MM-DD` local. */
  localDate: string;
  /**
   * Value per series key. A key absent from the record is genuinely untrained
   * in that bucket, and contributes no segment — distinct from a key present
   * with 0, which we never write.
   */
  values: Readonly<Record<string, number>>;
  /** Free-form, e.g. `{ partial: true }` for an in-progress period. */
  meta?: unknown;
}

export interface StackSegment {
  key: string;
  localDate: string;
  /** Index of the bucket, for selection and drill-down. */
  bucketIndex: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StackedColumn {
  localDate: string;
  bucketIndex: number;
  total: number;
  /** The whole column's hit target — full slot width, full plot height. */
  x: number;
  width: number;
  segments: StackSegment[];
  meta?: unknown;
}

export interface StackedChart {
  columns: StackedColumn[];
  /** Every segment, flat, in draw order (bottom of the stack first). */
  segments: StackSegment[];
  /** Only the keys that actually appear, in the order given. */
  keys: string[];
  ticks: Tick[];
  domain: { min: number; max: number };
  slotWidth: number;
  plot: PlotRect;
}

export interface StackedChartOptions extends Omit<ValueAxisOptions, 'zeroBased' | 'domain'> {
  /** Series order, bottom of the stack first. Keys not listed are dropped. */
  keys: readonly string[];
  /** Fraction of a slot taken by the bar. */
  barRatio?: number;
  /** Smallest drawn segment height, so a tiny contribution stays visible. */
  minSegmentHeight?: number;
}

/**
 * Builds stacked columns over `buckets`.
 *
 * A stacked total is always zero-based — the height of the stack *is* the
 * quantity, so a truncated axis would misstate every ratio in the chart at
 * once rather than just the endpoints.
 */
export function buildStackedChart(
  buckets: readonly StackedBucket[],
  rect: PlotRect,
  options: StackedChartOptions,
): StackedChart {
  const barRatio = options.barRatio ?? 0.68;
  const minSegmentHeight = options.minSegmentHeight ?? 1.5;

  // Drop keys nothing ever contributed to, so the legend never advertises a
  // movement pattern the user has not trained.
  const keys = options.keys.filter((key) =>
    buckets.some((bucket) => (bucket.values[key] ?? 0) > 0),
  );

  const band = scaleBand<number>()
    .domain(buckets.map((_, index) => index))
    .range([rect.x, rect.x + rect.width])
    .paddingInner(1 - barRatio)
    .paddingOuter((1 - barRatio) / 2);

  const totals = buckets.map((bucket) =>
    keys.reduce((sum, key) => sum + (bucket.values[key] ?? 0), 0),
  );

  const axis = valueAxis(totals, rect, { ...options, zeroBased: true });

  if (!keys.length) {
    return {
      columns: buckets.map((bucket, bucketIndex) => ({
        localDate: bucket.localDate,
        bucketIndex,
        total: 0,
        x: band(bucketIndex) ?? rect.x,
        width: band.bandwidth(),
        segments: [],
        meta: bucket.meta,
      })),
      segments: [],
      keys,
      ticks: axis.ticks,
      domain: axis.domain,
      slotWidth: band.step(),
      plot: rect,
    };
  }

  const series = stack<StackedBucket>()
    .keys(keys)
    .value((bucket, key) => bucket.values[key] ?? 0)
    .order(stackOrderNone)
    .offset(stackOffsetNone)(buckets as StackedBucket[]);

  const columns: StackedColumn[] = buckets.map((bucket, bucketIndex) => ({
    localDate: bucket.localDate,
    bucketIndex,
    total: totals[bucketIndex] ?? 0,
    x: band(bucketIndex) ?? rect.x,
    width: band.bandwidth(),
    segments: [],
    meta: bucket.meta,
  }));

  const segments: StackSegment[] = [];
  for (const keySeries of series) {
    const key = keySeries.key;
    for (let bucketIndex = 0; bucketIndex < keySeries.length; bucketIndex += 1) {
      const entry = keySeries[bucketIndex];
      if (!entry) continue;
      const [lower, upper] = entry;
      const value = upper - lower;
      if (!(value > 0)) continue;

      const yTop = axis.scale(upper);
      const yBottom = axis.scale(lower);
      const column = columns[bucketIndex];
      if (!column) continue;

      const segment: StackSegment = {
        key,
        localDate: column.localDate,
        bucketIndex,
        value,
        x: column.x,
        width: column.width,
        y: yTop,
        height: Math.max(yBottom - yTop, minSegmentHeight),
      };
      segments.push(segment);
      column.segments.push(segment);
    }
  }

  return {
    columns,
    segments,
    keys,
    ticks: axis.ticks,
    domain: axis.domain,
    slotWidth: band.step(),
    plot: rect,
  };
}

/**
 * Share of the total each key contributed across the whole window, largest
 * first. This is what makes the chart readable as a sentence — "62% of your
 * volume was squat and hinge" — and is the input a coaching observation about
 * balance or neglect would cite as its evidence.
 */
export function compositionShare(
  buckets: readonly StackedBucket[],
  keys: readonly string[],
): { key: string; total: number; share: number }[] {
  const totals = keys.map((key) => ({
    key,
    total: buckets.reduce((sum, bucket) => sum + (bucket.values[key] ?? 0), 0),
  }));
  const grand = totals.reduce((sum, entry) => sum + entry.total, 0);
  return totals
    .filter((entry) => entry.total > 0)
    .map((entry) => ({ ...entry, share: grand > 0 ? entry.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}
