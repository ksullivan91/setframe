import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  rpeVisible: boolean;
  onClose: () => void;
  onViewHistory: () => void;
  onToggleRpe: () => void;
  onRemove: () => void;
}

export function ExerciseActionsSheet({
  exerciseName,
  context,
  rpeVisible,
  onClose,
  onViewHistory,
  onToggleRpe,
  onRemove,
}: ExerciseActionsSheetProps) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} testID="exercise-actions-scrim">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface.raised }]}
          onPress={(e) => e.stopPropagation()}
          testID="exercise-actions-sheet"
        >
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: theme.border.default }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{exerciseName}</Text>
            <Text style={[styles.context, { color: theme.text.secondary }]}>{context}</Text>
          </View>

          <Pressable onPress={onViewHistory} testID="exercise-action-history" style={styles.action}>
            <View style={styles.actionText}>
              <Text style={[styles.label, { color: theme.text.primary }]}>View history</Text>
              <Text style={[styles.sub, { color: theme.text.secondary }]}>
                Every session you have logged for this exercise
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.text.secondary }]}>›</Text>
          </Pressable>

          <Pressable onPress={onToggleRpe} testID="exercise-action-rpe" style={styles.action}>
            <View style={styles.actionText}>
              <Text style={[styles.label, { color: theme.text.primary }]}>Show RPE column</Text>
              <Text style={[styles.sub, { color: theme.text.secondary }]}>
                Adds an optional RPE field to every set here
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                {
                  backgroundColor: rpeVisible ? theme.action.primary : theme.surface.sunken,
                  justifyContent: rpeVisible ? 'flex-end' : 'flex-start',
                },
              ]}
            >
              <View style={styles.knob} />
            </View>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.surface.sunken }]} />
          <Pressable onPress={onRemove} testID="exercise-action-remove" style={styles.action}>
            <View style={styles.actionText}>
              <Text style={[styles.label, { color: theme.status.error }]}>Remove exercise</Text>
              <Text style={[styles.sub, { color: theme.text.secondary }]}>
                Takes it out of today&apos;s session. Your plan is unchanged.
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', paddingTop: 10, paddingBottom: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
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
  toggle: { width: 46, height: 26, borderRadius: 999, padding: 3, flexDirection: 'row' },
  knob: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#ffffff' },
  divider: { height: 1 },
});
