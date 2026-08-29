import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, ArrowUp, CheckCircle2, Minus } from 'lucide-react-native';
import type { CompletedExerciseReadout } from '@setframe/domain';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing, typeScale } from '../theme/getTheme';

/**
 * A finished exercise, as a record of what happened rather than a form.
 *
 * Story 42, and the native half of `apps/web`'s component of the same name.
 * The two are deliberately separate files — this repo duplicates UI per
 * platform on purpose — but every *decision* they render comes from
 * `@setframe/domain`'s `buildCompletedExerciseReadout`, so which metrics
 * appear, what they are called, and whether a comparison is honest cannot
 * drift between web and native.
 *
 * The previous native treatment matched web's: the ordinary header with a
 * lavender fill, a `Complete` badge, and a dense one-line summary. Both are
 * replaced by the same structure — circled check, name, figures on tiles —
 * so the two platforms read as one product.
 */

const settleDuration = 220;

export interface CompletedExerciseCardProps {
  name: string;
  readout: CompletedExerciseReadout;
  setCountLabel: string;
  onReopen: () => void;
  /**
   * Whether the exercise is currently expanded beneath this card.
   *
   * Story 42A — once the parent workout is complete the card stays put in
   * both states rather than handing over to the editing header, so this
   * drives the disclosure's announced state.
   */
  expanded?: boolean;
  /**
   * The right-hand slot: the overflow control during an active workout, the
   * disclosure chevron once the workout is complete. One fixed position, so
   * status (the check, on the left) and navigation never trade places.
   */
  actions?: ReactNode;
  testID?: string;
}

export function CompletedExerciseCard({
  name,
  readout,
  setCountLabel,
  onReopen,
  expanded = false,
  actions,
  testID,
}: CompletedExerciseCardProps) {
  const theme = useTheme();
  const { metrics, comparison, isPersonalRecord } = readout;

  /* A brief settle on appearance. `useNativeDriver` so it runs off the JS
     thread — mid-workout this component mounts while the user is typing, and
     an animation that competes for the JS thread would show up as input lag
     rather than as polish. */
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    /* Reduced motion is a system setting on iOS, not a media query. Honoured
       by skipping straight to the settled value, so the state is still
       immediately legible — only the movement goes. */
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: settleDuration,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  const ComparisonIcon =
    comparison?.direction === 'up' ? ArrowUp : comparison?.direction === 'down' ? ArrowDown : Minus;

  return (
    <Animated.View
      testID={testID}
      style={{
        opacity: progress,
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
      }}
    >
      <Pressable
        onPress={onReopen}
        accessibilityRole="button"
        /* Completion is carried by an icon and a colour, so it is spelled out
           here — and the label says the card does something, since a summary
           that happens to be tappable is not discoverable otherwise. */
        accessibilityLabel={`${name}, completed, ${setCountLabel}. ${expanded ? 'Collapse' : 'Reopen to see sets'}.`}
        accessibilityState={{ expanded }}
        style={styles.reopen}
      >
        {/* Matches Today's "Workout complete" badge: a green mark on a light
            surface with a soft green halo, rather than a solid green disc with
            a white tick. One completion language across the product. */}
        <View style={[styles.checkCircle, { backgroundColor: theme.surface.raised, borderColor: theme.status.successSubtle }]}>
          <CheckCircle2 size={26} strokeWidth={2.5} color={theme.status.success} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: theme.text.primary }]}>{name}</Text>
          <View style={styles.captionRow}>
            <Text style={[styles.caption, { color: theme.text.secondary }]}>{setCountLabel}</Text>
            {isPersonalRecord ? (
              <View style={[styles.prPill, { backgroundColor: theme.status.success }]}>
                <Text style={[styles.prLabel, { color: theme.action.primaryText }]}>PR</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {metrics.length ? (
        <View style={styles.metricRow} testID={testID ? `${testID}-metrics` : undefined}>
          {metrics.map((metric) => (
            <View
              key={metric.key}
              style={[styles.metricTile, { backgroundColor: theme.surface.raised }]}
            >
              <Text style={[styles.metricLabel, { color: theme.text.secondary }]} numberOfLines={1}>
                {metric.label}
              </Text>
              <Text style={[styles.metricValue, { color: theme.text.primary }]} numberOfLines={1}>
                {metric.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {comparison ? (
        <View style={styles.comparisonRow} accessibilityLabel={comparison.accessibleLabel}>
          <ComparisonIcon
            size={14}
            /* A regression is information, not an alarm: rendering it in the
               error colour would punish a deload the user chose. */
            color={comparison.direction === 'up' ? theme.status.success : theme.text.secondary}
          />
          <Text
            style={[
              styles.comparison,
              {
                color: comparison.direction === 'up' ? theme.status.success : theme.text.secondary,
                fontWeight: comparison.direction === 'up' ? '600' : '400',
              },
            ]}
          >
            {comparison.label}
          </Text>
        </View>
      ) : null}

      {actions ? <View style={styles.actionSlot}>{actions}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  reopen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
    // Keeps a long exercise name clear of the absolutely-positioned actions.
    paddingRight: spacing[32],
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    /* A ring rather than a shadow: RN shadows need per-platform props and
       render inconsistently, and the ring is what carries the "stamp" read. */
    borderWidth: 4,
  },
  titleBlock: { flex: 1, gap: spacing[4] },
  name: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '700',
  },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8], flexWrap: 'wrap' },
  caption: { fontSize: typeScale.compactBody.fontSize },
  prPill: { paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.full },
  prLabel: { fontSize: typeScale.caption.fontSize, fontWeight: '700', letterSpacing: 0.5 },
  metricRow: {
    flexDirection: 'row',
    gap: spacing[8],
    marginTop: spacing[12],
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    gap: spacing[4],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[12],
    borderRadius: radius.small,
  },
  metricLabel: { fontSize: typeScale.caption.fontSize },
  metricValue: {
    // Matches web: the workout-set token, sized for "275 × 5".
    fontSize: typeScale.numericWorkoutSet.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginTop: spacing[12],
  },
  comparison: { fontSize: typeScale.compactBody.fontSize },
  actionSlot: { position: 'absolute', top: 0, right: 0 },
});
