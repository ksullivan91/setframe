import { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
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
  buildStackedChart,
  nearestPointIndex,
  plotRect,
  remainderPatternKey,
  shouldClaimScrub,
  type ProgressRange,
  type SeriesPoint,
  type StackedBucket,
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
  testID?: string;
}

export function LineChart({
  series,
  trendSeries,
  height = 168,
  zeroBased = false,
  minimumSpan,
  formatValue,
  formatPeriod = formatDate,
  describePoint,
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
  /* Keyed by date because the two series are bucketed identically but the
     trend can start later, once there is enough history to smooth. Memoized
     above the early return so a scrub, which re-renders once per datum
     crossed, does not rebuild the map on every frame. */
  const trendByDate = useMemo(
    () => new Map((trendChart?.points ?? []).map((point) => [point.localDate, point])),
    [trendChart],
  );
  const selectedPoint = selected != null ? plotted.find((point) => point.index === selected) : null;

  /* Native has no pointer capture, so the equivalent of the web scrub surface
     is a responder on the container. Claiming only on a clearly horizontal
     move means a plain tap still reaches the per-point Pressables underneath
     (and with them VoiceOver), and a vertical drag still scrolls the page. */
  const scrub = useRef<(x: number) => void>(() => {});
  const lastSelected = useRef<number | null>(null);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => shouldClaimScrub(gesture.dx, gesture.dy),
        onPanResponderGrant: (event) => scrub.current(event.nativeEvent.locationX),
        onPanResponderMove: (event) => scrub.current(event.nativeEvent.locationX),
      }),
    [],
  );

  if (!plotted.length) return null;

  function select(index: number) {
    lastSelected.current = index;
    setSelected(index);
    const point = plotted.find((entry) => entry.index === index);
    if (point) onSelectPoint?.({ localDate: point.localDate, value: point.value, index: point.index });
  }

  /* locationX is relative to the container, and the Svg fills it from the
     same origin, so touch x and plotted x share one coordinate space. */
  scrub.current = (x: number) => {
    const best = nearestPointIndex(plotted, x);
    /* Commit only when the nearest datum changes: a move fires continuously,
       and re-rendering per event is what makes a native scrub feel bad. */
    if (best != null && best !== lastSelected.current) select(best);
  };

  const tableLabel = `${label}. ${plotted
    .map((point) => {
      const trendPoint = trendByDate.get(point.localDate);
      return [
        `${formatPeriod(point.localDate)}: measured ${formatValue(point.value)}`,
        describePoint?.(point.index),
        trendChart ? (trendPoint ? `trend ${formatValue(trendPoint.value)}` : 'no trend yet') : null,
      ]
        .filter(Boolean)
        .join(', ');
    })
    .join('. ')}`;

  return (
    <View style={styles.figure} testID={testID}>
      <View
        style={{ width: '100%', height }}
        onLayout={onLayout}
        testID="chart-scrub-surface"
        {...panResponder.panHandlers}
      >
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
              accessibilityLabel={[
                `${formatPeriod(point.localDate)}: ${formatValue(point.value)}`,
                describePoint?.(point.index),
              ]
                .filter(Boolean)
                .join(', ')}
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
            {`  ${formatPeriod(selectedPoint.localDate)}`}
            {describePoint?.(selectedPoint.index) ? `  ·  ${describePoint(selectedPoint.index)}` : ''}
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
  series: SeriesPoint<{ isCurrent?: boolean; isRest?: boolean }>[];
  height?: number;
  /** Exact value, for the readout and the accessibility labels. */
  formatValue: (value: number) => string;
  /**
   * Axis-tick value, where a full one will not fit. `12,420 lb` under a bar on
   * a 390pt screen overlaps its neighbour; `12k` does not. Selecting a bar
   * still reports the exact figure, so this abbreviates a label, never a value.
   */
  formatTick?: (value: number) => string;
  formatPeriod?: (localDate: string) => string;
  /** Smallest axis step. Pass 1 when the bars count whole things. */
  minStep?: number;
  label: string;
  emptyLabel?: string;
  /**
   * What an in-progress period is called. A daily or monthly bucket must not
   * be announced as "current week" — the readout and VoiceOver would both be
   * naming the wrong span.
   */
  currentLabel?: string;
  onSelectColumn?: (column: { localDate: string; value: number | null; index: number }) => void;
  testID?: string;
}

