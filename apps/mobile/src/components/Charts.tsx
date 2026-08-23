import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import {
  buildColumnChart,
  buildLineChart,
  type ChartRange,
  type SeriesPoint,
} from '@setframe/domain';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, typeScale } from '../theme/getTheme';

/**
 * Setframe's mobile chart primitives — the `react-native-svg` counterparts of
 * the web `Charts.tsx`. All geometry comes from `@setframe/domain` so the two
 * renderers cannot draw the same series differently; the SVG path strings the
 * shared module emits are accepted verbatim by `react-native-svg`.
 *
 * Touch has no hover and a 3px dot is not a target, so selection is exposed as
 * full-height `Pressable` bands rather than tiny marks — each point owns the
 * span to the midpoints of its neighbours and each column owns its whole slot,
 * so a tap always resolves to the nearest mark with no overlap or dead gap.
 * Every chart also carries a text equivalent reachable by VoiceOver without
 * any gesture.
 */

function formatDate(localDate: string): string {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function useMeasuredWidth(fallback: number): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(fallback);
  const onLayout = (event: LayoutChangeEvent) => {
    const measured = (event.nativeEvent.layout as LayoutRectangle).width;
    if (measured > 0 && measured !== width) setWidth(measured);
  };
  return [width, onLayout];
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
  testID?: string;
}

