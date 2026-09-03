import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * What the SET chip opens. Counterpart of
 * `apps/web/src/components/workout-v2/SetTypeSheet.tsx`.
 *
 * Figma: `Screen/Mobile/WorkoutLoggerV2 — Set type sheet` (123:377).
 *
 * The chip was inert, which left changing a set's type and deleting a set —
 * two mutations v1 had — with no route at all. Every option writes
 * immediately and optimistically; there is no Save.
 */

export const SET_TYPE_OPTIONS = [
  { value: 'working', label: 'Working set', chip: '', desc: 'Counts toward volume and the completed-set count.' },
  { value: 'warmup', label: 'Warm-up', chip: 'W', desc: 'Excluded from the completed-set count and from PRs.' },
  { value: 'top', label: 'Top set', chip: 'T', desc: 'The heaviest set for this exercise today.' },
  { value: 'backoff', label: 'Backoff', chip: 'B', desc: 'Lighter volume work following a top set.' },
  { value: 'drop', label: 'Drop set', chip: 'D', desc: 'Continues the previous set at a reduced load.' },
  { value: 'failure', label: 'Failure', chip: 'F', desc: 'Taken to technical failure.' },
] as const;

export interface SetTypeSheetProps {
  exerciseName: string;
  setLabel: string;
  currentType: string;
  onClose: () => void;
  onSelect: (setType: string) => void;
  onDelete: () => void;
}

export function SetTypeSheet({
  exerciseName,
  setLabel,
  currentType,
  onClose,
  onSelect,
  onDelete,
}: SetTypeSheetProps) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} testID="set-type-scrim">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface.raised }]}
          onPress={(e) => e.stopPropagation()}
          testID="set-type-sheet"
        >
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: theme.border.default }]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]}>Set type</Text>
            <Text style={[styles.context, { color: theme.text.secondary }]}>
              Set {setLabel} · {exerciseName}
            </Text>
          </View>

          <ScrollView>
            {SET_TYPE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: option.value === currentType }}
                testID={`set-type-${option.value}`}
                style={[
                  styles.option,
                  option.value === currentType && {
                    backgroundColor: theme.action.primary + '0F',
                  },
                ]}
              >
                <View style={[styles.chip, { backgroundColor: theme.surface.sunken }]}>
                  <Text style={[styles.chipLabel, { color: theme.text.primary }]}>
                    {option.chip || setLabel}
                  </Text>
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.name, { color: theme.text.primary }]}>{option.label}</Text>
                  <Text style={[styles.desc, { color: theme.text.secondary }]}>{option.desc}</Text>
                </View>
                <Text style={[styles.check, { color: theme.action.primary }]}>
                  {option.value === currentType ? '✓' : ''}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.divider, { backgroundColor: theme.surface.sunken }]} />
          <Pressable onPress={onDelete} testID="set-type-delete" style={styles.delete}>
            <Text style={[styles.deleteLabel, { color: theme.status.errorText }]}>
              Delete set {setLabel}
            </Text>
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
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  chip: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 14, fontWeight: '500' },
  optionText: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '500' },
  desc: { fontSize: 12 },
  check: { width: 20, fontSize: 15, fontWeight: '600' },
  divider: { height: 1 },
  delete: { padding: 16 },
  deleteLabel: { fontSize: 15, fontWeight: '500' },
});
