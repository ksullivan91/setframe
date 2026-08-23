import { useEffect, useMemo, useRef, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import {
  buildColumnChart,
  buildLineChart,
  type ChartRange,
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
  label,
  onSelectPoint,
  pointsOnly = false,
  testId,
}: LineChartProps) {
  const theme = useTheme();
  const [ref, width] = useElementWidth(320);
  const [selected, setSelected] = useState<number | null>(null);

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
    setSelected(index);
    const point = plotted.find((entry) => entry.index === index);
    if (point) onSelectPoint?.({ localDate: point.localDate, value: point.value, index: point.index });
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
                  aria-label={`${formatDate(point.localDate)}: ${formatValue(point.value)}`}
                  data-testid="chart-point"
                  style={{ cursor: onSelectPoint ? 'pointer' : 'default', outline: 'none' }}
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
        </svg>
      </Frame>

      <Readout aria-live="polite" data-testid="chart-readout">
        {selectedPoint ? (
          <>
            <ReadoutValue>{formatValue(selectedPoint.value)}</ReadoutValue>
            <span>{formatDate(selectedPoint.localDate)}</span>
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
                <th scope="row">{formatDate(point.localDate)}</th>
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
                  }${isRest ? ', rest week' : ''}`}
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
`;

export interface RangeSelectorProps {
  ranges: ChartRange[];
  value: ChartRange;
  onChange: (range: ChartRange) => void;
  label: string;
}

export function RangeSelector({ ranges, value, onChange, label }: RangeSelectorProps) {
  // Offering a single range is offering no choice; the caller decides which
  // ranges the data can actually support.
  if (ranges.length < 2) return null;
  return (
    <RangeRow role="group" aria-label={label} data-testid="chart-range-selector">
      {ranges.map((range) => (
        <RangeButton
          key={range}
          type="button"
          $active={range === value}
          aria-pressed={range === value}
          onClick={() => onChange(range)}
        >
          {range}
        </RangeButton>
      ))}
    </RangeRow>
  );
}
