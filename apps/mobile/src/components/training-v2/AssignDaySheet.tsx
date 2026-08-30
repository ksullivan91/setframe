import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DayType } from '@setframe/schemas';
import { workoutEditor } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * What a schedule row's chevron opens. Counterpart of
 * `apps/web/src/components/training-v2/AssignDaySheet.tsx`.
 *
 * Multi-select, because `program_schedule_slot` has no unique constraint on
 * `(programVersionId, dayIndex)` and carries a `sortOrder` — two-a-days are
 * legal in the data model. Rest sits below a divider because `dayTypeId` is
 * `NOT NULL`: choosing it *deletes* the day's slots rather than assigning
 * anything. No Save button — the sheet is a picker, not a form.
 */

export interface AssignDaySheetProps {
  dayName: string;
  dayTypes: readonly DayType[];
  selectedIds: readonly string[];
  onClose: () => void;
  onChange: (dayTypeIds: string[]) => void;
}

export function AssignDaySheet({
  dayName,
  dayTypes,
  selectedIds,
  onClose,
  onChange,
}: AssignDaySheetProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState<string[]>([...selectedIds]);

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id];
    setSelected(next);
    onChange(next);
  };

  const clear = () => {
    setSelected([]);
    onChange([]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} testID="assign-day-scrim">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface.raised }]}
          onPress={(e) => e.stopPropagation()}
          testID="assign-day-sheet"
        >
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: theme.border.default }]} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{dayName}</Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              What you train every {dayName}
            </Text>
          </View>

          <ScrollView>
            {dayTypes.map((dayType) => {
              const index = selected.indexOf(dayType.id);
              return (
                <Pressable
                  key={dayType.id}
                  onPress={() => toggle(dayType.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: index !== -1 }}
                  testID={`assign-option-${dayType.id}`}
                  style={[
                    styles.option,
                    index !== -1 && { backgroundColor: theme.action.primary + '0F' },
                  ]}
                >
                  {/* The check becomes a number once more than one is chosen. */}
                  <View
                    style={[
                      styles.check,
                      index !== -1
                        ? { backgroundColor: theme.action.primary }
                        : { borderWidth: 1, borderColor: theme.border.default },
                    ]}
                  >
                    <Text style={[styles.checkLabel, { color: theme.action.primaryText }]}>
                      {index !== -1 && selected.length > 1 ? String(index + 1) : ''}
                    </Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionName, { color: theme.text.primary }]}>
                      {dayType.name}
                    </Text>
                    <Text style={[styles.optionMeta, { color: theme.text.secondary }]}>
                      {dayType.exerciseCount != null
                        ? `${dayType.exerciseCount} exercises`
                        : 'Workout'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.hint, { color: theme.text.secondary }]}>
            Pick more than one to train twice in a day. They run in the order you choose them.
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.surface.sunken }]} />

          <Pressable
            onPress={clear}
            testID="assign-rest"
            accessibilityRole="button"
            style={[
              styles.option,
              styles.restOption,
              selected.length === 0 && { backgroundColor: theme.action.primary + '0F' },
            ]}
          >
            <View
              style={[
                styles.check,
                selected.length === 0
                  ? { backgroundColor: theme.action.primary }
                  : { borderWidth: 1, borderColor: theme.border.default },
              ]}
            />
            <View style={styles.optionText}>
              <Text style={[styles.optionName, { color: theme.text.primary }]}>Rest</Text>
              <Text style={[styles.optionMeta, { color: theme.text.secondary }]}>
                Clears whatever is on this day
              </Text>
            </View>
          </Pressable>

          <Text style={[styles.foot, { color: theme.text.secondary }]}>
            Changes every {dayName} in this plan. To change one date only, use “Changes to specific
            days”.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    paddingTop: workoutEditor.sheet.paddingTop,
    paddingBottom: workoutEditor.sheet.paddingBottom,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  grabberRow: { alignItems: 'center', paddingBottom: 8 },
  grabber: { width: 36, height: 4, borderRadius: 999 },
  header: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12, gap: 2 },
  title: { fontSize: 17, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  restOption: { minHeight: 62, paddingVertical: 14 },
  check: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { fontSize: 12, fontWeight: '600' },
  optionText: { flex: 1, gap: 1 },
  optionName: { fontSize: 15, fontWeight: '500' },
  optionMeta: { fontSize: 12 },
  hint: { fontSize: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  divider: { height: 1 },
  foot: { fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
});
