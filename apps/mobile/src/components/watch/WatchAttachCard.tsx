import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { radius, spacing } from '@setframe/design-tokens';
import { Card } from '../Card';
import { useTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/getTheme';
import type { AttachCandidate } from '../../healthkit/useSessionWatchWorkouts';

/**
 * "Your Watch recorded N workouts" — the offer at finish.
 * Figma `Watch-Live 2 · Found at finish` (229:21).
 *
 * Detect, suggest, confirm. Nothing is attached silently, which is the
 * story's own rule and the reason the Watch's record of your own lift is
 * offered rather than assumed.
 *
 * The design gives the card two buttons, not one per tile: attach-all is
 * the one tap that serves the common case, and Choose exists because a
 * Watch workout inside your session might genuinely be someone else's data
 * on a shared device, or a stray auto-detected walk (Figma 230:56). Choose
 * turns the tiles into a selection; that interaction is not itself drawn,
 * so it follows the platform convention — tap to toggle, confirm with a
 * count, Cancel to back out.
 */
export function WatchAttachCard({
  candidates,
  onAttach,
  onAttachAll,
  onDismiss,
  pendingId,
  busy,
}: {
  candidates: readonly AttachCandidate[];
  onAttach: (candidate: AttachCandidate) => void;
  onAttachAll: () => void;
  /** Waves one candidate off for the day. Same treatment as Today. */
  onDismiss?: (externalId: string) => void;
  pendingId?: string | null;
  busy?: boolean;
}) {
  const theme = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<readonly string[]>([]);

  const chosen = useMemo(
    () => candidates.filter((c) => picked.includes(c.workout.externalId)),
    [candidates, picked],
  );

  if (candidates.length === 0) return null;

  /* Choosing among one is not a choice, so a lone candidate gets the single
     button the offer actually means. */
  const single = candidates.length === 1;

  const toggle = (externalId: string) =>
    setPicked((prev) =>
      prev.includes(externalId) ? prev.filter((id) => id !== externalId) : [...prev, externalId],
    );

  const leave = () => {
    setChoosing(false);
    setPicked([]);
  };

  return (
    <Card style={styles.card} testID="watch-attach">
      <Text style={[styles.title, { color: theme.text.primary }]}>
        {single
          ? 'Your Watch recorded a workout'
          : `Your Watch recorded ${candidates.length} workouts`}
      </Text>
      <Text style={[styles.body, { color: theme.text.secondary }]}>
        {choosing
          ? 'Pick the ones that were part of this session.'
          : 'They overlap this session or follow it closely. Attach the ones that were part of it.'}
      </Text>

      {candidates.map(({ workout, relation }) => {
        const selected = picked.includes(workout.externalId);
        const tile = (
          <>
            <View style={styles.candidateHead}>
              <View style={styles.candidateMeta}>
                <Text
                  style={[styles.candidateTitle, { color: theme.text.primary }]}
                  numberOfLines={1}
                >
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
                  {choosing ? (selected ? 'Selected' : 'Tap to pick')
                  : relation === 'overlaps' ? 'Overlaps'
                  : 'After'}
                </Text>
              </View>
            </View>
            {/* What you would be attaching, so the decision is informed
                rather than a guess from the title. Absent for a workout the
                Watch recorded no heart rate for. */}
            <View style={styles.metrics}>
              {metrics(workout).map((metric) => (
                <Text key={metric} style={[styles.metric, { color: theme.text.disabled }]}>
                  {metric}
                </Text>
              ))}
            </View>
            {/* Same treatment as Today's suggestion: a subtle Dismiss beside
                the offer, never a destructive-looking one — this removes
                nothing, it only stops us asking again today. Hidden while
                choosing, where tapping the tile means "pick", not "go". */}
            {onDismiss && !choosing ? (
              <Pressable
                testID={`attach-dismiss-${workout.externalId}`}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss ${workout.title}`}
                disabled={busy}
                onPress={() => onDismiss(workout.externalId)}
                style={({ pressed }) => [
                  styles.dismiss,
                  { backgroundColor: theme.surface.raised, opacity: pressed || busy ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.dismissLabel, { color: theme.text.secondary }]}>Dismiss</Text>
              </Pressable>
            ) : null}
          </>
        );

        const background =
          selected ? tint(theme.status.info, 0.16) : tint(theme.status.info, 0.08);

        return choosing ? (
          <Pressable
            key={workout.externalId}
            testID={`attach-candidate-${workout.externalId}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={workout.title}
            onPress={() => toggle(workout.externalId)}
            style={({ pressed }) => [
              styles.candidate,
              {
                backgroundColor: background,
                borderColor: selected ? theme.action.primary : 'transparent',
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {tile}
          </Pressable>
        ) : (
          <View
            key={workout.externalId}
            testID={`attach-candidate-${workout.externalId}`}
            style={[styles.candidate, { backgroundColor: background, borderColor: 'transparent' }]}
          >
            {tile}
          </View>
        );
      })}

      <View style={styles.actions}>
        {single ? (
          <Action
            testID="attach-all"
            label="Attach"
            tone="primary"
            busy={busy || pendingId != null}
            disabled={busy}
            onPress={() => onAttach(candidates[0]!)}
          />
        ) : choosing ? (
          <>
            <Action
              testID="attach-chosen"
              label={chosen.length === 0 ? 'Attach' : `Attach ${chosen.length}`}
              tone="primary"
              busy={busy}
              disabled={busy || chosen.length === 0}
              onPress={() => {
                chosen.forEach(onAttach);
                leave();
              }}
            />
            <Action
              testID="attach-cancel"
              label="Cancel"
              tone="secondary"
              disabled={busy}
              onPress={leave}
            />
          </>
        ) : (
          <>
            <Action
              testID="attach-all"
              label={`Attach all ${candidates.length}`}
              tone="primary"
              busy={busy}
              disabled={busy}
              onPress={onAttachAll}
            />
            <Action
              testID="attach-choose"
              label="Choose"
              tone="secondary"
              disabled={busy}
              onPress={() => setChoosing(true)}
            />
          </>
        )}
      </View>
    </Card>
  );
}

function Action({
  testID,
  label,
  tone,
  onPress,
  disabled,
  busy,
}: {
  testID: string;
  label: string;
  tone: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      /* flexShrink so a long label ("Attach all 3") cannot push its
         neighbour off a 390pt screen — the defect that lost the Dismiss
         button on the Health suggestion card. */
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        {
          backgroundColor: primary ? theme.action.primary : theme.surface.sunken,
          opacity: pressed || disabled ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? theme.action.primaryText : theme.action.primary} />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.actionLabel,
            { color: primary ? theme.action.primaryText : theme.action.primary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function describe(workout: AttachCandidate['workout']): string {
  const minutes = Math.round(workout.durationSeconds / 60);
  return [
    new Date(workout.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
      : `${minutes} min`,
  ].join(' · ');
}

/** The tile's third line, in the design's order: avg, peak, energy. */
function metrics(workout: AttachCandidate['workout']): string[] {
  const out: string[] = [];
  if (workout.avgHeartRateBpm != null) out.push(`${workout.avgHeartRateBpm} bpm avg`);
  if (workout.peakHeartRateBpm != null) out.push(`${workout.peakHeartRateBpm} peak`);
  if (workout.caloriesKcal != null) out.push(`${workout.caloriesKcal.toLocaleString()} kcal`);
  if (workout.distanceValue != null) {
    out.push(`${workout.distanceValue} ${workout.distanceUnit ?? 'mi'}`);
  }
  return out;
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
  candidate: {
    borderRadius: radius.small,
    padding: spacing[12],
    gap: spacing[8],
    borderWidth: 1,
  },
  candidateHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  candidateMeta: { flexShrink: 1, gap: 2 },
  candidateTitle: { fontSize: 13, fontWeight: '600' },
  candidateDetail: { fontSize: 11 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing[12], rowGap: 2 },
  metric: { fontSize: 11 },
  dismiss: {
    /* Trailing, as on Today, where Dismiss is the right-hand half of the
       pair. Left-aligned and alone it read as the tile's primary action,
       which is the opposite of what it is. */
    alignSelf: 'flex-end',
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    borderRadius: radius.small,
  },
  dismissLabel: { fontSize: 13, fontWeight: '600' },
  badge: { borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: spacing[8] },
  badgeLabel: { fontSize: 9, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: spacing[8] },
  action: {
    height: 44,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
  },
  /* The design weights attach-all over Choose rather than splitting the row
     evenly — the common case should be the bigger target. */
  actionPrimary: { flexGrow: 2, flexShrink: 1, flexBasis: 0 },
  actionSecondary: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  actionLabel: { fontSize: typeScale.button.fontSize, fontWeight: '600' },
});
