import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, Alert, Modal, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { IconButton } from '../src/components/IconButton';
import { Toast } from '../src/components/Toast';
import { ExerciseEditSheet, type ExerciseEditState } from '../src/components/ExerciseEditSheet';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Select, type SelectOption } from '../src/components/Select';
import { AddExercisePicker } from '../src/components/AddExercisePicker';
import { WeekScheduleEditor } from '../src/components/WeekScheduleEditor';
import { useApiClient } from '../src/lib/api-client';
import { restoreExerciseOrder } from '@setframe/domain';
import { summarizePrescription } from '../src/lib/prescription';
import { useTheme } from '../src/theme/ThemeProvider';
import { radius } from '@setframe/design-tokens';
import { spacing, typeScale } from '../src/theme/getTheme';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

interface WizardWorkoutDraft {
  tempId: string;
  dayTypeId: string;
  name: string;
}

const EMPTY_SCHEDULE_SLOTS: ProgramScheduleSlot[] = [];

const modeOptions: SelectOption<'perpetual' | 'block'>[] = [
  { value: 'perpetual', label: 'Repeats weekly' },
  { value: 'block', label: 'Fixed block/cycle' },
];

const steps = [
  { key: 'program', title: 'Program', description: 'Name it and choose how it repeats.' },
  { key: 'workouts', title: 'Workouts', description: 'Create your first workout templates.' },
  { key: 'exercises', title: 'Exercises', description: 'Add the main exercises for each workout.' },
  { key: 'schedule', title: 'Schedule', description: 'Assign workouts to your week.' },
];

function nextTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * `Screen/Mobile/ProgramWizard` — mobile counterpart to web's
 * `ProgramCreationWizardPage`. Same 4-step guided flow (program basics
 * → workouts → exercises → schedule) against the same API, adapted to
 * RN idioms: a single-screen step view instead of a two-column
 * grid+aside layout, native `Select`/`Input` components, and `Alert`
 * for error feedback in place of a toast system (mobile has no wired
 * toast provider yet). "Switch to full editor" isn't offered here since
 * mobile's editor is intentionally read-only — finishing the wizard
 * routes to it directly.
 */
