import { View, Text, StyleSheet, Alert } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { radius, spacing } from '@setframe/design-tokens';
import type { SessionWatchWorkout } from '@setframe/schemas';
import { Card } from '../Card';
import { IconButton } from '../IconButton';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';

/**
 * "Activity" — the rolled-up figures for every attached workout.
 *
 * Titled for what it holds, not where it came from. The device name sits
 * top-right and carries the provenance, so the heading does not have to —
 * and it stops being a lie the day these figures arrive from something
 * that is not an Apple Watch.
 *
 * Figma `265:2 › WatchSummary` for the tiles, `229:67 · Attached
 * collection` for the list beneath them. The totals are the headline the
 * collection buys; the rows exist so an accidental attachment can be
 * removed, which needs something to hang the control off.
 */
export function WatchSummaryCard({
  workouts,
  onRemove,
  removingId,
}: {
  workouts: readonly SessionWatchWorkout[];
  /** Detaches one workout. Same confirm-then-delete shape as Today. */
  onRemove?: (id: string) => void;
  removingId?: string | null;
}) {
  const theme = useTheme();
  if (workouts.length === 0) return null;

  const sum = (pick: (w: SessionWatchWorkout) => number | null) =>
    workouts.reduce((total, w) => total + (pick(w) ?? 0), 0);

  const activeKcal = Math.round(sum((w) => w.activeEnergyKcal));

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
  /* Three tiles, not four.
     There is no "Total cal" here because HealthKit does not give one:
     `HKWorkout.totalEnergyBurned` is the ACTIVE energy, which is what
     `activeEnergyKcal` already holds. A true total is active + basal, and
     basal is a separate query over the workout's window — a second read
     and a second permission for a number nobody asked to see. Four tiles
     also wrapped every label onto two lines at 390pt. */
  const tiles: [string, string][] = [
    ['Active cal', activeKcal > 0 ? String(activeKcal) : '—'],
    ['Avg HR', avgHr != null ? String(avgHr) : '—'],
    ['Peak HR', peakHr != null ? String(peakHr) : '—'],
  ];

  return (
    <Card style={styles.card} testID="watch-summary">
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Activity</Text>
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
            <Text
              numberOfLines={1}
              style={[styles.tileValue, { color: theme.text.primary }]}
            >
              {value}
            </Text>
            {/* One line, always. A wrapped label makes its tile taller than
                the others and the row stops reading as a row — which is
                what four tiles did at 390pt. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.tileLabel, { color: theme.text.secondary }]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      {/* One row per attached workout, so a mis-attached walk can be taken
          back off. Only worth the space when removal is possible — with no
          handler the single summary line still says it better. */}
      {onRemove ? (
        <View style={styles.rows}>
          {workouts.map((w) => (
            <View
              key={w.id}
              testID={`watch-attached-${w.id}`}
              style={[styles.row, { backgroundColor: theme.surface.sunken }]}
            >
              <View style={styles.rowMeta}>
                <Text
                  numberOfLines={1}
                  style={[styles.rowTitle, { color: theme.text.primary }]}
                >
                  {w.title}
                </Text>
                <Text style={[styles.rowDetail, { color: theme.text.secondary }]}>
                  {rowDetail(w)}
                </Text>
              </View>
              {/* Same control as a logged activity on Today: a subtle trash,
                  and a confirm before anything goes. */}
              <IconButton
                icon={Trash2}
                size={28}
                variant="subtle"
                disabled={removingId === w.id}
                accessibilityLabel={`Remove ${w.title}`}
                onPress={() =>
                  Alert.alert(`Remove ${w.title}?`, 'This detaches it from this session.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onRemove(w.id) },
                  ])
                }
              />
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.note, { color: theme.text.secondary }]}>{describe(workouts)}</Text>
    </Card>
  );
}

/** "5:32 PM · 1h 04m · 142 avg" — enough to tell two apart before removing one. */
function rowDetail(w: SessionWatchWorkout): string {
  const minutes = Math.round(w.durationSeconds / 60);
  return [
    new Date(w.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
      : `${minutes} min`,
    w.avgHeartRateBpm != null ? `${w.avgHeartRateBpm} avg` : null,
  ]
    .filter(Boolean)
    .join(' · ');
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
    /* Equal widths regardless of content: without a zero basis a long
       value ("1,284") makes its tile wider than its neighbours. */
    flexBasis: 0,
    minWidth: 0,
    borderRadius: radius.small,
    // Symmetric. The old left/right pair differed by 2pt, which read as
    // the text sitting slightly off-centre in every tile.
    paddingVertical: spacing[8] + 2,
    paddingHorizontal: spacing[8] + 2,
    gap: 2,
  },
  tileValue: { fontSize: 17, fontWeight: '600' },
  tileLabel: { fontSize: 10 },

  note: { fontSize: typeScale.caption.fontSize, lineHeight: 15 },
  rows: { gap: spacing[8] - 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    borderRadius: radius.small,
    paddingVertical: spacing[8],
    paddingLeft: spacing[12],
    paddingRight: spacing[8],
  },
  rowMeta: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontSize: 13, fontWeight: '600' },
  rowDetail: { fontSize: 11 },
});
