import { StyleSheet, Text, View } from 'react-native';
import type { TrendSeries } from '@setframe/schemas';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius, typeScale } from '../../theme/getTheme';

export interface TrendMetricCardProps {
  label: string;
  unit: string;
  series: TrendSeries;
  /** Whether a fall is an improvement — true for weight and resting HR. */
  lowerIsBetter?: boolean;
  format?: (value: number) => string;
}

export function TrendMetricCard({
  label,
  unit,
  series,
  lowerIsBetter = false,
  format = (v) => String(Math.round(v * 10) / 10),
}: TrendMetricCardProps) {
  const theme = useTheme();
  const { latest, change } = series;

  const improving = change == null ? null : lowerIsBetter ? change < 0 : change > 0;
  const deltaLabel =
    change == null
      ? null
      : change === 0
        ? '→'
        : `${change > 0 ? '↑' : '↓'} ${format(Math.abs(change))}`;

  return (
    <View testID={`trend-${series.key}`} style={[styles.card, { backgroundColor: theme.surface.raised }]}>
      <View style={styles.top}>
        <View style={styles.meta}>
          <Text style={[styles.label, { color: theme.text.secondary }]}>{label}</Text>
          {latest == null ? (
            <Text style={[styles.empty, { color: theme.text.secondary }]}>Nothing recorded yet</Text>
          ) : (
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: theme.text.primary }]}>{format(latest)}</Text>
              <Text style={[styles.unit, { color: theme.text.secondary }]}>{unit}</Text>
            </View>
          )}
        </View>
        {deltaLabel ? (
          <Text
            style={[
              styles.delta,
              /* status.success is 2.26:1 on white — a fill colour, not a text
                 one. The direction is in the arrow, so the colour is only ever
                 reinforcement. */
              { color: improving ? theme.status.successText : theme.text.secondary },
            ]}
          >
            {deltaLabel}
          </Text>
        ) : null}
      </View>
      <Sparkline series={series} />
    </View>
  );
}

/**
 * A bare min/max band rather than a plotted line.
 *
 * Real geometry belongs in `packages/domain`'s chart-geometry, which the
 * Progress charts already use; wiring it here needs a width measurement
 * this card does not take yet. Showing the range is honest about what it
 * is — a summary — where a hand-drawn curve would imply precision it does
 * not have.
 */
function Sparkline({ series }: { series: TrendSeries }) {
  const theme = useTheme();
  if (series.points.length < 2) return null;
  const values = series.points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return (
    <View style={styles.range}>
      <Text style={[styles.rangeLabel, { color: theme.text.secondary }]}>
        {Math.round(low * 10) / 10} – {Math.round(high * 10) / 10}
      </Text>
      <View style={[styles.track, { backgroundColor: theme.surface.sunken }]} />
      <Text style={[styles.rangeLabel, { color: theme.text.secondary }]}>
        {series.points.length} readings
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.small, padding: spacing[16], gap: spacing[12] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { gap: spacing[4] },
  label: { fontSize: typeScale.label.fontSize },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[4] },
  value: { fontSize: typeScale.pageTitle.fontSize, fontWeight: '600' },
  unit: { fontSize: typeScale.label.fontSize },
  empty: { fontSize: typeScale.label.fontSize },
  delta: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  range: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  rangeLabel: { fontSize: typeScale.caption.fontSize },
  track: { flex: 1, height: 4, borderRadius: 999 },
});
