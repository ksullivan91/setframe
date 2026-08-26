/**
 * Small multiples — "am I getting stronger?", per lift.
 *
 * The single most-asked question in a training app, and the current Progress
 * screen cannot answer it at all: estimated 1RM is computed in this package
 * and shown only inside a per-exercise history view.
 *
 * Why small multiples rather than one multi-line chart: absolute loads differ
 * by an order of magnitude between a deadlift and a lateral raise, so putting
 * them on one axis flattens every light lift into a line along the bottom.
 * Six panels with a **shared time axis and independent value axes** let the
 * eye scan down a column and see that everything stalled in the same week —
 * which is the comparison that matters — while each lift keeps a value scale
 * that shows its own movement.
 *
 * That shared-x/independent-y split is the whole design. It is also why each
 * panel must label its own value range: an unlabelled sparkline invites the
 * reader to compare heights across panels, which here would be meaningless.
 */

import { line, curveMonotoneX } from 'd3-shape';
import {
  dateToTime,
  plotRect,
  timeAxis,
  valueAxis,
  type PlotRect,
  type Tick,
} from './plot';

export interface LiftPoint {
  /** `YYYY-MM-DD` local. */
  localDate: string;
  /** Estimated 1RM, or whatever measure the panel tracks. */
  value: number;
  /** Set on the session where a personal record was recorded. */
  isPr?: boolean;
}

export interface LiftSeries {
  /** Stable identifier — the exercise id, not its name. */
  id: string;
  name: string;
  /** Ascending by date. */
  points: readonly LiftPoint[];
}

export interface PlottedLiftPoint extends LiftPoint {
  x: number;
  y: number;
  index: number;
}

export interface LiftPanel {
  id: string;
  name: string;
  points: PlottedLiftPoint[];
  /** SVG path for the line; empty when fewer than two points exist. */
  path: string;
  /** Points flagged as personal records, for the annotation layer. */
  personalRecords: PlottedLiftPoint[];
  /** This panel's own value range, which must be labelled. */
  domain: { min: number; max: number };
  ticks: Tick[];
  first: number;
  last: number;
  /** `last - first`; null when a single observation makes change undefined. */
  change: number | null;
  /**
   * `change` as a fraction of the starting value. This, not the absolute
   * change, is what ranks the panels: sorting by absolute change ranks the
   * heaviest lift first every time, which is the same order on every render
   * and therefore carries no information. A lateral raise up 25% has moved
   * more than a deadlift up 10%, and that is the thing worth leading with.
   */
  relativeChange: number | null;
  /**
   * Fraction of the window since the most recent observation. High values mean
   * the lift has been dropped, which reads very differently from a flat line.
   */
  staleness: number;
  plot: PlotRect;
}

export interface SmallMultiplesOptions {
  /** Size of one panel. */
  panel: { width: number; height: number };
  insets?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  /** Shared across every panel, so the columns line up. */
  bounds?: { first: number; last: number };
  tickCount?: number;
  formatValue?: (value: number) => string;
  /**
   * Minimum value-domain height, in the same unit as `value`. Without a floor
   * a lift that moved 2.5 lb over three months draws as a dramatic climb,
   * because the domain collapses onto the noise.
   */
  minimumSpan?: number;
  /**
   * Minimum value-domain height as a fraction of the panel's own typical
   * value — the floor that actually works across a set of lifts.
   *
   * An absolute `minimumSpan` cannot: 20 lb is noise on a 400 lb deadlift and
   * is the entire range of a 25 lb lateral raise, so one number either fails
   * to damp the heavy lift or flattens the light one into a straight line. A
   * ratio scales with the lift. The larger of the two floors wins, so an
   * absolute floor can still be used to damp very small absolute numbers.
   */
  minimumSpanRatio?: number;
  /** Drops panels with fewer than this many observations. */
  minimumPoints?: number;
}

export interface SmallMultiples {
  panels: LiftPanel[];
  /** The x-axis every panel shares. Label it once, not per panel. */
  timeTicks: Tick[];
  bounds: { first: number; last: number };
  /** Lifts excluded for having too little history, so the UI can say so. */
  omitted: { id: string; name: string; pointCount: number }[];
}

/**
 * Builds one panel per lift over a shared time axis.
 *
 * Panels are ordered by *proportional* change, largest first, so the lifts
 * that actually moved lead rather than simply the heaviest ones.
 */
export function buildSmallMultiples(
  lifts: readonly LiftSeries[],
  options: SmallMultiplesOptions,
): SmallMultiples {
  const minimumPoints = options.minimumPoints ?? 2;
  const rect = plotRect({ ...options.panel, insets: options.insets });

  const eligible: LiftSeries[] = [];
  const omitted: SmallMultiples['omitted'] = [];
  for (const lift of lifts) {
    if (lift.points.length >= minimumPoints) eligible.push(lift);
    else omitted.push({ id: lift.id, name: lift.name, pointCount: lift.points.length });
  }

  const allDates = eligible.flatMap((lift) => lift.points.map((point) => point.localDate));
  const shared = timeAxis(allDates, rect, {
    bounds: options.bounds,
    tickCount: options.tickCount ?? 4,
  });

  const panels = eligible.map((lift): LiftPanel => {
    const values = lift.points.map((point) => point.value);
    /* The median, not the mean: a single tested max or a mis-entered weight
       would drag a mean and take the whole panel's scale with it. */
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const ratioFloor = options.minimumSpanRatio
      ? Math.abs(median) * options.minimumSpanRatio
      : 0;

    const axis = valueAxis(values, rect, {
      zeroBased: false,
      tickCount: 2,
      minimumSpan: Math.max(options.minimumSpan ?? 0, ratioFloor),
      format: options.formatValue,
    });

    const points: PlottedLiftPoint[] = lift.points.map((point, index) => ({
      ...point,
      index,
      x: shared.scale(dateToTime(point.localDate)),
      y: axis.scale(point.value),
    }));

    const generator = line<PlottedLiftPoint>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(curveMonotoneX);

    const first = lift.points[0]?.value ?? 0;
    const last = lift.points.at(-1)?.value ?? 0;
    const lastTime = dateToTime(lift.points.at(-1)?.localDate ?? '');
    const span = shared.bounds.last - shared.bounds.first;

    return {
      id: lift.id,
      name: lift.name,
      points,
      path: points.length < 2 ? '' : (generator(points) ?? ''),
      personalRecords: points.filter((point) => point.isPr),
      domain: axis.domain,
      ticks: axis.ticks,
      first,
      last,
      change: lift.points.length < 2 ? null : last - first,
      relativeChange:
        lift.points.length < 2 || first === 0 ? null : (last - first) / Math.abs(first),
      staleness: span > 0 ? Math.min(Math.max((shared.bounds.last - lastTime) / span, 0), 1) : 0,
      plot: rect,
    };
  });

  /* By proportional movement, largest first — see `relativeChange`. Ties and
     lifts with no computable ratio fall back to absolute change so the order
     stays total and deterministic. */
  panels.sort(
    (a, b) =>
      Math.abs(b.relativeChange ?? 0) - Math.abs(a.relativeChange ?? 0) ||
      Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return { panels, timeTicks: shared.ticks, bounds: shared.bounds, omitted };
}