export function ColumnChart({
  series,
  height = 148,
  formatValue,
  formatTick,
  formatPeriod = formatDate,
  minStep,
  label,
  emptyLabel = 'No sessions',
  currentLabel = 'Current week',
  onSelectColumn,
  testID,
}: ColumnChartProps) {
  const theme = useTheme();
  const [width, onLayout] = useMeasuredWidth(320);
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
    if (column) onSelectColumn?.({ localDate: column.localDate, value: column.value, index });
  }

  const emptyHeight = 2;
  const tableLabel = `${label}. ${chart.columns
    .map(
      (column) =>
        `${formatPeriod(column.localDate)}${
          column.meta?.isCurrent === true ? ` (${currentLabel}, still in progress)` : ''
        }: ${column.value == null ? emptyLabel : formatValue(column.value)}`,
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
            // A week off on purpose is not the same as a week that vanished,
            // so the zero stub is tinted rather than left neutral grey.
            const isRest = column.meta?.isRest === true;
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
            }${column.meta?.isRest === true ? ', rest week' : ''}${
              column.meta?.isCurrent === true
                ? `, ${currentLabel.toLowerCase()}, still in progress`
                : ''
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
            {/* Story 33: current/incomplete period must be labeled
                semantically, not only by its distinct fill color. */}
            {selectedColumn.meta?.isCurrent ? (
              <Text testID="chart-current-label">{`  ·  ${currentLabel} · still in progress`}</Text>
            ) : null}
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
  /** Every range, each flagged if the data cannot fill it. Never filtered. */
  options: Array<{ range: ProgressRange; disabled: boolean }>;
  value: ProgressRange;
  onChange: (range: ProgressRange) => void;
  label: string;
}

export function RangeSelector({ options, value, onChange, label }: RangeSelectorProps) {
  const theme = useTheme();
  return (
    <View
      style={styles.rangeRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID="chart-range-selector"
    >
      {options.map(({ range, disabled }) => {
        const active = range === value;
        return (
          <Pressable
            key={range}
            accessible
            accessibilityRole="radio"
            /* Reported disabled rather than omitted, so VoiceOver announces
               the range as present-but-unavailable. The previous control
               hid unfillable ranges and rendered nothing below two options,
               which made the whole feature invisible on sparse data. */
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={range}
            accessibilityHint={disabled ? 'Not enough history for this range yet' : undefined}
            testID={`chart-range-${range}`}
            disabled={disabled}
            onPress={() => onChange(range)}
            style={[
              styles.rangeButton,
              {
                borderColor: active ? 'transparent' : theme.border.default,
                backgroundColor: active ? theme.action.primary : 'transparent',
                opacity: disabled ? 0.4 : 1,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing[12],
    rowGap: spacing[4],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  legendLabel: {
    fontSize: typeScale.caption.fontSize,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
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

export interface StackedChartProps {
  buckets: StackedBucket[];
  /** Stack order, bottom first. */
  keys: string[];
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
  testID?: string;
}

/**
 * Stacked columns — the `react-native-svg` counterpart of the web
 * `StackedChart`, drawing the identical `buildStackedChart` geometry.
 *
 * As on web the hit target is the whole column, not the segment. That matters
 * more here: the thinnest band in a stack can be two or three pixels tall,
 * which is not a touch target at all, and tapping a week to read its whole
 * breakdown is the useful interaction anyway.
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
  testID,
}: StackedChartProps) {
  const theme = useTheme();
  const [width, onLayout] = useMeasuredWidth(320);
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
  const breakdown = (column: (typeof chart.columns)[number]) =>
    [...column.segments].sort((a, b) => b.value - a.value);

  const describe = (column: (typeof chart.columns)[number]) =>
    column.total === 0
      ? emptyLabel
      : `${formatValue(column.total)} total, ${breakdown(column)
          .map((part) => `${labelForKey(part.key)} ${formatValue(part.value)}`)
          .join(', ')}`;

  const tableLabel = `${label}. ${chart.columns
    .map(
      (column) =>
        `${formatPeriod(column.localDate)}${
          (column.meta as { isCurrent?: boolean } | undefined)?.isCurrent
            ? ` (${currentLabel}, still in progress)`
            : ''
        }: ${describe(column)}`,
    )
    .join('. ')}`;

  return (
    <View style={styles.figure} testID={testID}>
      <View style={{ width: '100%', height }} onLayout={onLayout}>
        <Svg
          width={width}
          height={height}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {chart.ticks.map((tick) => (
            <G key={tick.value}>
              <Line
                x1={chart.plot.x}
                x2={chart.plot.x + chart.plot.width}
                y1={tick.position}
                y2={tick.position}
                stroke={theme.chart.gridline}
                strokeWidth={1}
              />
              <SvgText x={0} y={tick.position + 3} fontSize={10} fill={theme.chart.axis}>
                {tick.label}
              </SvgText>
            </G>
          ))}

          {chart.columns.map((column, index) =>
            /* An empty period is drawn as a flat stub rather than nothing at
               all, so a missed week reads as a real, visible zero. */
            column.segments.length === 0 ? (
              <Rect
                key={`empty-${column.localDate}-${index}`}
                x={column.x}
                y={chart.plot.y + chart.plot.height - 2}
                width={column.width}
                height={2}
                rx={1}
                fill={theme.chart.empty}
                testID="stacked-empty"
              />
            ) : (
              column.segments.map((segment) => (
                <Rect
                  key={`${segment.key}-${column.localDate}-${index}`}
                  x={segment.x}
                  y={segment.y}
                  width={segment.width}
                  height={segment.height}
                  fill={colorFor(segment.key)}
                  opacity={selected == null || index === selected ? 1 : 0.55}
                  testID={`stacked-segment-${segment.key}`}
                />
              ))
            ),
          )}
        </Svg>

        {chart.columns.map((column, index) => (
          <Pressable
            key={`hit-${index}`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${formatPeriod(column.localDate)}: ${describe(column)}${
              (column.meta as { isCurrent?: boolean } | undefined)?.isCurrent
                ? `, ${currentLabel.toLowerCase()}, still in progress`
                : ''
            }`}
            testID="stacked-column-hit"
            onPress={() => setSelected(index)}
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

      <Text style={[styles.readout, { color: theme.text.secondary }]} testID="stacked-readout">
        {selectedColumn ? (
          selectedColumn.total === 0 ? (
            <>
              <Text style={{ color: theme.text.primary, fontWeight: '700' }}>{emptyLabel}</Text>
              {`  ${formatPeriod(selectedColumn.localDate)}`}
            </>
          ) : (
            <>
              <Text style={{ color: theme.text.primary, fontWeight: '700' }}>
                {formatValue(selectedColumn.total)}
              </Text>
              {`  ${formatPeriod(selectedColumn.localDate)}`}
              {breakdown(selectedColumn).map((part) => (
                <Text key={part.key}>{`  ·  ${labelForKey(part.key)} ${formatValue(part.value)}`}</Text>
              ))}
              {(selectedColumn.meta as { isCurrent?: boolean } | undefined)?.isCurrent ? (
                <Text testID="stacked-current-label">{`  ·  ${currentLabel} · still in progress`}</Text>
              ) : null}
            </>
          )
        ) : (
          'Select a bar to see what you trained that period.'
        )}
      </Text>

      <View style={styles.legend} testID="stacked-legend">
        {chart.keys.map((key) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colorFor(key) }]} />
            <Text style={[styles.legendLabel, { color: theme.text.secondary }]}>
              {labelForKey(key)}
            </Text>
          </View>
        ))}
      </View>

      {disclosure ? (
        <Text
          style={[styles.legendLabel, { color: theme.text.secondary }]}
          testID="stacked-disclosure"
        >
          {disclosure}
        </Text>
      ) : null}

      <View
        accessible
        accessibilityLabel={tableLabel}
        style={styles.visuallyHidden}
        testID="stacked-table"
      />
    </View>
  );
}