export function LineChart({
  series,
  trendSeries,
  height = 168,
  zeroBased = false,
  minimumSpan,
  formatValue,
  label,
  onSelectPoint,
  pointsOnly = false,
  testID,
}: LineChartProps) {
  const theme = useTheme();
  const [width, onLayout] = useMeasuredWidth(320);
  const [selected, setSelected] = useState<number | null>(null);

  const layout = useMemo(
    () => ({ width, height, padding: { top: 10, right: 10, bottom: 22, left: 40 } }),
    [width, height],
  );

  // The trend is scaled against the combined domain so the smoothed line sits
  // on the same axis as the raw points rather than its own. `zeroBased` and
  // `minimumSpan` shape only this domain; the derived charts adopt it wholesale
  // via `shared`, or a narrower overlay would be stretched onto its own scale.
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

  const tableLabel = `${label}. ${plotted
    .map((point) => `${formatDate(point.localDate)}: ${formatValue(point.value)}`)
    .join('. ')}`;

  return (
    <View style={styles.figure} testID={testID}>
      <View style={{ width: '100%', height }} onLayout={onLayout}>
        <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {domainChart.ticks.map((tick) => (
            <G key={tick.value}>
              <Line
                x1={domainChart.plot.x}
                x2={domainChart.plot.x + domainChart.plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <SvgText x={0} y={tick.y + 3} fontSize={10} fill={theme.chart.axis}>
                {tick.label}
              </SvgText>
            </G>
          ))}

          {rawChart.areaPath && !pointsOnly ? <Path d={rawChart.areaPath} fill={theme.chart.band} /> : null}
          {rawChart.path && !pointsOnly ? (
            <Path
              d={rawChart.path}
              fill="none"
              stroke={theme.chart.raw}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {trendChart?.path ? (
            <Path
              d={trendChart.path}
              fill="none"
              stroke={theme.chart.trend}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              testID="chart-trend-line"
            />
          ) : null}

          {plotted.map((point) => {
            const isSelected = point.index === selected;
            return (
              <Circle
                key={`${point.localDate}-${point.index}`}
                cx={point.x}
                cy={point.y}
                r={isSelected ? 5 : 3}
                fill={isSelected ? theme.chart.emphasis : theme.chart.raw}
                stroke={theme.surface.raised}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>

        {plotted.map((point, order) => {
          // Non-overlapping vertical bands: each point owns the full plot
          // height between the midpoints to its neighbours, so a tap always
          // resolves to the nearest point rather than to whichever fixed
          // overlay happened to render last on top. Edges are clamped inside
          // the parent so Android still dispatches touches to them.
          const prev = plotted[order - 1];
          const next = plotted[order + 1];
          const left = prev ? (prev.x + point.x) / 2 : rawChart.plot.x;
          const right = next ? (point.x + next.x) / 2 : rawChart.plot.x + rawChart.plot.width;
          return (
            <Pressable
              key={`hit-${point.index}`}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(point.localDate)}: ${formatValue(point.value)}`}
              testID="chart-point"
              onPress={() => select(point.index)}
              style={[
                styles.pointHit,
                { left, width: Math.max(right - left, 1), top: rawChart.plot.y, height: rawChart.plot.height },
              ]}
            />
          );
        })}
      </View>

      <Text style={[styles.readout, { color: theme.text.secondary }]} testID="chart-readout">
        {selectedPoint ? (
          <>
            <Text style={{ color: theme.text.primary, fontWeight: '700' }}>
              {formatValue(selectedPoint.value)}
            </Text>
            {`  ${formatDate(selectedPoint.localDate)}`}
          </>
        ) : (
          'Select a point to see its date and value.'
        )}
      </Text>

      <View
        accessible
        accessibilityLabel={tableLabel}
        style={styles.visuallyHidden}
        testID="chart-table"
      />
    </View>
  );
}

export interface ColumnChartProps {
  series: SeriesPoint<{ isCurrent?: boolean }>[];
  height?: number;
  formatValue: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  label: string;
  emptyLabel?: string;
  onSelectColumn?: (column: { localDate: string; value: number | null; index: number }) => void;
  testID?: string;
}

export function ColumnChart({
  series,
  height = 148,
  formatValue,
  formatPeriod = formatDate,
  label,
  emptyLabel = 'No sessions',
  onSelectColumn,
  testID,
}: ColumnChartProps) {
  const theme = useTheme();
  const [width, onLayout] = useMeasuredWidth(320);
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
    if (column) onSelectColumn?.({ localDate: column.localDate, value: column.value, index });
  }

  const emptyHeight = 2;
  const tableLabel = `${label}. ${chart.columns
    .map(
      (column) =>
        `${formatPeriod(column.localDate)}: ${column.value == null ? emptyLabel : formatValue(column.value)}`,
    )
    .join('. ')}`;

  return (
    <View style={styles.figure} testID={testID}>
      <View style={{ width: '100%', height }} onLayout={onLayout}>
        <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {chart.ticks.map((tick) => (
            <G key={tick.value}>
              <Line
                x1={chart.plot.x}
                x2={chart.plot.x + chart.plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <SvgText x={0} y={tick.y + 3} fontSize={10} fill={theme.chart.axis}>
                {tick.label}
              </SvgText>
            </G>
          ))}

          {chart.columns.map((column, index) => {
            const isSelected = index === selected;
            const isCurrent = column.meta?.isCurrent === true;
            // An empty period is drawn as a flat stub rather than nothing at
            // all, so a missed week reads as a real, visible zero.
            const isEmpty = column.value == null || column.height < emptyHeight;
            return (
              <Rect
                key={`${column.localDate}-${index}`}
                x={column.x}
                y={isEmpty ? chart.plot.y + chart.plot.height - emptyHeight : column.y}
                width={column.width}
                height={isEmpty ? emptyHeight : column.height}
                rx={4}
                fill={
                  column.value == null
                    ? theme.chart.empty
                    : isSelected
                      ? theme.chart.emphasis
                      : isCurrent
                        ? theme.chart.trend
                        : theme.chart.raw
                }
                testID={isCurrent ? 'chart-column-current' : 'chart-column'}
              />
            );
          })}
        </Svg>

        {chart.columns.map((column, index) => (
          <Pressable
            key={`hit-${index}`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${formatPeriod(column.localDate)}: ${
              column.value == null ? emptyLabel : formatValue(column.value)
            }`}
            testID="chart-column-hit"
            onPress={() => select(index)}
            style={[
              styles.columnHit,
              {
                left: chart.plot.x + chart.slotWidth * index,
                width: chart.slotWidth,
                top: chart.plot.y,
                height: chart.plot.height,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.readout, { color: theme.text.secondary }]} testID="chart-readout">
        {selectedColumn ? (
          <>
            <Text style={{ color: theme.text.primary, fontWeight: '700' }}>
              {selectedColumn.value == null ? emptyLabel : formatValue(selectedColumn.value)}
            </Text>
            {`  ${formatPeriod(selectedColumn.localDate)}`}
          </>
        ) : (
          'Select a bar to see its period and value.'
        )}
      </Text>

      <View
        accessible
        accessibilityLabel={tableLabel}
        style={styles.visuallyHidden}
        testID="chart-table"
      />
    </View>
  );
}

export interface RangeSelectorProps {
  ranges: ChartRange[];
  value: ChartRange;
  onChange: (range: ChartRange) => void;
  label: string;
}

export function RangeSelector({ ranges, value, onChange, label }: RangeSelectorProps) {
  const theme = useTheme();
  // Offering a single range is offering no choice; the caller decides which
  // ranges the data can actually support.
  if (ranges.length < 2) return null;
  return (
    <View
      style={styles.rangeRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID="chart-range-selector"
    >
      {ranges.map((range) => {
        const active = range === value;
        return (
          <Pressable
            key={range}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={range}
            testID={`chart-range-${range}`}
            onPress={() => onChange(range)}
            style={[
              styles.rangeButton,
              {
                borderColor: active ? 'transparent' : theme.border.default,
                backgroundColor: active ? theme.action.primary : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: active ? theme.action.primaryText : theme.text.secondary,
                fontSize: typeScale.caption.fontSize,
                fontWeight: '600',
              }}
            >
              {range}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  figure: {
    gap: spacing[8],
  },
  pointHit: {
    position: 'absolute',
  },
  columnHit: {
    position: 'absolute',
  },
  readout: {
    minHeight: 20,
    fontSize: typeScale.caption.fontSize,
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
  rangeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  rangeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing[12],
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
