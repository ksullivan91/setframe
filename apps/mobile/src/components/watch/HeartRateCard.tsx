import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  heartRateChart,
  heartRateZoneColors,
  radius,
  spacing,
} from '@setframe/design-tokens';
import {
  summariseSeries,
  timeInZone,
  zoneBands,
  zoneOf,
  type HeartRateSeries,
  type ZoneModel,
} from '@setframe/domain';
import { Card } from '../Card';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/**
 * The heart-rate chart and time in zone. Figma `265:2 › HeartRateCard`.
 *
 * **Stays light while the rest of the logger went dark (build 23).** The zone
 * ramp is accent 300 → 900, chosen because its lightness falls monotonically
 * so the ordering survives any colour vision — 192 candidate ramps were
 * tested to arrive at it. On a dark ground that ramp inverts: zone 5 is the
 * darkest step and all but disappears, in the bars and in the legend
 * swatches alike. Re-deriving and re-validating a dark-ground ramp is real
 * work with real accessibility stakes, so this card keeps the ground its
 * colours were validated against rather than having the ramp flipped by
 * hand. See docs/design/workout-logger-v2-audit.md §2.8.
 *
 * Bars are coloured by zone from a sequential single-hue ramp — see
 * `heartRateZoneColors` for why not a rainbow. Colour is redundant with
 * height here by design: the zone IS the bar's height, so a reader who
 * perceives no hue still reads the chart.
 */
export interface HeartRateCardProps {
  series: HeartRateSeries;
  model: ZoneModel;
  startedAt: string;
  endedAt: string;
  /** The scrubbed sample, or null for the resting summary. */
  selectedIndex?: number | null;
  onSelect?: (index: number | null) => void;
  /** Set when the max is estimated rather than observed, for the footnote. */
  maxIsEstimated?: boolean;
  /**
   * The workout's own average/peak, as HealthKit reported them.
   *
   * These must win over anything derived from `series`: HealthKit averages
   * every sample the Watch took, while `series` is the downsampled copy we
   * store, so the two disagree by a few bpm. `WatchSummaryCard` sits
   * directly above this one showing the HealthKit numbers — recomputing
   * here would put two different "avg HR" on one screen. Falls back to the
   * series when the workout carries no statistic.
   */
  avgBpm?: number | null;
  peakBpm?: number | null;
}

const BAR_COUNT = 25;

