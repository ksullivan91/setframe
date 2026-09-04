import { StyleSheet, Text, View } from 'react-native';
import type { ZoneBand } from '@setframe/domain';
import { heartRateZoneColors } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

/** One column of the chart: its minutes in each zone, 1→5. */
export interface ZoneBucket {
  /** Axis label. Empty for the columns between labelled ones on a long range. */
  label: string;
  minutes: readonly [number, number, number, number, number];
}

export interface HeartRateZoneCardProps {
  /**
   * The columns, oldest first.
   *
   * What one column *is* depends on the range: a day over a week, a week
   * over 30 or 90 days, a month over a year. The card does not divide the
   * window itself — the caller knows the range.
   */
  buckets: readonly ZoneBucket[];
  /** What one column covers, for the caption. Defaults to a week. */
  bucketUnit?: 'day' | 'week' | 'month';
  /** From `zoneBands(model)` — supplies each zone's name and bpm range. */
  bands: readonly ZoneBand[];
  /** Change in active minutes across the window; null with too little data. */
  changeMinutes?: number | null;
  /**
   * Why there is nothing to draw.
   *
   * `no-model` is distinct from `no-data` on purpose: one is "we have not
   * measured you yet", the other is "we could not work out where your zones
   * are". Collapsing them would tell a user with plenty of heart-rate data
   * that they have none.
   */
  unavailable?: 'no-data' | 'no-model';
}

const PLOT_HEIGHT = 110;
/** A bucket with no active minutes still draws a floor tile. */
const ZERO_HEIGHT = 3;
const ZONES = [1, 2, 3, 4, 5] as const;

/**
 * Time spent in each heart-rate zone, week by week.
 *
 * Every other Trends card is one number with a change; this one is five
 * numbers a day, which is a distribution rather than a level. A single
 * stacked bar would summarise the window and show no trend at all, so the
 * chart is one column per week: **height is that week's volume, the bands
 * are how it was spent**. Normalising every column to the same height was
 * tried first and drew four identical bars over data that was not identical.
 *
 * Zone 5 sits at the top of each stack. It is reliably the smallest slice,
 * and at the bottom it disappears under everything above it.
 *
 * Colours are `heartRateZoneColors` — accent 300→900, a sequential
 * single-hue ramp whose lightness falls monotonically, so the ordering
 * survives any colour vision. The card is deliberately on the light surface
 * the ramp was validated against.
 */
