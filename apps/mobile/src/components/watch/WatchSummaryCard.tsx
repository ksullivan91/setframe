import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing } from '@setframe/design-tokens';
import type { SessionWatchWorkout } from '@setframe/schemas';
import { Card } from '../Card';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/**
 * "From your Watch" — the rolled-up figures for every attached workout.
 *
 * Figma `265:2 › WatchSummary`. Four tiles, because the block's totals are
 * the headline the collection buys; the individual workouts are named
 * underneath rather than listed, since a session usually has one.
 */
export function WatchSummaryCard({ workouts }: { workouts: readonly SessionWatchWorkout[] }) {
  const theme = useTheme();
  if (workouts.length === 0) return null;

  const sum = (pick: (w: SessionWatchWorkout) => number | null) =>
    workouts.reduce((total, w) => total + (pick(w) ?? 0), 0);

  const activeKcal = Math.round(sum((w) => w.activeEnergyKcal));
  const totalKcal = Math.round(sum((w) => w.totalEnergyKcal));

  /* Averaged by DURATION, not by workout. A 4-minute walk and a 64-minute
     lift are not two equal opinions about the session's heart rate. */
  const weighted = workouts.filter((w) => w.avgHeartRateBpm != null && w.durationSeconds > 0);
  const weightedSeconds = weighted.reduce((n, w) => n + w.durationSeconds, 0);
  const avgHr =
    weightedSeconds > 0
      ? Math.round(
          weighted.reduce((n, w) => n + (w.avgHeartRateBpm ?? 0) * w.durationSeconds, 0) /
            weightedSeconds,
        )
      : null;
  const peakHr = workouts.reduce<number | null>(
    (best, w) => (w.peakHeartRateBpm != null && (best == null || w.peakHeartRateBpm > best) ? w.peakHeartRateBpm : best),
    null,
  );

  const device = workouts.find((w) => w.deviceName)?.deviceName ?? null;
  const tiles: [string, string][] = [
    ['Active kcal', activeKcal > 0 ? String(activeKcal) : '—'],
    ['Total kcal', totalKcal > 0 ? String(totalKcal) : '—'],
    ['Avg HR', avgHr != null ? String(avgHr) : '—'],
    ['Peak HR', peakHr != null ? String(peakHr) : '—'],
  ];

  return (
    <Card style={styles.card} testID="watch-summary">
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text.primary }]}>From your Watch</Text>
        {device ? (
          <Text style={[styles.device, { color: theme.text.secondary }]}>{device}</Text>
        ) : null}
      </View>
      <View style={styles.tiles}>
        {tiles.map(([label, value]) => (
          <View
            key={label}
            testID={`watch-tile-${label}`}
            style={[styles.tile, { backgroundColor: theme.surface.sunken }]}
          >
            <Text style={[styles.tileValue, { color: theme.text.primary }]}>{value}</Text>
            <Text style={[styles.tileLabel, { color: theme.text.secondary }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, { color: theme.text.secondary }]}>{describe(workouts)}</Text>
    </Card>
  );
}

/** "Traditional Strength Training · 1h 04m, attached to this session." */
function describe(workouts: readonly SessionWatchWorkout[]): string {
  if (workouts.length === 1) {
    const only = workouts[0]!;
    return `${only.title} · ${formatDuration(only.durationSeconds)}, attached to this session.`;
  }
  const total = workouts.reduce((n, w) => n + w.durationSeconds, 0);
  return `${workouts.length} workouts · ${formatDuration(total)}, attached to this session.`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

const styles = StyleSheet.create({
  card: { gap: spacing[8] + 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  device: { fontSize: typeScale.caption.fontSize },
  tiles: { flexDirection: 'row', gap: spacing[8] },
  tile: {
    flex: 1,
    borderRadius: radius.small,
    paddingTop: spacing[8] + 2,
    paddingBottom: spacing[8] + 2,
    paddingLeft: spacing[8] + 2,
    paddingRight: spacing[8],
    gap: 2,
  },
  tileValue: { fontSize: 17, fontWeight: '600' },
  tileLabel: { fontSize: 10 },
  note: { fontSize: typeScale.caption.fontSize, lineHeight: 15 },
});
