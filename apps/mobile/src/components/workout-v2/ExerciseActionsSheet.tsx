import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../Sheet';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * What an exercise's `⋯` opens. Counterpart of
 * `apps/web/src/components/workout-v2/ExerciseActionsSheet.tsx`.
 *
 * Figma: `Screen/Mobile/WorkoutLoggerV2 — Exercise actions` (124:439).
 *
 * **Only wired actions appear.** The design also lists Replace exercise and
 * Reorder exercises; shipping those as inert rows would repeat the very
 * defect this sheet fixes.
 */

export interface ExerciseActionsSheetProps {
  exerciseName: string;
  context: string;
  onClose: () => void;
  onViewHistory: () => void;
  onRemove: () => void;
  /** Renders in the view tree rather than a Modal. Dev-log gallery only. */
  inline?: boolean;
}

export function ExerciseActionsSheet({
  exerciseName,
  context,
  onClose,
  onViewHistory,
  onRemove,
  inline,
}: ExerciseActionsSheetProps) {
  const theme = useTheme();
  return (
    /* Was a hand-rolled Modal + scrim, which meant no keyboard avoidance and
       no safe-area padding — and, since RN's Modal is a window-level overlay,
       no way to show it in the dev gallery. The shared primitive solves all
       three; the sheet's own content is unchanged. */
    <Sheet
      visible
      inline={inline}
      onRequestClose={onClose}
      dismissOnBackdropPress
      backdropTestID="exercise-actions-scrim"
      bordered={false}
      tone="inverse"
      gap={0}
      padding={{ top: 10, bottom: 24, left: 0, right: 0 }}
    >
        <View testID="exercise-actions-sheet">
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: theme.inverse.textMuted + '4D' }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.inverse.text }]}>{exerciseName}</Text>
            <Text style={[styles.context, { color: theme.inverse.textMuted }]}>{context}</Text>
          </View>

          <Pressable onPress={onViewHistory} testID="exercise-action-history" style={styles.action}>
            <View style={styles.actionText}>
              <Text style={[styles.label, { color: theme.inverse.text }]}>View history</Text>
              <Text style={[styles.sub, { color: theme.inverse.textMuted }]}>
                Every session you have logged for this exercise
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.inverse.textMuted }]}>›</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.inverse.textMuted + '26' }]} />
          <Pressable onPress={onRemove} testID="exercise-action-remove" style={styles.action}>
            <View style={styles.actionText}>
              <Text style={[styles.label, { color: theme.inverse.danger }]}>Remove exercise</Text>
              <Text style={[styles.sub, { color: theme.inverse.textMuted }]}>
                Takes it out of today&apos;s session. Your plan is unchanged.
              </Text>
            </View>
          </Pressable>
        </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grabberRow: { alignItems: 'center', paddingBottom: 8 },
  grabber: { width: 36, height: 4, borderRadius: 999 },
  header: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  context: { fontSize: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  actionText: { flex: 1, gap: 1 },
  label: { fontSize: 15, fontWeight: '500' },
  sub: { fontSize: 12 },
  chevron: { width: 20, fontSize: 18, fontWeight: '600' },
  divider: { height: 1 },
});
