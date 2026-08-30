import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Prescription } from '@setframe/schemas';
import { getPrescriptionDefinition, parseOptionalNumber } from '@setframe/domain';
import { workoutEditor } from '@setframe/design-tokens';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The prescription sheet. Counterpart of
 * `apps/web/src/components/training-v2/PrescriptionSheet.tsx`.
 *
 * Figma: `Explore/Mobile/Training 4 · Set an exercise's targets` (152:708).
 *
 * Kind is read-only; blank is allowed; replace keeps the prescription while
 * remove-then-add would lose it.
 */

const FIELDS_BY_KIND: Record<string, { key: string; label: string }[]> = {
  sets_reps: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
    { key: 'weightValue', label: 'Weight' },
  ],
  top_set_backoff: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
    { key: 'weightValue', label: 'Weight' },
  ],
  per_side: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
  ],
  bodyweight_reps: [
    { key: 'sets', label: 'Sets' },
    { key: 'repsMin', label: 'Reps' },
  ],
  timed: [{ key: 'durationMinutes', label: 'Minutes' }],
  duration: [{ key: 'durationMinutes', label: 'Minutes' }],
  distance: [{ key: 'distanceMiles', label: 'Miles' }],
  distanceDuration: [
    { key: 'distanceMiles', label: 'Miles' },
    { key: 'durationMinutes', label: 'Minutes' },
  ],
};

export interface PrescriptionSheetProps {
  exerciseName: string;
  workoutName: string;
  prescription: Prescription | null;
  onClose: () => void;
  onSave: (prescription: Prescription) => void;
  onRemove: () => void;
}

export function PrescriptionSheet({
  exerciseName,
  workoutName,
  prescription,
  onClose,
  onSave,
  onRemove,
}: PrescriptionSheetProps) {
  const theme = useTheme();
  const kind = prescription?.kind ?? 'sets_reps';
  const definition = getPrescriptionDefinition(prescription);
  const fields = FIELDS_BY_KIND[kind] ?? FIELDS_BY_KIND.sets_reps!;
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const value = (prescription as Record<string, unknown> | null)?.[field.key];
        return [field.key, value == null ? '' : String(value)];
      }),
    ),
  );

  const commit = () => {
    /* Blank means "no target", not zero — parseOptionalNumber turns '' into
       undefined so the field is absent rather than stored as a 0 the logger
       would render as a real target. */
    const next: Record<string, unknown> = { kind };
    for (const field of fields) {
      const parsed = parseOptionalNumber(draft[field.key] ?? '');
      if (parsed != null) next[field.key] = parsed;
    }
    onSave(next as Prescription);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} testID="prescription-scrim">
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface.raised }]}
          onPress={(event) => event.stopPropagation()}
          testID="prescription-sheet"
        >
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: theme.border.default }]} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{exerciseName}</Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              How this is prescribed inside {workoutName}
            </Text>
          </View>

          <View style={styles.kindRow}>
            {/* Read-only: changing kind would change what every already-logged
                set means. */}
            <View style={[styles.kindPill, { backgroundColor: theme.surface.sunken }]}>
              <Text style={[styles.kindLabel, { color: theme.text.primary }]} testID="prescription-kind">
                {definition.label}
              </Text>
            </View>
            <Text style={[styles.kindNote, { color: theme.text.secondary }]}>set when added</Text>
          </View>

          <View style={styles.fields}>
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.text.disabled }]}>
                  {field.label.toUpperCase()}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={draft[field.key] ?? ''}
                  onChangeText={(value) =>
                    setDraft((current) => ({ ...current, [field.key]: value }))
                  }
                  onBlur={commit}
                  testID={`prescription-${field.key}`}
                  style={[
                    styles.input,
                    { backgroundColor: theme.surface.canvas, color: theme.text.primary },
                  ]}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.hint, { color: theme.text.secondary }]}>
            Leave any of these blank to log it freely — planned targets are optional.
          </Text>

          <View style={[styles.divider, { backgroundColor: theme.surface.sunken }]} />

          {/* "Replace exercise" is in the design and is NOT here: it was
              never wired, and a row that does nothing is the defect being
              removed everywhere else. It returns when it works. */}
          <Pressable onPress={onRemove} testID="prescription-remove" style={styles.action}>
            <Text style={[styles.actionLabel, { color: theme.status.error }]}>
              Remove from this workout
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    paddingTop: workoutEditor.sheet.paddingTop,
    paddingBottom: workoutEditor.sheet.paddingBottom,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  grabberRow: { alignItems: 'center', paddingBottom: 8 },
  grabber: {
    width: workoutEditor.sheet.grabberWidth,
    height: workoutEditor.sheet.grabberHeight,
    borderRadius: 999,
  },
  header: {
    paddingTop: workoutEditor.sheet.header.paddingTop,
    paddingBottom: workoutEditor.sheet.header.paddingBottom,
    paddingHorizontal: workoutEditor.sheet.header.paddingX,
    gap: workoutEditor.sheet.header.gap,
  },
  title: { fontSize: workoutEditor.sheet.header.titleSize, fontWeight: '600' },
  subtitle: { fontSize: workoutEditor.sheet.header.subtitleSize },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: workoutEditor.sheet.kind.gap,
    paddingHorizontal: workoutEditor.sheet.header.paddingX,
    paddingBottom: workoutEditor.sheet.kind.paddingBottom,
  },
  kindPill: {
    paddingHorizontal: workoutEditor.sheet.kind.pillPaddingX,
    paddingVertical: workoutEditor.sheet.kind.pillPaddingY,
    borderRadius: 999,
  },
  kindLabel: { fontSize: workoutEditor.sheet.kind.pillLabelSize, fontWeight: '600' },
  kindNote: { fontSize: workoutEditor.sheet.kind.noteSize },
  fields: {
    flexDirection: 'row',
    gap: workoutEditor.sheet.field.gap,
    paddingHorizontal: workoutEditor.sheet.header.paddingX,
    paddingBottom: 16,
  },
  field: { flex: 1, gap: workoutEditor.sheet.field.labelGap },
  fieldLabel: { fontSize: workoutEditor.sheet.field.labelSize, fontWeight: '500', letterSpacing: 0.6 },
  input: {
    height: workoutEditor.sheet.field.inputHeight,
    borderRadius: workoutEditor.sheet.field.inputRadius,
    fontSize: workoutEditor.sheet.field.valueSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    fontSize: workoutEditor.sheet.hintSize,
    paddingHorizontal: workoutEditor.sheet.header.paddingX,
    paddingBottom: 14,
  },
  divider: { height: 1 },
  action: {
    height: workoutEditor.sheet.actionHeight,
    justifyContent: 'center',
    paddingHorizontal: workoutEditor.sheet.header.paddingX,
  },
  actionLabel: { fontSize: workoutEditor.sheet.actionLabelSize, fontWeight: '500' },
});