export function HeartRateZoneCard({
  buckets,
  bands,
  bucketUnit = 'week',
  changeMinutes = null,
  unavailable,
}: HeartRateZoneCardProps) {
  const theme = useTheme();

  const totals = ZONES.map((zone) =>
    buckets.reduce((sum, bucket) => sum + (bucket.minutes[zone - 1] ?? 0), 0),
  );
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const peak = Math.max(1, ...buckets.map((b) => b.minutes.reduce((a, n) => a + n, 0)));

  const delta =
    changeMinutes == null || changeMinutes === 0
      ? null
      : `${changeMinutes > 0 ? '↑' : '↓'} ${Math.abs(Math.round(changeMinutes))}m`;

  return (
    <View testID="trend-heart-rate-zones" style={[styles.card, { backgroundColor: theme.surface.raised }]}>
      <View style={styles.top}>
        <View style={styles.meta}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>TIME IN ZONES</Text>
          {unavailable ? (
            <Text style={[styles.empty, { color: theme.text.secondary }]}>
              {unavailable === 'no-model' ? 'Zones need a resting heart rate' : 'Nothing recorded yet'}
            </Text>
          ) : (
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: theme.text.primary }]}>
                {grandTotal.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.unit, { color: theme.text.secondary }]}>active min</Text>
            </View>
          )}
        </View>
        {!unavailable && delta ? (
          <Text style={[styles.delta, { color: theme.text.secondary }]}>{delta}</Text>
        ) : null}
      </View>

      {unavailable ? null : (
        <>
          <View style={styles.plot} testID="zone-plot">
            {buckets.map((bucket, index) => (
              <ZoneColumn key={`${bucket.label}-${index}`} bucket={bucket} peak={peak} />
            ))}
          </View>

          <View style={styles.legend}>
            {[...ZONES].reverse().map((zone) => {
              const band = bands.find((b) => b.zone === zone);
              const minutes = totals[zone - 1] ?? 0;
              return (
                <View key={zone} style={styles.legendRow} testID={`zone-legend-${zone}`}>
                  <View style={[styles.swatch, { backgroundColor: heartRateZoneColors[zone] }]} />
                  <View style={styles.legendText}>
                    <Text style={[styles.zoneName, { color: theme.text.primary }]}>
                      Zone {zone}{band ? ` · ${band.label}` : ''}
                    </Text>
                    {band ? (
                      <Text style={[styles.zoneRange, { color: theme.text.secondary }]}>
                        {band.toBpm == null ? `${band.fromBpm}+ bpm` : band.fromBpm === 0 ? `< ${band.toBpm + 1} bpm` : `${band.fromBpm}–${band.toBpm} bpm`}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.legendValue}>
                    <Text style={[styles.zoneMinutes, { color: theme.text.primary }]}>{minutes}m</Text>
                    <Text style={[styles.zonePct, { color: theme.text.secondary }]}>
                      {grandTotal > 0 ? `${Math.round((minutes / grandTotal) * 100)}%` : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.note, { color: theme.text.secondary }]}>
        {unavailable === 'no-model'
          ? 'Your Watch records one after a few days of wear. Until then, splitting your minutes would be a guess.'
          : unavailable === 'no-data'
            ? 'Needs heart rate during activity. An Apple Watch records it; a phone on its own does not.'
            : `Active minutes only. Column height is that ${bucketUnit}’s volume; the bands are how it was spent.`}
      </Text>
    </View>
  );
}

function ZoneColumn({ bucket, peak }: { bucket: ZoneBucket; peak: number }) {
  const theme = useTheme();
  const total = bucket.minutes.reduce((a, b) => a + b, 0);
  const height = total > 0 ? Math.max(4, Math.round((total / peak) * PLOT_HEIGHT)) : ZERO_HEIGHT;

  return (
    <View style={styles.column}>
      {/* The plot area is a fixed box with the stack sitting on its floor.
          Letting the column hug its content left every bucket a different
          height, so a rest day's label dropped below its neighbours'. */}
      <View style={styles.plotSlot}>
        <View style={[styles.stack, { height }]}>
          {total === 0 ? (
            /* A day with no active minutes is a reading, not a gap. Drawn as
               a floor tile so a rest day is visibly zero rather than
               missing — the two mean different things and a blank column
               says neither. */
            <View style={{ flex: 1, backgroundColor: theme.border.default }} />
          ) : (
            [...ZONES].reverse().map((zone) => {
              const minutes = bucket.minutes[zone - 1] ?? 0;
              if (minutes <= 0) return null;
              return (
                <View
                  key={zone}
                  style={{
                    height: Math.max(2, Math.round((minutes / Math.max(total, 1)) * height)),
                    backgroundColor: heartRateZoneColors[zone],
                  }}
                />
              );
            })
          )}
        </View>
      </View>
      <Text style={[styles.columnLabel, { color: theme.text.secondary }]} numberOfLines={1}>
        {bucket.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.small, padding: spacing[16], gap: spacing[12] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[8] },
  meta: { flex: 1, gap: spacing[4] },
  label: { fontSize: typeScale.label.fontSize },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[4] },
  value: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  unit: { fontSize: typeScale.label.fontSize },
  empty: { fontSize: typeScale.compactBody.fontSize },
  delta: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4] },
  column: { flex: 1, gap: 3 },
  /* Fixed height, contents on the floor: every column's label lines up. */
  plotSlot: { height: PLOT_HEIGHT, justifyContent: 'flex-end' },
  /* Clipped so the rounded corners cut the stack, not each segment — five
     rounded blocks read as five bars rather than one column. */
  stack: { borderRadius: 3, overflow: 'hidden' },
  columnLabel: { fontSize: typeScale.caption.fontSize, textAlign: 'center' },
  legend: { gap: spacing[8], paddingTop: spacing[4] },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { flex: 1, gap: 1 },
  zoneName: { fontSize: typeScale.compactBody.fontSize, fontWeight: '500' },
  zoneRange: { fontSize: typeScale.caption.fontSize },
  legendValue: { alignItems: 'flex-end', gap: 1 },
  zoneMinutes: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  zonePct: { fontSize: typeScale.caption.fontSize },
  note: { fontSize: typeScale.caption.fontSize, lineHeight: 14 },
});
