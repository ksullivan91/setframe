import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { radius, spacing } from '@setframe/design-tokens';
import { Card } from '../Card';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';
import type { AttachCandidate } from '../../healthkit/useSessionWatchWorkouts';

/**
 * "Your Watch recorded N workouts" — the offer at finish.
 * Figma `Watch-Live 2 · Found at finish`.
 *
 * Detect, suggest, confirm. Nothing is attached silently, which is the
 * story's own rule and the reason the Watch's record of your own lift is
 * offered rather than assumed.
 */
export function WatchAttachCard({
  candidates,
  onAttach,
  onAttachAll,
  pendingId,
  busy,
}: {
  candidates: readonly AttachCandidate[];
  onAttach: (candidate: AttachCandidate) => void;
  onAttachAll: () => void;
  pendingId?: string | null;
  busy?: boolean;
}) {
  const theme = useTheme();
  if (candidates.length === 0) return null;

  return (
    <Card style={styles.card} testID="watch-attach">
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {candidates.length === 1
          ? 'Your Watch recorded a workout'
          : `Your Watch recorded ${candidates.length} workouts`}
      </Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        They overlap this session or follow it closely. Attach the ones that were part of it.
      </Text>

      {candidates.map(({ workout, relation }) => (
        <View
          key={workout.externalId}
          testID={`attach-candidate-${workout.externalId}`}
          style={[styles.candidate, { backgroundColor: tint(theme.status.info, 0.08) }]}
        >
          <View style={styles.candidateHead}>
            <View style={styles.candidateMeta}>
              <Text style={[styles.candidateTitle, { color: theme.text.primary }]} numberOfLines={1}>
                {workout.title}
              </Text>
              <Text style={[styles.candidateDetail, { color: theme.text.secondary }]}>
                {describe(workout)}
              </Text>
            </View>
            {/* Says how it relates to the session rather than just that it
                exists — "After" is the difference between the lift and the
                walk home, and the user is the one who knows which counts. */}
            <View style={[styles.badge, { backgroundColor: tint(theme.status.info, 0.14) }]}>
              <Text style={[styles.badgeLabel, { color: theme.text.secondary }]}>
                {relation === 'overlaps' ? 'Overlaps' : 'After'}
              </Text>
            </View>
          </View>
          <Pressable
            testID={`attach-one-${workout.externalId}`}
            accessibilityRole="button"
            accessibilityLabel={`Attach ${workout.title}`}
            disabled={busy}
            onPress={() => onAttach({ workout, relation })}
            style={({ pressed }) => [
              styles.attachOne,
              {
                backgroundColor: theme.surface.raised,
                opacity: pressed || busy ? 0.85 : 1,
              },
            ]}
          >
            {pendingId === workout.externalId ? (
              <ActivityIndicator color={theme.action.primary} />
            ) : (
              <Text style={[styles.attachOneLabel, { color: theme.action.primary }]}>Attach</Text>
            )}
          </Pressable>
        </View>
      ))}

      {candidates.length > 1 ? (
        <Pressable
          testID="attach-all"
          accessibilityRole="button"
          accessibilityLabel={`Attach all ${candidates.length}`}
          disabled={busy}
          onPress={onAttachAll}
          style={({ pressed }) => [
            styles.attachAll,
            { backgroundColor: theme.action.primary, opacity: pressed || busy ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.attachAllLabel, { color: theme.action.primaryText }]}>
            Attach all {candidates.length}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function describe(workout: AttachCandidate['workout']): string {
  const minutes = Math.round(workout.durationSeconds / 60);
  return [
    new Date(workout.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes} min`,
    workout.distanceValue != null ? `${workout.distanceValue} ${workout.distanceUnit ?? 'mi'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A token colour at partial strength; `status.info` has no subtle step. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1]!, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: { gap: spacing[12] },
  title: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  body: { fontSize: typeScale.helper.fontSize, lineHeight: 17 },
  candidate: { borderRadius: radius.small, padding: spacing[12], gap: spacing[8] },
  candidateHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
  candidateMeta: { flexShrink: 1, gap: 2 },
  candidateTitle: { fontSize: 13, fontWeight: '600' },
  candidateDetail: { fontSize: 11 },
  badge: { borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: spacing[8] },
  badgeLabel: { fontSize: 9, fontWeight: '500' },
  attachOne: { height: 36, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  attachOneLabel: { fontSize: 13, fontWeight: '600' },
  attachAll: { height: 44, borderRadius: radius.small, alignItems: 'center', justifyContent: 'center' },
  attachAllLabel: { fontSize: typeScale.button.fontSize, fontWeight: '600' },
});
