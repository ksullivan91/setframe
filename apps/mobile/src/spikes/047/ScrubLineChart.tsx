/**
 * Story 47 spike — native scrub prototype. NOT production code and imported
 * by no screen; it exists so the spike's "real web + native prototypes"
 * acceptance criterion is met with something actually executable rather
 * than an assertion about a README.
 *
 * It answers one question: can a continuous scrub be driven over the shared
 * `@setframe/domain` geometry on React Native, using dependencies the app
 * already has (`react-native-svg`, `react-native-gesture-handler`), with the
 * same stationary-readout interaction the web prototype demonstrates?
 *
 * The structural rule carried over from the web prototype (see
 * docs/spikes/047-charting/README.md): the plot is built once and only the
 * selection layer changes while scrubbing. On web, re-rendering during a
 * drag destroys the element holding pointer capture and kills the gesture
 * after one frame. The native equivalent is that the gesture must own the
 * selection index and nothing above it may remount the chart mid-drag.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { buildLineChart, type SeriesPoint } from '@setframe/domain';

const WIDTH = 340;
const HEIGHT = 200;

export interface ScrubLineChartProps {
  series: SeriesPoint[];
  formatValue?: (value: number) => string;
  /** Test seam: lets a render-level test drive selection without a real gesture. */
  onSelectIndex?: (index: number | null) => void;
  testID?: string;
}

export function ScrubLineChart({
  series,
  formatValue = (v) => `${v.toFixed(1)} lb`,
  onSelectIndex,
  testID = 'scrub-line-chart',
}: ScrubLineChartProps) {
  const [selected, setSelected] = useState<number | null>(null);

  // Geometry is computed once per series — identical call to production's.
  const chart = useMemo(
    () =>
      buildLineChart(series, {
        layout: { width: WIDTH, height: HEIGHT, padding: { top: 12, right: 12, bottom: 24, left: 44 } },
        zeroBased: false,
        minimumSpan: 4,
        formatValue: (v) => `${Math.round(v)}`,
      }),
    [series],
  );

  const points = chart.points;

  function selectNearest(x: number) {
    if (!points.length) return;
    let best = points[0]!;
    let bestDistance = Math.abs(best.x - x);
    for (const point of points) {
      const distance = Math.abs(point.x - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
    if (best.index !== selected) {
      setSelected(best.index);
      onSelectIndex?.(best.index);
    }
  }

  // A pan gesture with a zero activation distance behaves as scrub: it
  // begins on touch-down and tracks continuously, which is what the
  // stationary-readout interaction needs. `.runOnJS(true)` keeps the
  // handler on the JS thread so it can call setState directly — adequate
  // for ~100 points; a Reanimated shared value would be the optimisation
  // if a real device shows jank, and that is exactly what Story 48 should
  // measure on hardware.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .runOnJS(true)
        .onBegin((event) => selectNearest(event.x))
        .onUpdate((event) => selectNearest(event.x)),

    [points, selected],
  );

  const selectedPoint = selected != null ? points.find((p) => p.index === selected) : null;
  const shown = selectedPoint ?? points[points.length - 1] ?? null;

  return (
    <View testID={testID}>
      {/* Stationary readout — values change, layout never moves. */}
      <View style={styles.readout}>
        <Text testID="scrub-value" style={styles.value}>
          {shown ? formatValue(shown.value) : '—'}
        </Text>
        <Text testID="scrub-date" style={styles.label}>
          {shown ? shown.localDate : 'no data'}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View testID="scrub-surface">
          <Svg width={WIDTH} height={HEIGHT} accessibilityLabel="Body weight">
            {chart.ticks.map((tick) => (
              <Line
                key={tick.value}
                x1={chart.plot.x}
                x2={chart.plot.x + chart.plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke="#E4E4E7"
              />
            ))}
            {chart.path ? <Path d={chart.path} fill="none" stroke="#7C5CFF" strokeWidth={1.5} opacity={0.55} /> : null}
            {points.map((point) => (
              <Circle
                key={`${point.localDate}-${point.index}`}
                cx={point.x}
                cy={point.y}
                r={2.5}
                fill="#7C5CFF"
                opacity={0.7}
              />
            ))}
            {selectedPoint ? (
              <>
                <Line
                  testID="scrub-crosshair"
                  x1={selectedPoint.x}
                  x2={selectedPoint.x}
                  y1={chart.plot.y}
                  y2={chart.plot.y + chart.plot.height}
                  stroke="#5B3FD9"
                  opacity={0.35}
                />
                <Circle
                  testID="scrub-selected-dot"
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r={5}
                  fill="#5B3FD9"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              </>
            ) : null}
          </Svg>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 46, marginBottom: 8 },
  value: { fontSize: 28, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#52525B' },
});
