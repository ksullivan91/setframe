import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { radius, spacing } from '@setframe/design-tokens';
import type { Exercise, Prescription } from '@setframe/schemas';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { Button } from './Button';
import { Input } from './Input';
import { Select, type SelectOption } from './Select';

const prescriptionOptions: SelectOption<string>[] = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];

export function emptyPrescription(kind: string): Prescription {
  switch (kind) {
    case 'timed':
      return { kind: 'timed', sets: 3, durationSeconds: 60 };
    case 'duration':
      return { kind: 'duration', durationMinutes: 30 };
    case 'distanceDuration':
      return { kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 };
    case 'distance':
      return { kind: 'distance', sets: 1, distanceValue: 1, distanceUnit: 'mi' };
    case 'bodyweight_reps':
      return { kind: 'bodyweight_reps', sets: 3, repsMin: 8 };
    default:
      return { kind: 'sets_reps', sets: 3, repsMin: 8 };
  }
}

export interface AddExercisePickerProps {
  open: boolean;
  exercises: Exercise[];
  exercisesLoading: boolean;
  exercisesError: boolean;
  onRetryExercises: () => void;
  onClose: () => void;
  onCreateExercise: (name: string) => Promise<Exercise>;
  isCreatingExercise: boolean;
  onAddExercise: (exerciseId: string, prescription: Prescription) => void;
  isAddingExercise: boolean;
}

/**
 * Mobile counterpart to the web AddExercisePicker (Story 01). Replaces
 * the old always-visible Exercise/Prescription/custom-name/Create/Add
 * cluster with progressive disclosure across three steps: search-and-pick
 * an existing exercise, optionally branch to custom creation, then
 * configure the prescription and confirm.
 *
 * The key correctness property: there is exactly one source of truth for
 * the exercise being added (`selectedExercise`). Previously a stale
 * dropdown selection could silently win over freshly typed custom text,
 * adding the wrong exercise to the workout.
 */
export function AddExercisePicker({
  open,
  exercises,
  exercisesLoading,
  exercisesError,
  onRetryExercises,
  onClose,
  onCreateExercise,
  isCreatingExercise,
  onAddExercise,
  isAddingExercise,
}: AddExercisePickerProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'search' | 'create' | 'configure'>('search');
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');

  const filtered = useMemo(
    () => exercises.filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase())),
    [exercises, query],
  );

  function reset() {
    setStep('search');
    setQuery('');
    setCustomName('');
    setCreateError(null);
    setSelectedExercise(null);
    setPrescriptionKind('sets_reps');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function chooseExercise(exercise: Exercise) {
    setSelectedExercise(exercise);
    setPrescriptionKind('sets_reps');
    setStep('configure');
  }

  const title = step === 'create' ? 'Create custom exercise' : step === 'configure' ? (selectedExercise?.name ?? 'Configure') : 'Add exercise';

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface.raised, borderColor: theme.border.default }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={styles.closeButton}
            >
              <X size={20} color={theme.text.secondary} />
            </Pressable>
          </View>

          {step === 'search' ? (
            <View style={styles.body}>
              <Input label="Search exercises" value={query} onChangeText={setQuery} placeholder="Barbell Back Squat…" />
              {exercisesLoading ? (
                <View style={styles.stateRow}>
                  <ActivityIndicator color={theme.action.primary} />
                  <Text style={{ color: theme.text.secondary }}>Loading exercise catalog…</Text>
                </View>
              ) : exercisesError ? (
                <View style={styles.stateRow}>
                  <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load exercises.</Text>
                  <Button label="Retry" variant="secondary" onPress={onRetryExercises} />
                </View>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={{ color: theme.text.secondary }}>
                      {exercises.length === 0 ? 'No exercises available yet.' : `No exercises match “${query}”.`}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => chooseExercise(item)}
                      accessibilityRole="button"
                      style={[styles.listItem, { borderColor: theme.border.subtle, backgroundColor: theme.surface.canvas }]}
                    >
                      <Text style={{ color: theme.text.primary, fontWeight: '600' }}>
                        {item.isCustom ? `${item.name} (custom)` : item.name}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
              <View style={styles.footerRow}>
                <Text style={{ color: theme.text.secondary }}>Can&apos;t find it?</Text>
                <Button
                  label="Create custom exercise"
                  variant="secondary"
                  onPress={() => {
                    setCustomName(query.trim());
                    setCreateError(null);
                    setStep('create');
                  }}
                  disabled={exercisesLoading}
                />
              </View>
            </View>
          ) : null}

          {step === 'create' ? (
            <View style={styles.body}>
              <Input
                label="Exercise name"
                value={customName}
                onChangeText={(next) => {
                  setCustomName(next);
                  setCreateError(null);
                }}
                placeholder="Cable face pull"
                errorMessage={createError ?? undefined}
              />
              <View style={styles.footerRow}>
                <Button label="Cancel" variant="secondary" onPress={() => setStep('search')} />
                <Button
                  label="Create & add"
                  disabled={!customName.trim() || isCreatingExercise}
                  loading={isCreatingExercise}
                  onPress={async () => {
                    try {
                      setCreateError(null);
                      const created = await onCreateExercise(customName.trim());
                      chooseExercise(created);
                    } catch {
                      // Preserve the user's typed name so they can retry
                      // without re-entering it (Story 01 acceptance criteria).
                      setCreateError("Couldn't create that exercise. Try again.");
                    }
                  }}
                />
              </View>
            </View>
          ) : null}

          {step === 'configure' && selectedExercise ? (
            <View style={styles.body}>
              <Select label="Prescription" value={prescriptionKind} options={prescriptionOptions} onChange={setPrescriptionKind} />
              <View style={styles.footerRow}>
                <Button label="Back" variant="secondary" onPress={() => setStep('search')} />
                <Button
                  label="Add to workout"
                  disabled={isAddingExercise}
                  loading={isAddingExercise}
                  onPress={() => {
                    onAddExercise(selectedExercise.id, emptyPrescription(prescriptionKind));
                    handleClose();
                  }}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    borderWidth: 1,
    maxHeight: '85%',
    padding: spacing[16],
    gap: spacing[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  title: {
    flex: 1,
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: spacing[12],
  },
  list: {
    maxHeight: 280,
  },
  listItem: {
    padding: spacing[12],
    borderRadius: radius.small,
    borderWidth: 1,
    marginBottom: spacing[8],
    minHeight: 44,
    justifyContent: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flexWrap: 'wrap',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    flexWrap: 'wrap',
  },
});
