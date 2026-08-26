/**
 * Shared plot primitives for the Progress charts.
 *
 * Everything here returns plain, serialisable geometry — numbers, strings and
 * SVG path data. No d3 object ever escapes this directory, and nothing in it
 * touches a DOM. That is what lets `apps/web` draw the output with a native
 * `<svg>` and `apps/mobile` draw the identical output with `react-native-svg`,
 * which is the parity guarantee ADR 0010 rests on.
 *
 * d3's headless modules (`d3-scale`, `d3-shape`, `d3-array`, `d3-time`) do the
 * arithmetic that `chart-geometry.ts` hand-rolled. The reason is not elegance:
 * Story 50 shipped a y-axis reading "0, 1, 1" because a half-session step
 * rounded to one on both gridlines, which is the exact class of bug
 * `scaleLinear().nice()` does not have.
 */

import { scaleLinear, scaleUtc } from 'd3-scale';

/** The drawable region, inside the space reserved for axis labels. */
export interface PlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PlotLayout {
  width: number;
  height: number;
  insets?: Partial<Insets>;
}

export interface Tick {
  /** The domain value this tick sits at. */
  value: number;
  /** Position along the relevant axis, in plot coordinates. */
  position: number;
  label: string;
}

export const defaultInsets: Insets = { top: 8, right: 8, bottom: 22, left: 40 };

export function plotRect(layout: PlotLayout): PlotRect {
  const insets = { ...defaultInsets, ...layout.insets };
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(layout.width - insets.left - insets.right, 1),
    height: Math.max(layout.height - insets.top - insets.bottom, 1),
  };
}

/** `YYYY-MM-DD` (local calendar day) → a UTC-midnight epoch, for date scales. */
export function dateToTime(localDate: string): number {
  return Date.parse(`${localDate}T00:00:00Z`);
}

export interface ValueAxisOptions {
  /**
   * Whether zero must be included. True for counts and additive totals, where
   * a truncated axis lies about the ratio between periods; false for measures
   * like body weight, where zero is absurd and the interesting variation
   * lives in a narrow band.
   */
  zeroBased?: boolean;
  tickCount?: number;
  format?: (value: number) => string;
  /**
   * Smallest step the axis may use. Pass 1 for counts of whole things so a
   * series topping out at 1 cannot produce two gridlines both labelled "1".
   */
  minStep?: number;
  /**
   * Minimum height of the domain in value units, so a dead-flat series is not
   * drawn on a zero-height domain that amplifies floating-point dust into a
   * dramatic-looking line.
   */
  minimumSpan?: number;
  /** Overrides the derived domain, for two series sharing one axis. */
  domain?: { min: number; max: number };
}

export interface ValueAxis {
  domain: { min: number; max: number };
  ticks: Tick[];
  /** Maps a domain value to a y coordinate in plot space. */
  scale: (value: number) => number;
}

/**
 * Builds a y-axis over `values`, choosing a human-friendly domain.
 *
 * `minStep` is applied after `nice()` rather than instead of it: `nice()`
 * guarantees round bounds, but "round" for a 0–1 domain still means a step of
 * 0.5, which is not a valid number of sessions.
 */
export function valueAxis(
  values: readonly number[],
  rect: PlotRect,
  options: ValueAxisOptions = {},
): ValueAxis {
  const tickCount = options.tickCount ?? 4;
  const zeroBased = options.zeroBased ?? false;
  const format = options.format ?? ((value: number) => String(Math.round(value)));
  const finite = values.filter((value) => Number.isFinite(value));

  let low: number;
  let high: number;
  if (options.domain) {
    low = options.domain.min;
    high = options.domain.max;
  } else if (!finite.length) {
    low = 0;
    high = 1;
  } else {
    low = zeroBased ? 0 : Math.min(...finite);
    high = Math.max(...finite, zeroBased ? 0 : Number.NEGATIVE_INFINITY);
  }

  const minimumSpan = options.minimumSpan ?? 0;
  if (high - low < minimumSpan) {
    const centre = (high + low) / 2;
    low = zeroBased ? 0 : centre - minimumSpan / 2;
    high = centre + minimumSpan / 2;
  }
  if (high <= low) high = low + (options.minStep ?? 1);

  const base = scaleLinear().domain([low, high]);
  if (!options.domain) base.nice(tickCount);

  let [niceLow, niceHigh] = base.domain() as [number, number];
  if (zeroBased) niceLow = 0;

  let tickValues = base.ticks(tickCount);
  const minStep = options.minStep;
  if (minStep && minStep > 0) {
    const step = tickValues.length > 1 ? (tickValues[1] as number) - (tickValues[0] as number) : minStep;
    if (step < minStep) {
      // Re-tick on whole units so no two gridlines can share a label.
      niceHigh = Math.ceil(niceHigh / minStep) * minStep;
      niceLow = Math.floor(niceLow / minStep) * minStep;
      tickValues = [];
      for (let value = niceLow; value <= niceHigh + minStep / 2; value += minStep) {
        tickValues.push(Number(value.toFixed(10)));
      }
    }
  }

  const span = niceHigh - niceLow || 1;
  const scale = (value: number) => rect.y + rect.height - ((value - niceLow) / span) * rect.height;

  return {
    domain: { min: niceLow, max: niceHigh },
    ticks: tickValues.map((value) => ({ value, position: scale(value), label: format(value) })),
    scale,
  };
}

export interface TimeAxisOptions {
  tickCount?: number;
  format?: (localDate: string, time: number) => string;
  /** Overrides the derived extent, for series that must share an x-axis. */
  bounds?: { first: number; last: number };
}

export interface TimeAxis {
  bounds: { first: number; last: number };
  ticks: Tick[];
  /** Maps an epoch millisecond value to an x coordinate in plot space. */
  scale: (time: number) => number;
}

/**
 * Builds a real date x-axis, so a fortnight's gap between two check-ins is
 * drawn as a fortnight rather than as one even step.
 *
 * Tick selection is `scaleUtc`'s, which picks calendar-sensible boundaries —
 * month starts over a year, week starts over a quarter — instead of dividing
 * the span into equal numeric slices that land mid-week.
 */
export function timeAxis(
  localDates: readonly string[],
  rect: PlotRect,
  options: TimeAxisOptions = {},
): TimeAxis {
  const times = localDates.map(dateToTime).filter((time) => Number.isFinite(time));
  const first = options.bounds?.first ?? (times.length ? Math.min(...times) : 0);
  const last = options.bounds?.last ?? (times.length ? Math.max(...times) : 0);

  // A single observation has no extent; centre it rather than dividing by zero.
  if (last <= first) {
    const scale = () => rect.x + rect.width / 2;
    return { bounds: { first, last }, ticks: [], scale };
  }

  const base = scaleUtc().domain([first, last]).range([rect.x, rect.x + rect.width]);
  const format = options.format ?? ((localDate: string) => localDate.slice(5));

  return {
    bounds: { first, last },
    ticks: base.ticks(options.tickCount ?? 4).map((date) => {
      const time = date.getTime();
      return {
        value: time,
        position: base(date),
        label: format(new Date(time).toISOString().slice(0, 10), time),
      };
    }),
    scale: (time: number) => base(new Date(time)),
  };
}