export function HeartRateCard({
  series,
  model,
  startedAt,
  endedAt,
  selectedIndex = null,
  onSelect,
  maxIsEstimated = true,
  avgBpm = null,
  peakBpm = null,
}: HeartRateCardProps) {
  const theme = useTheme();
  const bands = useMemo(() => zoneBands(model), [model]);
  const summary = useMemo(() => summariseSeries(series), [series]);
  const zones = useMemo(() => timeInZone(series, bands), [series, bands]);

  /* The stored series is one sample every few seconds — hundreds of them,
     far more than 326pt can show. Bucketed to a fixed number of bars, each
     taking the bucket's PEAK rather than its mean: a mean flattens the
     sawtooth of sets and rests into a plateau, which is the shape the chart
     exists to show. */
  const bars = useMemo(() => {
    if (series.values.length === 0) return [];
    const bucketSize = Math.max(1, Math.ceil(series.values.length / BAR_COUNT));
    const out: { bpm: number; index: number }[] = [];
    for (let i = 0; i < series.values.length; i += bucketSize) {
      let peak = 0;
      for (let j = i; j < Math.min(i + bucketSize, series.values.length); j += 1) {
        peak = Math.max(peak, series.values[j] ?? 0);
      }
      if (peak > 0) out.push({ bpm: peak, index: i });
    }
    return out;
  }, [series]);

  if (bars.length === 0 || bands.length === 0) return null;

  const floor = Math.min(...bars.map((b) => b.bpm));
  const ceiling = Math.max(...bars.map((b) => b.bpm));
  const span = Math.max(1, ceiling - floor);
  const { maxBarHeight, minBarHeight } = heartRateChart;

  const selected = selectedIndex != null ? bars[selectedIndex] : null;
  const selectedZone = selected ? zoneOf(selected.bpm, bands) : null;
  const readout = selected
    ? `${formatClock(startedAt, series, selected.index)} · ${selected.bpm} bpm · Zone ${selectedZone?.zone ?? '—'}`
    : `${avgBpm ?? summary.avgBpm ?? '—'} avg · ${peakBpm ?? summary.peakBpm ?? '—'} peak`;

  return (
    <Card style={styles.card} testID="heart-rate-card">
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Heart rate</Text>
        <Text
          testID="heart-rate-readout"
          style={[styles.summary, { color: selected ? theme.text.primary : theme.text.secondary }]}
        >
          {readout}
        </Text>
      </View>

      <View style={[styles.plot, { backgroundColor: theme.surface.sunken }]} testID="heart-rate-plot">
        {bars.map((bar, i) => {
          const band = zoneOf(bar.bpm, bands);
          const height = minBarHeight + ((bar.bpm - floor) / span) * (maxBarHeight - minBarHeight);
          const dimmed = selectedIndex != null && i !== selectedIndex;
          return (
            <Pressable
              key={bar.index}
              testID={`heart-rate-bar-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${bar.bpm} beats per minute, zone ${band?.zone ?? ''}`}
              onPress={() => onSelect?.(selectedIndex === i ? null : i)}
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: heartRateZoneColors[band?.zone ?? 1],
                  opacity: dimmed ? 0.32 : 1,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.axis}>
        <Text style={[styles.axisLabel, { color: theme.text.secondary }]}>{formatTime(startedAt)}</Text>
        <Text style={[styles.axisLabel, { color: theme.text.secondary }]}>{formatTime(endedAt)}</Text>
      </View>

      <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>TIME IN ZONE</Text>
      {[...zones].reverse().map((zone) => (
        <View key={zone.zone} testID={`zone-row-${zone.zone}`} style={styles.zoneRow}>
          <View style={[styles.swatch, { backgroundColor: heartRateZoneColors[zone.zone] }]} />
          <Text style={[styles.zoneName, { color: theme.text.primary }]}>Zone {zone.zone}</Text>
          <Text style={[styles.zoneLabel, { color: theme.text.secondary }]}>{zone.label}</Text>
          <Text style={[styles.zoneRange, { color: theme.text.secondary }]}>
            {zone.toBpm == null
              ? `${zone.fromBpm}+ bpm`
              : zone.zone === 1
                ? `< ${zone.toBpm + 1} bpm`
                : `${zone.fromBpm}–${zone.toBpm} bpm`}
          </Text>
          <Text style={[styles.zoneTime, { color: theme.text.primary }]}>
            {formatMinutes(zone.seconds)}
          </Text>
        </View>
      ))}

      <Text style={[styles.note, { color: theme.text.secondary }]}>
        Zones from your heart-rate reserve — resting {model.restingBpm}, max {model.maxBpm}
        {maxIsEstimated ? ' estimated from age' : ' from your own history'}. Change the model and
        every past session re-labels.
      </Text>
    </Card>
  );
}

function formatTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatClock(startedAt: string, series: HeartRateSeries, index: number): string {
  const start = new Date(startedAt).getTime();
  const offset = series.offsets[index] ?? 0;
  return formatTime(new Date(start + offset * 1000).toISOString());
}

/** "26:05" — minutes and seconds, since a zone rarely reaches an hour. */
function formatMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing[12] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
  title: { fontSize: 16, fontWeight: '600' },
  summary: { fontSize: typeScale.helper.fontSize },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: heartRateChart.barGap,
    height: heartRateChart.plotHeight,
    borderRadius: radius.small,
    padding: heartRateChart.plotPadding,
  },
  bar: { flex: 1, borderRadius: heartRateChart.barRadius },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: 10 },
  eyebrow: { fontSize: 10, fontWeight: '500', letterSpacing: 0.8 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: heartRateChart.zoneRow.gap },
  swatch: {
    width: heartRateChart.zoneRow.swatch,
    height: heartRateChart.zoneRow.swatch,
    borderRadius: radius.full,
  },
  zoneName: { width: heartRateChart.zoneRow.nameWidth, fontSize: 12, fontWeight: '600' },
  zoneLabel: { width: heartRateChart.zoneRow.labelWidth, fontSize: 11 },
  zoneRange: { width: heartRateChart.zoneRow.rangeWidth, fontSize: 11 },
  zoneTime: { width: heartRateChart.zoneRow.timeWidth, fontSize: 12, fontWeight: '600' },
  note: { fontSize: 11, lineHeight: 15 },
});