export default function ProgramWizardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [programName, setProgramName] = useState('My Training Program');
  const [mode, setMode] = useState<'perpetual' | 'block'>('perpetual');
  const [programId, setProgramId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [workouts, setWorkouts] = useState<WizardWorkoutDraft[]>([]);
  const [selectedWorkoutTempId, setSelectedWorkoutTempId] = useState<string | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<DayTypeExercise | null>(null);
  const [editState, setEditState] = useState<ExerciseEditState | null>(null);
  const [undoState, setUndoState] = useState<{ target: DayTypeExercise; originalIndex: number } | null>(null);
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, string | null>>({});

  const {
    data: exercises = [],
    isLoading: exercisesLoading,
    isError: exercisesError,
    refetch: refetchExercises,
  } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  const scheduleSlotsQuery = useQuery({
    queryKey: ['schedule-slots', programId],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${programId}/schedule-slots`),
    enabled: Boolean(programId),
  });
  const scheduleSlots = scheduleSlotsQuery.data ?? EMPTY_SCHEDULE_SLOTS;

  const selectedWorkout = useMemo(
    () => workouts.find((workout) => workout.tempId === selectedWorkoutTempId) ?? null,
    [workouts, selectedWorkoutTempId],
  );

  const exerciseName = (item: DayTypeExercise) =>
    exercises.find((candidate) => candidate.id === item.exerciseId)?.name ?? 'Exercise';

  const selectedWorkoutDetail = useQuery({
    queryKey: ['day-type', selectedWorkout?.dayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedWorkout?.dayTypeId}`),
    enabled: Boolean(selectedWorkout?.dayTypeId),
  });

  useEffect(() => {
    setUndoState(null);
  }, [selectedWorkoutTempId]);

  useEffect(() => {
    if (!selectedWorkoutTempId && workouts.length > 0) {
      setSelectedWorkoutTempId(workouts[0]!.tempId);
    }
  }, [selectedWorkoutTempId, workouts]);

  useEffect(() => {
    const next: Record<number, string | null> = {};
    scheduleSlots.forEach((slot) => {
      if (slot.weekNumber === null || slot.weekNumber === 1) next[slot.dayIndex] = slot.dayTypeId;
    });
    setScheduleByDay(next);
  }, [scheduleSlots]);

  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: async (created) => {
      setProgramId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      if (mode === 'block') {
        await api.patch(`/programs/${created.id}`, { cycleLengthWeeks: 1 });
      }
      setCurrentStep(1);
    },
    onError: () => Alert.alert('Could not create program', 'Please try again.'),
  });

  const createDayType = useMutation({
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', body),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['day-types'] });
      const nextWorkout = { tempId: nextTempId('workout'), dayTypeId: created.id, name: created.name };
      setWorkouts((current) => [...current, nextWorkout]);
      setSelectedWorkoutTempId(nextWorkout.tempId);
      setWorkoutName('');
    },
    onError: () => Alert.alert('Could not create workout', 'Please try again.'),
  });

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    // Errors surface inline inside AddExercisePicker (which preserves the
    // typed name for retry) rather than as a modal Alert.
  });

  const addExercise = useMutation({
    mutationFn: (body: { dayTypeId: string; exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${body.dayTypeId}/exercises`, { exerciseId: body.exerciseId, prescription: body.prescription }),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', vars.dayTypeId] });
    },
    onError: () => Alert.alert('Could not add exercise', 'Please try again.'),
  });

  /**
   * Guided Setup writes workout exercises straight to the backend, so a
   * removal is a real DELETE and undo has to re-create the row. Capture
   * the position it held so undo can put it back where it was.
   */
  const removeExercise = useMutation({
    mutationFn: async (target: DayTypeExercise) => {
      const originalIndex = (selectedWorkoutDetail.data?.exercises ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .findIndex((item) => item.id === target.id);
      await api.del(`/day-types/${target.dayTypeId}/exercises/${target.id}`);
      return { target, originalIndex };
    },
    onSuccess: async (restorePoint) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', restorePoint.target.dayTypeId] });
      setUndoState(restorePoint);
    },
    onError: () => Alert.alert('Could not remove exercise', 'Please try again.'),
  });

  const undoRemoveExercise = useMutation({
    mutationFn: async ({ target, originalIndex }: { target: DayTypeExercise; originalIndex: number }) => {
      const restored = await api.post<DayTypeExercise>(`/day-types/${target.dayTypeId}/exercises`, {
        exerciseId: target.exerciseId,
        prescription: target.prescription,
        notes: target.notes ?? undefined,
      });
      // Re-read the live list rather than replaying a pre-delete snapshot:
      // the reorder endpoint rejects any payload whose id set differs from
      // the day type's current rows, which a stale snapshot would trip as
      // soon as anything else changed in between.
      const detail = await api.get<DayTypeDetail>(`/day-types/${target.dayTypeId}`);
      const currentIds = detail.exercises
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.id);
      await api.post(`/day-types/${target.dayTypeId}/exercises/reorder`, {
        exerciseIdsInOrder: restoreExerciseOrder({ currentIds, restoredId: restored.id, originalIndex }),
      });
      return target.dayTypeId;
    },
    onSuccess: async (dayTypeId) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', dayTypeId] });
    },
    onError: async (_error, { target }) => {
      // The re-create may already have landed; refresh so the user sees the
      // real list instead of re-adding and creating a duplicate.
      await queryClient.invalidateQueries({ queryKey: ['day-type', target.dayTypeId] });
      Alert.alert('Could not fully restore exercise', 'Check the exercise list for this workout.');
    },
  });

  const patchExercise = useMutation({
    mutationFn: (args: { dayTypeId: string; exerciseId: string; body: { prescription: Prescription; notes: string | null } }) =>
      api.patch(`/day-types/${args.dayTypeId}/exercises/${args.exerciseId}`, args.body),
    onSuccess: async (_, args) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', args.dayTypeId] });
      setEditState(null);
    },
    onError: () => Alert.alert('Could not update exercise', 'Please try again.'),
  });

  const upsertSlot = useMutation({
    mutationFn: async (body: { id?: string; dayTypeId: string; weekNumber: number | null; dayIndex: number; sortOrder: number }) => {
      if (!programId) throw new Error('Missing program');
      return body.id
        ? api.patch(`/programs/${programId}/schedule-slots/${body.id}`, body)
        : api.post(`/programs/${programId}/schedule-slots`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
    },
    onError: () => Alert.alert('Could not update schedule', 'Please try again.'),
  });

  const removeSlot = useMutation({
    mutationFn: async (slotId: string) => {
      if (!programId) throw new Error('Missing program');
      return api.del(`/programs/${programId}/schedule-slots/${slotId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
    },
    onError: () => Alert.alert('Could not clear day', 'Please try again.'),
  });

  const canContinueFromProgram = programName.trim().length > 0;
  const canContinueFromWorkouts = workouts.length > 0;
  const exerciseCounts = workouts.map((workout) => {
    const detail = queryClient.getQueryData<DayTypeDetail>(['day-type', workout.dayTypeId]);
    return { workout, count: detail?.exercises.length ?? 0 };
  });
  const canContinueFromExercises = workouts.length > 0 && exerciseCounts.every((item) => item.count > 0);
  const hasSchedule = Object.values(scheduleByDay).some(Boolean);

  const goToEditor = () => router.replace('/program-editor');

  const handleProgramNext = () => {
    if (!canContinueFromProgram) return;
    if (programId) {
      setCurrentStep(1);
      return;
    }
    createProgram.mutate({ name: programName.trim() });
  };

  return (
    <>
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>New here?</Text>
        <Text style={[styles.title, { color: theme.text.primary }]}>Guided program setup</Text>
        <Text style={{ color: theme.text.secondary }}>
          Build the basics in four focused steps. You can fine-tune everything else on web anytime.
        </Text>
        <Text style={[styles.stepIndicator, { color: theme.action.primary }]}>
          Step {currentStep + 1} of {steps.length} · {steps[currentStep]!.title}
        </Text>
      </View>

      <Card>
        {currentStep === 0 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>1. Start with the program</Text>
            <Text style={{ color: theme.text.secondary }}>
              Name the program and choose whether it repeats every week or runs as a simple block.
            </Text>
            <Input label="Program name" value={programName} onChangeText={setProgramName} placeholder="Fall strength block" />
            <Select label="Program mode" value={mode} onChange={setMode} options={modeOptions} />
          </View>
        ) : null}

        {currentStep === 1 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>2. Create your first workouts</Text>
            <Text style={{ color: theme.text.secondary }}>
              Think of these as reusable workout templates like Upper A, Lower B, Walk, or Mobility.
            </Text>
            <Input label="Workout name" value={workoutName} onChangeText={setWorkoutName} placeholder="Upper A" />
            <Button
              label="Add workout"
              variant="secondary"
              onPress={() => workoutName.trim() && createDayType.mutate({ name: workoutName.trim() })}
              disabled={!workoutName.trim()}
              loading={createDayType.isPending}
            />
            {workouts.length === 0 ? (
              <Text style={{ color: theme.text.secondary }}>No workouts yet. Add at least one to continue.</Text>
            ) : (
              workouts.map((workout) => (
                <Button
                  key={workout.tempId}
                  label={workout.name}
                  variant={selectedWorkoutTempId === workout.tempId ? 'primary' : 'secondary'}
                  onPress={() => setSelectedWorkoutTempId(workout.tempId)}
                />
              ))
            )}
          </View>
        ) : null}

        {currentStep === 2 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>3. Add exercises</Text>
            <Text style={{ color: theme.text.secondary }}>
              Pick one workout at a time and add its core exercises with a simple prescription.
            </Text>
            {workouts.length === 0 ? (
              <Text style={{ color: theme.text.secondary }}>Create a workout first.</Text>
            ) : (
              <>
                <View style={styles.chipRow}>
                  {workouts.map((workout) => (
                    <Button
                      key={workout.tempId}
                      label={workout.name}
                      variant={selectedWorkoutTempId === workout.tempId ? 'primary' : 'secondary'}
                      onPress={() => setSelectedWorkoutTempId(workout.tempId)}
                    />
                  ))}
                </View>
                {selectedWorkout ? (
                  <View style={styles.stack}>
                    <Button
                      label={`Add exercise to ${selectedWorkout.name}`}
                      onPress={() => setAddExerciseOpen(true)}
                    />
                    {undoState ? (
                      <Toast
                        variant="success"
                        message="Exercise removed."
                        actionLabel="Undo"
                        onAction={() => {
                          if (undoRemoveExercise.isPending) return;
                          setUndoState(null);
                          undoRemoveExercise.mutate(undoState);
                        }}
                        onDismiss={() => setUndoState(null)}
                      />
                    ) : null}
                    {(selectedWorkoutDetail.data?.exercises ?? []).length === 0 ? (
                      <Text style={{ color: theme.text.secondary }}>
                        Add at least one exercise to {selectedWorkout.name}.
                      </Text>
                    ) : (
                      selectedWorkoutDetail.data?.exercises
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((exercise) => (
                          <Card key={exercise.id}>
                            <View style={styles.exerciseRow}>
                              <View style={styles.exerciseSummary}>
                                <Text style={{ color: theme.text.primary, fontWeight: '600' }}>
                                  {exerciseName(exercise)}
                                </Text>
                                <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                                  {summarizePrescription(exercise.prescription)}
                                </Text>
                              </View>
                              <IconButton
                                icon={MoreVertical}
                                variant="subtle"
                                accessibilityLabel={`Actions for ${exerciseName(exercise)}`}
                                onPress={() => setActionsFor(exercise)}
                              />
                            </View>
                          </Card>
                        ))
                    )}
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {currentStep === 3 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>4. Put workouts on the calendar</Text>
            <Text style={{ color: theme.text.secondary }}>
              Assign each workout to the days it should land on. Leave days empty for rest or flexibility.
            </Text>
            {workouts.length === 0 ? (
              <Text style={{ color: theme.text.secondary }}>Create workouts first.</Text>
            ) : (
              <WeekScheduleEditor
                workouts={workouts.map((workout) => ({ id: workout.dayTypeId, name: workout.name }))}
                assignmentsByDay={scheduleByDay}
                selectedWorkoutId={selectedWorkout?.dayTypeId ?? null}
                onSelectWorkout={(workoutId) =>
                  setSelectedWorkoutTempId(workouts.find((workout) => workout.dayTypeId === workoutId)?.tempId ?? null)
                }
                isLoading={scheduleSlotsQuery.isLoading}
                disabled={!programId}
                onAssignDay={(dayIndex, dayTypeId) => {
                  const slot = scheduleSlots.find(
                    (item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1),
                  );
                  setScheduleByDay((current) => ({ ...current, [dayIndex]: dayTypeId }));
                  upsertSlot.mutate({
                    id: slot?.id,
                    dayTypeId,
                    weekNumber: mode === 'block' ? 1 : null,
                    dayIndex,
                    sortOrder: dayIndex,
                  });
                }}
                onClearDay={(dayIndex) => {
                  const slot = scheduleSlots.find(
                    (item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1),
                  );
                  if (slot) removeSlot.mutate(slot.id);
                  setScheduleByDay((current) => ({ ...current, [dayIndex]: null }));
                }}
              />
            )}
          </View>
        ) : null}

        <View style={styles.footer}>
          {currentStep > 0 ? (
            <Button label="Back" variant="secondary" onPress={() => setCurrentStep((step) => Math.max(0, step - 1))} />
          ) : (
            <View />
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              label="Next"
              onPress={() => {
                if (currentStep === 0) handleProgramNext();
                else if (currentStep === 1 && canContinueFromWorkouts) setCurrentStep(2);
                else if (currentStep === 2 && canContinueFromExercises) setCurrentStep(3);
              }}
              disabled={
                (currentStep === 0 && (!canContinueFromProgram || createProgram.isPending)) ||
                (currentStep === 1 && !canContinueFromWorkouts) ||
                (currentStep === 2 && !canContinueFromExercises)
              }
              loading={currentStep === 0 && createProgram.isPending}
            />
          ) : (
            <Button label="Finish" onPress={goToEditor} disabled={!programId || !hasSchedule} />
          )}
        </View>
      </Card>
    </ScrollView>
    {actionsFor ? (
      <Modal visible animationType="fade" transparent onRequestClose={() => setActionsFor(null)}>
        <Pressable style={sheetStyles.backdrop} onPress={() => setActionsFor(null)}>
          <Pressable style={[sheetStyles.sheet, { backgroundColor: theme.surface.raised, borderColor: theme.border.default }]}>
            <Text style={[sheetStyles.sheetTitle, { color: theme.text.primary }]} numberOfLines={1}>
              {exerciseName(actionsFor)}
            </Text>
            <Button
              label="Edit"
              variant="secondary"
              onPress={() => {
                setEditState({
                  dayTypeId: actionsFor.dayTypeId,
                  exerciseId: actionsFor.id,
                  exerciseName: exerciseName(actionsFor),
                  prescription: actionsFor.prescription,
                  notes: actionsFor.notes ?? '',
                });
                setActionsFor(null);
              }}
            />
            <Button
              label="Remove"
              variant="secondary"
              onPress={() => {
                removeExercise.mutate(actionsFor);
                setActionsFor(null);
              }}
            />
            <Button label="Cancel" variant="secondary" onPress={() => setActionsFor(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    ) : null}

    {editState ? (
      <ExerciseEditSheet
        state={editState}
        isSaving={patchExercise.isPending}
        onClose={() => setEditState(null)}
        onSave={(next) =>
          patchExercise.mutate({
            dayTypeId: next.dayTypeId,
            exerciseId: next.exerciseId,
            body: { prescription: next.prescription, notes: next.notes || null },
          })
        }
        onRemove={() => {
          const target = (selectedWorkoutDetail.data?.exercises ?? []).find((item) => item.id === editState.exerciseId);
          setEditState(null);
          if (target) removeExercise.mutate(target);
        }}
      />
    ) : null}

    {selectedWorkout && addExerciseOpen ? (
      <AddExercisePicker
        open
        exercises={exercises}
        exercisesLoading={exercisesLoading}
        exercisesError={exercisesError}
        onRetryExercises={() => refetchExercises()}
        onClose={() => setAddExerciseOpen(false)}
        onCreateExercise={(name) => createExercise.mutateAsync({ name })}
        isCreatingExercise={createExercise.isPending}
        onAddExercise={(exerciseId, prescription) =>
          addExercise.mutate({ dayTypeId: selectedWorkout.dayTypeId, exerciseId, prescription })
        }
        isAddingExercise={addExercise.isPending}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  header: {
    gap: spacing[4],
  },
  eyebrow: {
    fontSize: typeScale.label.fontSize,
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    marginTop: spacing[8],
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  exerciseSummary: { flex: 1, minWidth: 0, gap: spacing[4] },
  stack: {
    gap: spacing[12],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[8],
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    borderWidth: 1,
    padding: spacing[16],
    gap: spacing[8],
  },
  sheetTitle: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600', marginBottom: spacing[4] },
});
