import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { spacing } from '@setframe/design-tokens';
import type { Prescription } from '@setframe/schemas';
import { parseOptionalNumber, formatOptionalNumber } from '@setframe/domain';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { Button } from './Button';
import { Input } from './Input';
import { Sheet } from './Sheet';

export interface ExerciseEditState {
  dayTypeId: string;
  exerciseId: string;
  exerciseName: string;
  prescription: Prescription;
  notes: string;
}

export interface ExerciseEditSheetProps {
  state: ExerciseEditState;
  onClose: () => void;
  onSave: (next: ExerciseEditState) => void;
  onRemove: () => void;
  isSaving?: boolean;
}

/**
 * Mobile counterpart to the web ExerciseEditModal (Story 03). Corrects an
 * already-added workout exercise's prescription without leaving Guided
 * Setup. Deliberately narrower than the full editor: prescription kind is
 * fixed here, only its numbers and the note are editable.
 */
export function ExerciseEditSheet({ state, onClose, onSave, onRemove, isSaving = false }: ExerciseEditSheetProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<ExerciseEditState>(state);

  useEffect(() => setDraft(state), [state]);

  const setPrescription = (patch: Record<string, number | undefined>) =>
    setDraft((prev) => ({ ...prev, prescription: { ...prev.prescription, ...patch } as Prescription }));

  const numberField = (label: string, value: number | undefined, key: string) => (
    <Input
      label={label}
      placeholder="No target"
      value={formatOptionalNumber(value)}
      keyboardType="numeric"
      numeric
      onChangeText={(next) => setPrescription({ [key]: parseOptionalNumber(next) })}
    />
  );

  const { prescription } = draft;

  return (
    <Sheet visible onRequestClose={onClose}>
      <>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {draft.exerciseName}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.closeButton}
          >
            <X size={20} color={theme.text.secondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {prescription.kind === 'sets_reps' || prescription.kind === 'per_side' || prescription.kind === 'bodyweight_reps' ? (
            <>
              {numberField('Sets', prescription.sets, 'sets')}
              {numberField('Reps', prescription.repsMin, 'repsMin')}
            </>
          ) : null}

          {prescription.kind === 'timed' ? (
            <>
              {numberField('Sets', prescription.sets, 'sets')}
              {numberField('Seconds', prescription.durationSeconds, 'durationSeconds')}
            </>
          ) : null}

          {prescription.kind === 'duration' ? numberField('Minutes', prescription.durationMinutes, 'durationMinutes') : null}

          {prescription.kind === 'distanceDuration' ? (
            <>
              {numberField('Distance (mi)', prescription.distanceMiles, 'distanceMiles')}
              {numberField('Minutes', prescription.durationMinutes, 'durationMinutes')}
            </>
          ) : null}

          {prescription.kind === 'distance' ? (
            <>
              {numberField('Sets', prescription.sets, 'sets')}
              {numberField('Distance', prescription.distanceValue, 'distanceValue')}
            </>
          ) : null}

          <Input
            label="Notes"
            value={draft.notes}
            onChangeText={(next) => setDraft((prev) => ({ ...prev, notes: next }))}
            placeholder="Optional cue"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Remove" variant="destructive" onPress={onRemove} />
          <View style={styles.footerRight}>
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button label="Save" onPress={() => onSave(draft)} disabled={isSaving} loading={isSaving} />
          </View>
        </View>
      </>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  title: { flex: 1, fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing[12], paddingBottom: spacing[8] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8], flexWrap: 'wrap' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
});
