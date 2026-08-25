import { useEffect, useMemo, useRef, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import {
  buildColumnChart,
  buildLineChart,
  nearestPointIndex,
  type ProgressRange,
  type SeriesPoint,
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
                  aria-label={[`${formatPeriod(point.localDate)}: ${formatValue(point.value)}`, describePoint?.(point.index)].filter(Boolean).join(", ")}
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

      {/* Text equivalent — the same information without the picture. */}
      <VisuallyHidden>
        <table>
          <caption>{label}</caption>
          <tbody>
            {plotted.map((point) => (
              <tr key={`row-${point.index}`}>
                <th scope="row">{formatPeriod(point.localDate)}</th>
                <td>{formatValue(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Figure>
  );
}

export interface ColumnChartProps {
  series: SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[];
  height?: number;
  formatValue: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  label: string;
  emptyLabel?: string;
  onSelectColumn?: (column: { localDate: string; value: number | null; index: number }) => void;
  testId?: string;
}

export function ColumnChart({
  series,
  height = 140,
  formatValue,
  formatPeriod = formatDate,
  label,
  emptyLabel = 'No sessions',
  onSelectColumn,
  testId,
}: ColumnChartProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<number | null>(null);

  const chart = useMemo(
    () =>
      buildColumnChart(series, {
        layout: { width, height, padding: { top: 10, right: 8, bottom: 22, left: 32 } },
        formatValue,
      }),
    [series, width, height, formatValue],
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
                  }${isRest ? ', rest week' : ''}${isCurrent ? ', current week' : ''}`}
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
            {selectedColumn.meta?.isCurrent ? <span data-testid="chart-current-label">Current week</span> : null}
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
                <th scope="row">{formatPeriod(column.localDate)}</th>
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
