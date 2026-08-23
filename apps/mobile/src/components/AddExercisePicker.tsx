import { useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { radius, spacing } from '@setframe/design-tokens';
import { prescriptionSchema, type Exercise, type Prescription } from '@setframe/schemas';
import { useTheme } from '../theme/ThemeProvider';
import { typeScale } from '../theme/getTheme';
import { Button } from './Button';
import { Input } from './Input';
import { Select, type SelectOption } from './Select';
import { prescriptionOptions } from '../lib/prescription';



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
  onAddExercise: (exerciseId: string, prescription: Prescription) => void | Promise<unknown>;
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
  const [prescription, setPrescription] = useState<Prescription>(emptyPrescription('sets_reps'));
  const [addError, setAddError] = useState<string | null>(null);

  /* Every prescription field is `.positive()` in the schema, but clearing an
     input yields `Number('') === 0`. Validate against the schema itself so
     the button state can never drift from what the API will accept. */
  const prescriptionValid = prescriptionSchema.safeParse(prescription).success;

  const handlePrescriptionKindChange = (kind: string) => {
    setPrescriptionKind(kind);
    setPrescription(emptyPrescription(kind));
    setAddError(null);
  };

  /* Numeric prescription config, matching the web picker field-for-field so
     a program authored on one platform reads identically on the other. */
  const numericField = (label: string, key: string, value: number) => (
    <View key={key} style={{ flex: 1, minWidth: 120 }}>
      <Input
        label={label}
        value={String(value)}
        numeric
        onChangeText={(next) =>
          setPrescription((prev) => ({ ...prev, [key]: Number(next) || 0 }) as Prescription)
        }
        testID={`prescription-${key}`}
      />
    </View>
  );

  const prescriptionFields = () => {
    switch (prescription.kind) {
      case 'sets_reps':
      case 'per_side':
      case 'bodyweight_reps':
        return [numericField('Sets', 'sets', prescription.sets), numericField('Reps', 'repsMin', prescription.repsMin)];
      case 'timed':
        return [
          numericField('Sets', 'sets', prescription.sets),
          numericField('Seconds', 'durationSeconds', prescription.durationSeconds),
        ];
      case 'duration':
        return [numericField('Minutes', 'durationMinutes', prescription.durationMinutes)];
      case 'distanceDuration':
        return [
          numericField('Distance (mi)', 'distanceMiles', prescription.distanceMiles),
          numericField('Minutes', 'durationMinutes', prescription.durationMinutes),
        ];
      case 'distance':
        return [
          numericField('Sets', 'sets', prescription.sets),
          numericField('Distance', 'distanceValue', prescription.distanceValue),
        ];
      default:
        return [];
    }
  };

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
    setPrescription(emptyPrescription('sets_reps'));
    setAddError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function chooseExercise(exercise: Exercise) {
    setSelectedExercise(exercise);
    setPrescriptionKind('sets_reps');
    setPrescription(emptyPrescription('sets_reps'));
    setAddError(null);
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
              <Select
                label="Prescription"
                value={prescriptionKind}
                options={prescriptionOptions}
                onChange={handlePrescriptionKindChange}
              />
              <View style={styles.prescriptionGrid}>{prescriptionFields()}</View>
              {!prescriptionValid ? (
                <Text style={[styles.error, { color: theme.status.error }]}>
                  Every value must be greater than zero.
                </Text>
              ) : null}
              {addError ? <Text style={[styles.error, { color: theme.status.error }]}>{addError}</Text> : null}
              <View style={styles.footerRow}>
                <Button label="Back" variant="secondary" onPress={() => setStep('search')} />
                <Button
                  label="Add to workout"
                  disabled={isAddingExercise || !prescriptionValid}
                  loading={isAddingExercise}
                  onPress={async () => {
                    // Close only once the add has landed, so a rejected
                    // request can never look like a success.
                    try {
                      setAddError(null);
                      await onAddExercise(selectedExercise.id, prescription);
                      handleClose();
                    } catch {
                      setAddError("Couldn't add that exercise. Try again.");
                    }
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
  error: {
    fontSize: typeScale.caption.fontSize,
  },
  prescriptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
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
