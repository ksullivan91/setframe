import { useEffect, useMemo, useRef, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import {
  buildColumnChart,
  buildLineChart,
  buildSmallMultiples,
  buildStackedChart,
  nearestPointIndex,
  plannedWeeks,
  plotRect,
  remainderPatternKey,
  type LiftSeries,
  type ProgressRange,
  type SeriesPoint,
  type StackedBucket,
} from '@setframe/domain';
import { spacing } from '@setframe/design-tokens';
import { typeScale } from '../theme/typeScale';

/**
 * Setframe's chart primitives.
 *
 * Hand-rolled on native SVG rather than pulled from a charting library: the
 * geometry already lives in `@setframe/domain` (shared with the mobile
 * `react-native-svg` renderer so the two cannot diverge), and a library
 * would add weight while hiding exactly the scale decisions we most need to
 * control. See chart-geometry.ts for why the y-domain differs per chart.
 *
 * Every chart here provides a text equivalent. A screen-reader user gets the
 * same information from a table as a sighted user gets from the line, and
 * selection is reachable by keyboard, so no meaning is locked behind a
 * pointer gesture.
 */

const Figure = styled.figure`
  margin: 0;
  display: grid;
  gap: ${spacing[8]}px;
`;

const Frame = styled.div`
  width: 100%;
  position: relative;
`;

const TickLabel = styled.text`
  font-size: 10px;
  fill: ${(p) => p.theme.chart.axis};
`;

const Readout = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${spacing[8]}px;
  min-height: 20px;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const ReadoutValue = styled.strong`
  color: ${(p) => p.theme.text.primary};
`;

const VisuallyHidden = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;

/**
 * Measures the rendered width so the chart uses real pixels rather than a
 * scaled viewBox, which would shrink axis text along with the plot.
 */
function useElementWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function formatDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export interface LineChartProps {
  series: SeriesPoint[];
  /** Optional smoothed overlay drawn on top of the raw points. */
  trendSeries?: SeriesPoint[];
  height?: number;
  /** False for measures like body weight where zero is absurd. */
  zeroBased?: boolean;
  minimumSpan?: number;
  formatValue: (value: number) => string;
  /**
   * How a mark's period is named. Defaults to the bare date, which is only
   * correct when one mark is one day — a bucketed point is keyed by its
   * bucket's *start*, so at a weekly bucket the bare date claims a reading
   * on a morning that may never have been logged. Callers that bucket must
   * pass a bucket-aware formatter (`formatBucketPeriod`).
   */
  formatPeriod?: (localDate: string) => string;
  /**
   * Optional context for a mark's value — e.g. "average of 5 check-ins".
   * Rendered beside the readout and in the text equivalent, so a summary
   * figure is never mistaken for a single measurement.
   */
  describePoint?: (index: number) => string | null;
  /** Accessible name for the chart. */
  label: string;
  onSelectPoint?: (point: { localDate: string; value: number; index: number }) => void;
  /**
   * Draws the observations as dots with no connecting line. Used when the
   * copy says the data is not yet a trend: a line through two points is a
   * trend claim regardless of what the caption underneath it says.
   */
  pointsOnly?: boolean;
  testId?: string;
}

export function LineChart({
  series,
  trendSeries,
  height = 160,
  zeroBased = false,
  minimumSpan,
  formatValue,
  formatPeriod = formatDate,
  describePoint,
  label,
  onSelectPoint,
  pointsOnly = false,
  testId,
}: LineChartProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<number | null>(null);
  const lastSelected = useRef<number | null>(null);
  const scrubbing = useRef(false);

  const layout = useMemo(
    () => ({ width, height, padding: { top: 10, right: 10, bottom: 22, left: 40 } }),
    [width, height],
  );

  // The trend is scaled against the combined domain so the smoothed line
  // sits on the same axis as the raw points rather than its own.
  const combined = useMemo(
    () => (trendSeries ? [...series, ...trendSeries] : series),
    [series, trendSeries],
  );
  const domainChart = useMemo(
    () => buildLineChart(combined, { layout, zeroBased, minimumSpan, formatValue }),
    [combined, layout, zeroBased, minimumSpan, formatValue],
  );
  const shared = useMemo(
    () => ({ domain: domainChart.domain, dayBounds: domainChart.dayBounds }),
    [domainChart],
  );
  const rawChart = useMemo(
    () => buildLineChart(series, { layout, formatValue, ...shared }),
    [series, layout, formatValue, shared],
  );
  const trendChart = useMemo(
    () => (trendSeries ? buildLineChart(trendSeries, { layout, formatValue, ...shared }) : null),
    [trendSeries, layout, formatValue, shared],
  );

  const plotted = rawChart.points;
  /* Keyed by date because the two series are bucketed identically but the
     trend can start later, once there is enough history to smooth. */
  const trendByDate = useMemo(
    () => new Map((trendChart?.points ?? []).map((point) => [point.localDate, point])),
    [trendChart],
  );
  const selectedPoint = selected != null ? plotted.find((point) => point.index === selected) : null;

  if (!plotted.length) return null;

  function select(index: number) {
    lastSelected.current = index;
    setSelected(index);
    const point = plotted.find((entry) => entry.index === index);
    if (point) onSelectPoint?.({ localDate: point.localDate, value: point.value, index: point.index });
  }

  function scrubTo(clientX: number, surface: SVGRectElement) {
    const box = surface.getBoundingClientRect();
    if (!box.width) return;
    const plotX =
      domainChart.plot.x + ((clientX - box.left) / box.width) * domainChart.plot.width;
    const index = nearestPointIndex(plotted, plotX);
    /* pointermove fires per pixel; re-rendering per pixel is what makes a
       scrub feel bad. Only commit when the nearest datum actually changes.
       Compared against a ref rather than `selected` because pointermove is
       continuous-priority in React: several moves can be batched before a
       commit, leaving the closed-over `selected` stale. Note the jsdom tests
       cannot demonstrate this — fireEvent flushes a render between every
       event — so the ref is reasoned, not test-proven. */
    if (index != null && index !== lastSelected.current) select(index);
  }

  return (
    <Figure data-testid={testId}>
      <Frame ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {domainChart.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={domainChart.plot.x}
                x2={domainChart.plot.x + domainChart.plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <TickLabel x={0} y={tick.y + 3}>
                {tick.label}
              </TickLabel>
            </g>
          ))}

          {rawChart.areaPath && !pointsOnly ? (
            <path d={rawChart.areaPath} fill={theme.chart.band} stroke="none" />
          ) : null}
          {rawChart.path && !pointsOnly ? (
            <path
              d={rawChart.path}
              fill="none"
              stroke={theme.chart.raw}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {trendChart?.path ? (
            <path
              d={trendChart.path}
              fill="none"
              stroke={theme.chart.trend}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="chart-trend-line"
            />
          ) : null}

          {plotted.map((point) => {
            const isSelected = point.index === selected;
            return (
              <g key={`${point.localDate}-${point.index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 5 : 3}
                  fill={isSelected ? theme.chart.emphasis : theme.chart.raw}
                  stroke={theme.surface.raised}
                  strokeWidth={1.5}
                />
                {/* A generous transparent hit area: 3px dots are not a
                    touch target, and pointer users should not have to aim. */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(layout.width / Math.max(plotted.length, 1) / 2, 12)}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={[
                    `${formatPeriod(point.localDate)}: ${formatValue(point.value)}`,
                    describePoint?.(point.index),
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  data-testid="chart-point"
                  /* Keyboard and assistive tech reach selection through these
                     circles; live pointer input belongs to the scrub surface
                     below, so one element owns both tap and drag. */
                  style={{
                    cursor: onSelectPoint ? 'pointer' : 'default',
                    outline: 'none',
                    pointerEvents: 'none',
                  }}
                  onClick={() => select(point.index)}
                  onFocus={() => setSelected(point.index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(point.index);
                    }
                  }}
                />
              </g>
            );
          })}

          {/* ADR 0008's sharp edge: whatever holds pointer capture must not be
              re-created mid-drag, or the browser silently ends the gesture.
              None of this rect's props depend on `selected`, and it is always
              the last child, so React reuses the same DOM node across every
              selection change and the capture survives the whole scrub. */}
          <rect
            x={domainChart.plot.x}
            y={domainChart.plot.y}
            width={domainChart.plot.width}
            height={domainChart.plot.height}
            fill="transparent"
            data-testid="chart-scrub-surface"
            /* pan-y so the page still scrolls vertically past a chart that
               fills most of a 390px screen; horizontal movement is ours. */
            style={{ touchAction: 'pan-y', cursor: onSelectPoint ? 'crosshair' : 'default' }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              scrubbing.current = true;
              scrubTo(event.clientX, event.currentTarget);
            }}
            onPointerMove={(event) => {
              if (scrubbing.current) scrubTo(event.clientX, event.currentTarget);
            }}
            onPointerUp={(event) => {
              scrubbing.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              scrubbing.current = false;
            }}
          />
        </svg>
      </Frame>

      <Readout aria-live="polite" data-testid="chart-readout">
        {selectedPoint ? (
          <>
            <ReadoutValue>{formatValue(selectedPoint.value)}</ReadoutValue>
            <span>{formatPeriod(selectedPoint.localDate)}</span>
            {describePoint?.(selectedPoint.index) ? (
              <span data-testid="chart-point-context">{describePoint(selectedPoint.index)}</span>
            ) : null}
          </>
        ) : (
          <span>Select a point to see its date and value.</span>
        )}
      </Readout>

      {/* Text equivalent — the same information without the picture. The
          smoothed line is a separate labelled column rather than being folded
          in with the measurements, so the distinction between what was
          recorded and what was derived survives without the colours. */}
      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Measured</th>
              {trendChart ? <th scope="col">Trend</th> : null}
            </tr>
          </thead>
          <tbody>
            {plotted.map((point) => {
              const context = describePoint?.(point.index);
              const trendPoint = trendByDate.get(point.localDate);
              return (
                <tr key={`row-${point.index}`}>
                  <th scope="row">{formatPeriod(point.localDate)}</th>
                  <td>{context ? `${formatValue(point.value)} (${context})` : formatValue(point.value)}</td>
                  {trendChart ? (
                    <td>{trendPoint ? formatValue(trendPoint.value) : 'no trend yet'}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}

export interface ColumnChartProps {
  series: SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[];
  height?: number;
  /** Exact value, for the readout and screen-reader labels. */
  formatValue: (value: number) => string;
  /**
   * Axis-tick value, where a full one will not fit. `12,420 lb` under a bar at
   * 390px overlaps its neighbour; `12k lb` does not. Selecting a bar still
   * reports the exact figure, so the abbreviation never hides the real number.
   */
  formatTick?: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  /** Smallest axis step. Pass 1 when the bars count whole things. */
  minStep?: number;
  label: string;
  emptyLabel?: string;
  /**
   * What an in-progress period is called. Defaults to the week, but a daily
   * or monthly bucket must not be announced as "current week" — the readout
   * and the screen-reader label would both be describing the wrong span.
   */
  currentLabel?: string;
  onSelectColumn?: (column: { localDate: string; value: number | null; index: number }) => void;
  testId?: string;
}

export function ColumnChart({
  series,
  height = 140,
  formatValue,
  formatTick,
  formatPeriod = formatDate,
  minStep,
  label,
  emptyLabel = 'No sessions',
  currentLabel = 'Current week',
  onSelectColumn,
  testId,
}: ColumnChartProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<number | null>(null);

  const chart = useMemo(
    () =>
      buildColumnChart(series, {
        layout: { width, height, padding: { top: 10, right: 8, bottom: 22, left: 40 } },
        formatValue: formatTick ?? formatValue,
        minStep,
      }),
    [series, width, height, formatValue, formatTick, minStep],
  );

  const selectedColumn = selected != null ? chart.columns[selected] : null;

  function select(index: number) {
    setSelected(index);
    const column = chart.columns[index];
    if (column) {
      onSelectColumn?.({ localDate: column.localDate, value: column.value, index });
    }
  }

  return (
    <Figure data-testid={testId}>
      <Frame ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={chart.plot.x}
                x2={chart.plot.x + chart.plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <TickLabel x={0} y={tick.y + 3}>
                {tick.label}
              </TickLabel>
            </g>
          ))}

          {chart.columns.map((column, index) => {
            const isSelected = index === selected;
            const isCurrent = column.meta?.isCurrent === true;
            // A week off on purpose is not the same as a week that vanished,
            // so the zero stub is tinted rather than left neutral grey.
            const isRest = column.meta?.isRest === true;
            // An empty period is drawn as a flat stub rather than nothing at
            // all, so a missed week reads as a real, visible zero.
            const emptyHeight = 2;
            return (
              <g key={`${column.localDate}-${index}`}>
                <rect
                  x={column.x}
                  y={column.value == null || column.height < emptyHeight ? chart.plot.y + chart.plot.height - emptyHeight : column.y}
                  width={column.width}
                  height={column.value == null || column.height < emptyHeight ? emptyHeight : column.height}
                  rx={4}
                  fill={
                    column.value === 0 || column.value == null
                      ? isRest
                        ? theme.chart.trend
                        : theme.chart.empty
                      : isSelected
                        ? theme.chart.emphasis
                        : isCurrent
                          ? theme.chart.trend
                          : theme.chart.raw
                  }
                  data-testid={isCurrent ? 'chart-column-current' : 'chart-column'}
                />
                <rect
                  x={chart.plot.x + chart.slotWidth * index}
                  y={chart.plot.y}
                  width={chart.slotWidth}
                  height={chart.plot.height}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatPeriod(column.localDate)}: ${
                    column.value == null ? emptyLabel : formatValue(column.value)
                  }${isRest ? ', rest week' : ''}${isCurrent ? `, ${currentLabel.toLowerCase()}, still in progress` : ''}`}
                  style={{ cursor: onSelectColumn ? 'pointer' : 'default', outline: 'none' }}
                  onClick={() => select(index)}
                  onFocus={() => setSelected(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(index);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </Frame>

      <Readout aria-live="polite" data-testid="chart-readout">
        {selectedColumn ? (
          <>
            <ReadoutValue>
              {selectedColumn.value == null ? emptyLabel : formatValue(selectedColumn.value)}
            </ReadoutValue>
            <span>{formatPeriod(selectedColumn.localDate)}</span>
            {/* Story 33: current/incomplete period must be labeled
                semantically, not only by its distinct fill color. */}
            {selectedColumn.meta?.isCurrent ? (
              <span data-testid="chart-current-label">{`${currentLabel} · still in progress`}</span>
            ) : null}
          </>
        ) : (
          <span>Select a bar to see its period and value.</span>
        )}
      </Readout>

      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <tbody>
            {chart.columns.map((column, index) => (
              <tr key={`row-${index}`}>
                <th scope="row">
                  {formatPeriod(column.localDate)}
                  {column.meta?.isCurrent ? ` (${currentLabel}, still in progress)` : ''}
                </th>
                <td>{column.value == null ? emptyLabel : formatValue(column.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}

const RangeRow = styled.div`
  display: flex;
  gap: ${spacing[4]}px;
  flex-wrap: wrap;
`;

const RangeButton = styled.button<{ $active: boolean }>`
  min-height: 32px;
  padding: 0 ${spacing[12]}px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? 'transparent' : p.theme.border.default)};
  background: ${(p) => (p.$active ? p.theme.action.primary : 'transparent')};
  color: ${(p) => (p.$active ? p.theme.action.primaryText : p.theme.text.secondary)};
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 600;
  cursor: pointer;

  /* A range with no data behind it stays visible and dimmed rather than
     disappearing. The previous control hid unavailable ranges and rendered
     nothing at all below two options, so a new user saw no time-range
     control and reasonably concluded it did not exist. Dimmed-but-present
     says "this unlocks as you log more". */
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export interface RangeSelectorProps {
  /** Every range, each flagged if the data cannot fill it. Never filtered. */
  options: Array<{ range: ProgressRange; disabled: boolean }>;
  value: ProgressRange;
  onChange: (range: ProgressRange) => void;
  label: string;
}

export function RangeSelector({ options, value, onChange, label }: RangeSelectorProps) {
  return (
    <RangeRow role="group" aria-label={label} data-testid="chart-range-selector">
      {options.map(({ range, disabled }) => (
        <RangeButton
          key={range}
          type="button"
          $active={range === value}
          aria-pressed={range === value}
          disabled={disabled}
          /* Disabled rather than removed, so the reason is legible to a
             screen reader too instead of the option silently not existing. */
          title={disabled ? 'Not enough history for this range yet' : undefined}
          onClick={() => onChange(range)}
        >
          {range}
        </RangeButton>
      ))}
    </RangeRow>
  );
}

const Legend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[4]}px ${spacing[12]}px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const LegendItem = styled.li<{ $muted: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
  opacity: ${(p) => (p.$muted ? 0.45 : 1)};
`;

const Swatch = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${(p) => p.$color};
  flex: none;
`;

const Disclosure = styled.p`
  margin: 0;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;

const BreakdownRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
`;

export interface StackedChartProps {
  buckets: StackedBucket[];
  /** Stack order, bottom first. Use `orderMovementPatterns` to derive it. */
  keys: string[];
  /** Display name for a series key. */
  labelForKey: (key: string) => string;
  height?: number;
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  label: string;
  emptyLabel?: string;
  currentLabel?: string;
  /** Rendered under the legend, e.g. the unclassified-volume disclosure. */
  disclosure?: string;
  testId?: string;
}

/**
 * A stacked column chart — composition over time.
 *
 * The hit target is the whole column, not the individual segment. Selecting a
 * week and reading its full breakdown is the useful interaction; selecting a
 * single band would make the user tap five times to learn what one tap can
 * tell them, and the thinnest bands are the hardest to hit.
 *
 * The text equivalent is a real matrix — one row per period, one cell per
 * series — because the composition *is* the information here. A table of
 * weekly totals would be a text equivalent of a different chart.
 */
export function StackedChart({
  buckets,
  keys,
  labelForKey,
  height = 168,
  formatValue,
  formatTick,
  formatPeriod = formatDate,
  label,
  emptyLabel = 'Nothing logged',
  currentLabel = 'Current week',
  disclosure,
  testId,
}: StackedChartProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<number | null>(null);

  const colorFor = useMemo(() => {
    const palette = theme.chart.series;
    const map = new Map<string, string>();
    let next = 0;
    for (const key of keys) {
      if (key === remainderPatternKey) {
        map.set(key, theme.chart.seriesRemainder);
        continue;
      }
      map.set(key, palette[next % palette.length] ?? theme.chart.raw);
      next += 1;
    }
    return (key: string) => map.get(key) ?? theme.chart.raw;
  }, [keys, theme]);

  const chart = useMemo(
    () =>
      buildStackedChart(
        buckets,
        plotRect({ width, height, insets: { top: 10, right: 8, bottom: 22, left: 40 } }),
        { keys, format: formatTick ?? formatValue },
      ),
    [buckets, keys, width, height, formatValue, formatTick],
  );

  const selectedColumn = selected != null ? chart.columns[selected] : null;

  /** Descending by value, so the readout leads with what dominated the week. */
  function breakdown(column: (typeof chart.columns)[number]) {
    return [...column.segments].sort((a, b) => b.value - a.value);
  }

  return (
    <Figure data-testid={testId}>
      <Frame ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={chart.plot.x}
                x2={chart.plot.x + chart.plot.width}
                y1={tick.position}
                y2={tick.position}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <TickLabel x={0} y={tick.position + 3}>
                {tick.label}
              </TickLabel>
            </g>
          ))}

          {chart.columns.map((column, index) => {
            const isSelected = index === selected;
            const isCurrent = (column.meta as { isCurrent?: boolean } | undefined)?.isCurrent === true;
            const parts = breakdown(column);
            return (
              <g key={`${column.localDate}-${index}`}>
                {/* An empty period gets a visible stub, so a missed week
                    reads as a real zero rather than as a rendering gap. */}
                {column.segments.length === 0 ? (
                  <rect
                    x={column.x}
                    y={chart.plot.y + chart.plot.height - 2}
                    width={column.width}
                    height={2}
                    rx={1}
                    fill={theme.chart.empty}
                    data-testid="stacked-empty"
                  />
                ) : (
                  column.segments.map((segment) => (
                    <rect
                      key={segment.key}
                      x={segment.x}
                      y={segment.y}
                      width={segment.width}
                      height={segment.height}
                      fill={colorFor(segment.key)}
                      opacity={selected == null || isSelected ? 1 : 0.55}
                      data-testid={`stacked-segment-${segment.key}`}
                    />
                  ))
                )}
                <rect
                  x={chart.plot.x + chart.slotWidth * index}
                  y={chart.plot.y}
                  width={chart.slotWidth}
                  height={chart.plot.height}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatPeriod(column.localDate)}: ${
                    column.total === 0
                      ? emptyLabel
                      : `${formatValue(column.total)} total, ${parts
                          .map((part) => `${labelForKey(part.key)} ${formatValue(part.value)}`)
                          .join(', ')}`
                  }${isCurrent ? `, ${currentLabel.toLowerCase()}, still in progress` : ''}`}
                  style={{ cursor: 'pointer', outline: 'none' }}
                  onClick={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(index);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </Frame>

      <Readout aria-live="polite" data-testid="stacked-readout">
        {selectedColumn ? (
          selectedColumn.total === 0 ? (
            <>
              <ReadoutValue>{emptyLabel}</ReadoutValue>
              <span>{formatPeriod(selectedColumn.localDate)}</span>
            </>
          ) : (
            <>
              <ReadoutValue>{formatValue(selectedColumn.total)}</ReadoutValue>
              <span>{formatPeriod(selectedColumn.localDate)}</span>
              {breakdown(selectedColumn).map((part) => (
                <BreakdownRow key={part.key}>
                  <Swatch $color={colorFor(part.key)} aria-hidden="true" />
                  {labelForKey(part.key)} {formatValue(part.value)}
                </BreakdownRow>
              ))}
              {(selectedColumn.meta as { isCurrent?: boolean } | undefined)?.isCurrent ? (
                <span data-testid="stacked-current-label">{`${currentLabel} · still in progress`}</span>
              ) : null}
            </>
          )
        ) : (
          <span>Select a bar to see what you trained that period.</span>
        )}
      </Readout>

      <Legend data-testid="stacked-legend">
        {chart.keys.map((key) => (
          <LegendItem key={key} $muted={false}>
            <Swatch $color={colorFor(key)} aria-hidden="true" />
            {labelForKey(key)}
          </LegendItem>
        ))}
      </Legend>

      {disclosure ? <Disclosure data-testid="stacked-disclosure">{disclosure}</Disclosure> : null}

      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              {chart.keys.map((key) => (
                <th scope="col" key={key}>
                  {labelForKey(key)}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {chart.columns.map((column, index) => (
              <tr key={`row-${index}`}>
                <th scope="row">
                  {formatPeriod(column.localDate)}
                  {(column.meta as { isCurrent?: boolean } | undefined)?.isCurrent
                    ? ` (${currentLabel}, still in progress)`
                    : ''}
                </th>
                {chart.keys.map((key) => {
                  const segment = column.segments.find((entry) => entry.key === key);
                  return <td key={key}>{segment ? formatValue(segment.value) : '—'}</td>;
                })}
                <td>{column.total === 0 ? emptyLabel : formatValue(column.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}

const PanelGrid = styled.div`
  display: grid;
  gap: ${spacing[4]}px;
`;

const PanelRow = styled.div<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  padding: ${spacing[8]}px;
  border-radius: 10px;
  border: 1px solid ${(p) => (p.$selected ? p.theme.chart.emphasis : 'transparent')};
  background: ${(p) => (p.$selected ? p.theme.action.accentSubtle : 'transparent')};
  cursor: pointer;
  text-align: left;
  width: 100%;
  font: inherit;
  color: inherit;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

const PanelHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${spacing[8]}px;
`;

const PanelName = styled.span`
  font-size: ${typeScale.body.fontSize}px;
  font-weight: 600;
`;

const PanelValue = styled.span`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  white-space: nowrap;
`;

const PanelChange = styled.strong<{ $direction: 'up' | 'down' | 'flat' }>`
  color: ${(p) =>
    p.$direction === 'up'
      ? p.theme.status.success
      : p.$direction === 'down'
        ? p.theme.text.secondary
        : p.theme.text.secondary};
`;

const AxisRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: ${(p) => p.theme.chart.axis};
  padding: 0 ${spacing[8]}px;
`;

export interface SmallMultiplesProps {
  lifts: LiftSeries[];
  /** Height of a single sparkline. */
  panelHeight?: number;
  formatValue: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  /** Minimum observations before a panel is drawn at all. */
  minimumPoints?: number;
  /** Minimum value-domain height, so a tiny change is not drawn as a climb. */
  minimumSpan?: number;
  /** Minimum domain height as a fraction of the lift's own median value. */
  minimumSpanRatio?: number;
  label: string;
  testId?: string;
}

/**
 * Small multiples — one sparkline per lift over a **shared time axis**.
 *
 * The comparison this exists to enable is vertical: scanning down a column of
 * panels to see that everything flattened in the same fortnight. That only
 * works if a given date lands at the same x in every panel, which is why the
 * time axis is computed once across all lifts and labelled once underneath
 * rather than per panel.
 *
 * Value axes are per panel and deliberately not shared. A deadlift and a
 * lateral raise differ by an order of magnitude, so one axis would draw every
 * light lift as a flat line along the bottom. The cost is that panel heights
 * are not comparable to each other, which is why each panel states its own
 * range in text — an unlabelled sparkline invites exactly the cross-panel
 * height comparison that would be meaningless here.
 */
export function SmallMultiples({
  lifts,
  panelHeight = 44,
  formatValue,
  formatPeriod = formatDate,
  minimumPoints,
  minimumSpan,
  minimumSpanRatio,
  label,
  testId,
}: SmallMultiplesProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<string | null>(null);

  const result = useMemo(
    () =>
      buildSmallMultiples(lifts, {
        panel: { width, height: panelHeight },
        // No left gutter: the value range is stated in the header text, so
        // the sparkline itself needs no axis labels and can use full width.
        insets: { top: 6, right: 6, bottom: 6, left: 6 },
        minimumPoints,
        minimumSpan,
        minimumSpanRatio,
        formatValue,
      }),
    [lifts, width, panelHeight, minimumPoints, minimumSpan, minimumSpanRatio, formatValue],
  );

  if (!result.panels.length) return null;

  const axisStart = result.bounds.first
    ? formatPeriod(new Date(result.bounds.first).toISOString().slice(0, 10))
    : '';
  const axisEnd = result.bounds.last
    ? formatPeriod(new Date(result.bounds.last).toISOString().slice(0, 10))
    : '';

  return (
    <Figure data-testid={testId}>
      <PanelGrid ref={ref}>
        {result.panels.map((panel) => {
          const isSelected = panel.id === selected;
          const direction: 'up' | 'down' | 'flat' =
            panel.change == null || panel.change === 0 ? 'flat' : panel.change > 0 ? 'up' : 'down';
          /* Direction is stated with an arrow and a signed number, never by
             colour alone — and a fall is not painted red. Training load
             comes down on purpose in a deload, and colouring that as failure
             is the same mistake the body-weight chart exists to avoid. */
          const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';

          return (
            <PanelRow
              key={panel.id}
              as="button"
              type="button"
              $selected={isSelected}
              data-testid="lift-panel"
              onClick={() => setSelected(isSelected ? null : panel.id)}
              aria-label={`${panel.name}: now ${formatValue(panel.last)}${
                panel.change != null
                  ? `, ${direction === 'flat' ? 'unchanged' : direction === 'up' ? 'up' : 'down'} ${formatValue(
                      Math.abs(panel.change),
                    )} over this range`
                  : ''
              }${
                panel.personalRecords.length
                  ? `, ${panel.personalRecords.length} personal record${
                      panel.personalRecords.length === 1 ? '' : 's'
                    }`
                  : ''
              }`}
            >
              <PanelHead>
                <PanelName>{panel.name}</PanelName>
                <PanelValue>
                  {formatValue(panel.last)}
                  {panel.change != null ? (
                    <>
                      {'  '}
                      <PanelChange $direction={direction}>
                        {`${arrow} ${formatValue(Math.abs(panel.change))}`}
                      </PanelChange>
                    </>
                  ) : null}
                </PanelValue>
              </PanelHead>

              <svg
                width={width}
                height={panelHeight}
                role="img"
                aria-label={`${panel.name} trend, ${formatValue(panel.domain.min)} to ${formatValue(
                  panel.domain.max,
                )}`}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <path
                  d={panel.path}
                  fill="none"
                  stroke={theme.chart.raw}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {panel.points.map((point) => (
                  <circle
                    key={point.localDate}
                    cx={point.x}
                    cy={point.y}
                    r={point.isPr ? 3.5 : 2}
                    fill={point.isPr ? theme.chart.trend : theme.chart.raw}
                    stroke={point.isPr ? theme.surface.raised : 'none'}
                    strokeWidth={point.isPr ? 1.5 : 0}
                    data-testid={point.isPr ? 'lift-pr-marker' : 'lift-point'}
                  />
                ))}
              </svg>

              {/* The PR annotation must not be colour-only. */}
              {panel.personalRecords.length ? (
                <PanelValue data-testid="lift-pr-note">
                  {`${panel.personalRecords.length} PR${
                    panel.personalRecords.length === 1 ? '' : 's'
                  } · latest ${formatPeriod(panel.personalRecords.at(-1)!.localDate)}`}
                </PanelValue>
              ) : null}

              {isSelected ? (
                <PanelValue data-testid="lift-panel-detail">
                  {`Range ${formatValue(panel.domain.min)}–${formatValue(panel.domain.max)} · ${
                    panel.points.length
                  } sessions · from ${formatValue(panel.first)} on ${formatPeriod(
                    panel.points[0]!.localDate,
                  )}`}
                </PanelValue>
              ) : null}
            </PanelRow>
          );
        })}
      </PanelGrid>

      {/* Labelled once, because every panel shares it. */}
      <AxisRow aria-hidden="true">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </AxisRow>

      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Lift</th>
              <th scope="col">Start</th>
              <th scope="col">Latest</th>
              <th scope="col">Change</th>
              <th scope="col">Sessions</th>
              <th scope="col">Personal records</th>
            </tr>
          </thead>
          <tbody>
            {result.panels.map((panel) => (
              <tr key={panel.id}>
                <th scope="row">{panel.name}</th>
                <td>{formatValue(panel.first)}</td>
                <td>{formatValue(panel.last)}</td>
                <td>{panel.change == null ? '—' : formatValue(panel.change)}</td>
                <td>{panel.points.length}</td>
                <td>{panel.personalRecords.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}

const AdherenceRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[4]}px 0;
`;

const AdherenceWeek = styled.span`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  white-space: nowrap;
  min-width: 52px;
`;

const AdherenceTrack = styled.div`
  position: relative;
  height: 16px;
  border-radius: 4px;
  background: ${(p) => p.theme.chart.empty};
  overflow: visible;
`;

const AdherenceFill = styled.div<{ $verdict: string }>`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  background: ${(p) =>
    p.$verdict === 'behind' ? p.theme.chart.raw : p.theme.chart.trend};
`;

const AdherenceTarget = styled.div`
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: ${(p) => p.theme.text.primary};
`;

const AdherenceCount = styled.span`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  white-space: nowrap;
  min-width: 44px;
  text-align: right;
`;

export interface AdherenceWeekDatum {
  weekStart: string;
  completedCount: number;
  plannedCount: number | null;
  isCurrent: boolean;
}

export interface AdherenceChartProps {
  weeks: AdherenceWeekDatum[];
  formatPeriod?: (localDate: string) => string;
  label: string;
  testId?: string;
}

/**
 * Planned versus completed, superposed on one track per week.
 *
 * Superposition rather than two side-by-side bars: planned and completed are
 * the same quantity in the same unit, and the question is the *relationship*
 * between them. Juxtaposing them makes the reader compute a difference the
 * chart could simply show. The target line is what turns each row into a
 * single readable comparison — bar past the line means the plan was met.
 *
 * A week is drawn at all only when it had a plan. `plannedCount: null` means
 * the program did not cover that week, and rendering "0 of 0" across a user's
 * early history would invent a shortfall from an absence.
 *
 * Exceeding the plan is drawn in the same colour as meeting it, never as an
 * exception, and falling short is not painted red — the accent, not an error
 * colour, because missing a session is a fact about a week and not a fault.
 */
export function AdherenceChart({
  weeks,
  formatPeriod = formatDate,
  label,
  testId,
}: AdherenceChartProps) {
  const planned = plannedWeeks(weeks);
  if (!planned.length) return null;

  // One scale across every row, so bar lengths are comparable down the column.
  const scaleMax = Math.max(
    ...planned.map((week) => Math.max(week.completedCount, week.plannedCount ?? 0)),
    1,
  );

  return (
    <Figure data-testid={testId}>
      <div>
        {planned.map((week) => {
          const target = week.plannedCount ?? 0;
          const verdict =
            week.completedCount >= target ? (week.completedCount > target ? 'ahead' : 'onPlan') : 'behind';
          return (
            <AdherenceRow key={week.weekStart} data-testid="adherence-row">
              <AdherenceWeek>{formatPeriod(week.weekStart)}</AdherenceWeek>
              <AdherenceTrack
                role="img"
                aria-label={`${formatPeriod(week.weekStart)}: ${week.completedCount} of ${target} planned sessions${
                  week.isCurrent ? ', current week, still in progress' : ''
                }`}
              >
                <AdherenceFill
                  $verdict={verdict}
                  data-testid={`adherence-fill-${verdict}`}
                  style={{ width: `${Math.min((week.completedCount / scaleMax) * 100, 100)}%` }}
                />
                <AdherenceTarget
                  data-testid="adherence-target"
                  style={{ left: `${(target / scaleMax) * 100}%` }}
                />
              </AdherenceTrack>
              <AdherenceCount>
                {week.isCurrent
                  ? `${week.completedCount}/${target} so far`
                  : `${week.completedCount}/${target}`}
              </AdherenceCount>
            </AdherenceRow>
          );
        })}
      </div>

      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Planned</th>
              <th scope="col">Completed</th>
            </tr>
          </thead>
          <tbody>
            {planned.map((week) => (
              <tr key={week.weekStart}>
                <th scope="row">
                  {formatPeriod(week.weekStart)}
                  {week.isCurrent ? ' (current week, still in progress)' : ''}
                </th>
                <td>{week.plannedCount}</td>
                <td>{week.completedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}
