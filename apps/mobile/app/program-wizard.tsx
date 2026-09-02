import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { IconButton } from '../src/components/IconButton';
import { Toast } from '../src/components/Toast';
import { ExerciseEditSheet, type ExerciseEditState } from '../src/components/ExerciseEditSheet';
import { Sheet } from '../src/components/Sheet';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Select, type SelectOption } from '../src/components/Select';
import { ExercisePickerV2 } from '../src/components/exercise-picker/ExercisePickerV2';
import { WeekScheduleEditor } from '../src/components/WeekScheduleEditor';
import { useApiClient } from '../src/lib/api-client';
import { useScreenTopPadding, useStackBottomPadding } from '../src/lib/useScreenInsets';
import { restoreExerciseOrder } from '@setframe/domain';
import { summarizePrescription } from '../src/lib/prescription';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';
import { radius } from '@setframe/design-tokens';
import { useActionFeedback } from '../src/lib/useActionFeedback';

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
  { key: 'program', title: 'Program', description: 'Your overall training plan over time.' },
  { key: 'workouts', title: 'Workouts', description: 'Reusable training days inside your program.' },
  { key: 'exercises', title: 'Exercises', description: 'What you perform inside the selected workout.' },
  { key: 'schedule', title: 'Schedule', description: 'Assign workouts to your week.' },
];

/**
 * What an exercise added through the picker is prescribed.
 *
 * `POST /day-types/:id/exercises` REQUIRES a prescription — posting
 * `{ exerciseId }` alone fails with
 * "body/prescription Invalid input: expected object, received undefined".
 * The single-select picker this replaced had a configure step that supplied
 * one; the multi-select picker deliberately does not ask, so it has to send
 * the default instead of nothing.
 *
 * Blank targets are legitimate (story 19), so this carries a set count and no
 * reps — enough for the session to instantiate a row to log into, without
 * inventing a rep target the user never chose.
 */
const DEFAULT_PICKED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };

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
  const feedback = useActionFeedback();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  /* This screen inherits `headerShown: false` from the root Stack, so
     unlike session-summary/exercise-history nothing reserves the status
     bar for it. */
  const topPadding = useScreenTopPadding();
  const bottomPadding = useStackBottomPadding();

  const [currentStep, setCurrentStep] = useState(0);
  const [programName, setProgramName] = useState('My Training Program');
  const [mode, setMode] = useState<'perpetual' | 'block'>('perpetual');
  const [programId, setProgramId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [workoutNameError, setWorkoutNameError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<WizardWorkoutDraft[]>([]);
  const [selectedWorkoutTempId, setSelectedWorkoutTempId] = useState<string | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<DayTypeExercise | null>(null);
  const [editState, setEditState] = useState<ExerciseEditState | null>(null);
  const [undoState, setUndoState] = useState<{ target: DayTypeExercise; originalIndex: number } | null>(null);
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, string | null>>({});
  const [workoutActionsFor, setWorkoutActionsFor] = useState<WizardWorkoutDraft | null>(null);
  const [renamingWorkout, setRenamingWorkout] = useState<WizardWorkoutDraft | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingWorkoutRemoval, setPendingWorkoutRemoval] = useState<{ workout: WizardWorkoutDraft; exerciseCount: number } | null>(
    null,
  );
  const [workoutUndoState, setWorkoutUndoState] = useState<{
    name: string;
    exercises: DayTypeExercise[];
    position: number;
  } | null>(null);

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
    // Story 25 — same fix as the web wizard: associate immediately with
    // the program being built rather than leaving it an orphan.
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', { ...body, programId }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['day-types'] });
      const nextWorkout = { tempId: nextTempId('workout'), dayTypeId: created.id, name: created.name };
      setWorkouts((current) => [...current, nextWorkout]);
      setSelectedWorkoutTempId(nextWorkout.tempId);
      setWorkoutName('');
    },
    onError: () => Alert.alert('Could not create workout', 'Please try again.'),
  });

  const renameDayType = useMutation({
    mutationFn: ({ dayTypeId, name }: { dayTypeId: string; name: string }) => api.patch<DayType>(`/day-types/${dayTypeId}`, { name }),
    onSuccess: (updated, vars) => {
      setWorkouts((current) => current.map((w) => (w.dayTypeId === vars.dayTypeId ? { ...w, name: updated.name } : w)));
      setRenamingWorkout(null);
    },
    onError: () => Alert.alert('Could not rename workout', 'Please try again.'),
  });

  /**
   * Known gap, shared with `removeExercise`/`undoRemoveExercise` below:
   * undo restores each exercise from its `prescription` only. Per-set
   * overrides in `dayTypeExercisePlannedSet` aren't in the
   * `GET /day-types/:id` response at all, so there's nothing to restore
   * them from without new backend surface — narrow in practice, since
   * planned-set overrides are a full-editor-only feature.
   */
  const removeWorkout = useMutation({
    mutationFn: async (workout: WizardWorkoutDraft) => {
      const detail = await api.get<DayTypeDetail>(`/day-types/${workout.dayTypeId}`).catch(() => null);
      const position = workouts.findIndex((w) => w.tempId === workout.tempId);
      await api.del(`/day-types/${workout.dayTypeId}`);
      return { workout, exercises: detail?.exercises ?? [], position };
    },
    onSuccess: async ({ workout, exercises, position }) => {
      setWorkouts((current) => current.filter((w) => w.tempId !== workout.tempId));
      setSelectedWorkoutTempId((current) => (current === workout.tempId ? null : current));
      // The API cascade-deletes this workout's programScheduleSlot rows —
      // without this, a day already assigned to the removed workout keeps
      // a ghost assignment the schedule step can't clear.
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
      setWorkoutUndoState({ name: workout.name, exercises, position });
    },
    onError: () => Alert.alert('Could not remove workout', 'Please try again.'),
  });

  const undoRemoveWorkout = useMutation({
    mutationFn: async ({ name, exercises, position }: { name: string; exercises: DayTypeExercise[]; position: number }) => {
      const created = await api.post<DayType>('/day-types', { name, programId });
      for (const exercise of exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        await api.post(`/day-types/${created.id}/exercises`, {
          exerciseId: exercise.exerciseId,
          prescription: exercise.prescription,
          notes: exercise.notes ?? undefined,
        });
      }
      return { created, position };
    },
    onSuccess: ({ created, position }) => {
      const nextWorkout = { tempId: nextTempId('workout'), dayTypeId: created.id, name: created.name };
      setWorkouts((current) => {
        const next = current.slice();
        next.splice(Math.min(position, next.length), 0, nextWorkout);
        return next;
      });
    },
    onError: () => Alert.alert('Could not restore the workout', 'Please try again.'),
  });

  function handleAddWorkout() {
    const trimmed = workoutName.trim();
    if (!trimmed) return;
    if (workouts.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      setWorkoutNameError(`A workout named "${trimmed}" already exists.`);
      return;
    }
    setWorkoutNameError(null);
    createDayType.mutate({ name: trimmed });
  }

  async function requestRemoveWorkout(workout: WizardWorkoutDraft) {
    const detail = await api.get<DayTypeDetail>(`/day-types/${workout.dayTypeId}`).catch(() => null);
    const exerciseCount = detail?.exercises.length ?? 0;
    if (exerciseCount > 0) {
      setPendingWorkoutRemoval({ workout, exerciseCount });
    } else {
      removeWorkout.mutate(workout);
    }
  }

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    // Errors surface inline inside AddExercisePicker (which preserves the
    // typed name for retry) rather than as a modal Alert.
  
    onError: feedback.report('Could not create that exercise. Try again.'),
  });

  /**
   * Adds every picked exercise in the order picked. Sequential, because
   * sortOrder comes from insertion order server-side and the picker promises
   * that order.
   */
  const addExercisesToWorkout = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      const dayTypeId = selectedWorkout!.dayTypeId;
      for (const exerciseId of exerciseIds) {
        await api.post(`/day-types/${dayTypeId}/exercises`, {
          exerciseId,
          prescription: DEFAULT_PICKED_PRESCRIPTION,
        });
      }
    },
    onSuccess: async () => {
      setAddExerciseOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['day-type', selectedWorkout!.dayTypeId] });
    },
  
    onError: feedback.report('Could not add those exercises. Try again.'),
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

  const goToEditor = () => router.replace('/(tabs)/training');

  /* Leaving keeps whatever exists. The program is created at step one, so
     there is always something real to return to rather than a half-written
     record to clean up. */
  const leaveSetup = () => router.replace('/(tabs)/training');

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
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>New here?</Text>
          {/* The only exit. Every other Cancel on this screen belongs to a
              sub-sheet, so a user who changed their mind could leave only
              by the OS back gesture. Whatever has been created so far is
              already saved — a program with no workouts, or workouts with
              no schedule, are both valid states you can return to. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave guided setup"
            onPress={leaveSetup}
            hitSlop={8}
            testID="wizard-leave"
          >
            <Text style={[styles.leave, { color: theme.action.primary }]}>
              {programId ? 'Save & exit' : 'Cancel'}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.title, { color: theme.text.primary }]}>Guided program setup</Text>
        <Text style={{ color: theme.text.secondary }}>
          Build the basics in four focused steps. You can fine-tune everything else on web anytime.
        </Text>
        <Text style={[styles.stepIndicator, { color: theme.action.primary }]}>
          Step {currentStep + 1} of {steps.length} · {steps[currentStep]!.title}
        </Text>
        <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
          {steps[currentStep]!.description}
        </Text>
        <Text
          style={[
            styles.hierarchyHint,
            { color: theme.text.secondary, backgroundColor: theme.surface.sunken },
          ]}
        >
          {'4-Day Strength Plan\n└─ Upper A\n   ├─ Squat\n   └─ Bench Press'}
        </Text>
      </View>

      <Card>
        {currentStep === 0 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>1. Start with the program</Text>
            <Text style={{ color: theme.text.secondary }}>
              Your overall training plan over time — e.g. "4-Day Strength Plan." Choose whether it repeats every week or runs as a simple block.
            </Text>
            <Input label="Program name" value={programName} onChangeText={setProgramName} placeholder="Fall strength block" />
            <Select label="Program mode" value={mode} onChange={setMode} options={modeOptions} />
          </View>
        ) : null}

        {currentStep === 1 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>2. Create your first workouts</Text>
            <Text style={{ color: theme.text.secondary }}>
              Workouts are reusable training days inside your program — like Upper A, Lower B, or Recovery. You'll add exercises inside each workout in the next step.
            </Text>
            <Input
              label="Workout name"
              value={workoutName}
              onChangeText={(next) => {
                setWorkoutName(next);
                if (workoutNameError) setWorkoutNameError(null);
              }}
              placeholder="Upper A"
              errorMessage={workoutNameError ?? undefined}
            />
            <Button label="Add workout" variant="secondary" onPress={handleAddWorkout} disabled={!workoutName.trim()} loading={createDayType.isPending} />
            {workoutUndoState ? (
              <Toast
                variant="success"
                message="Workout removed."
                actionLabel="Undo"
                onAction={() => {
                  if (undoRemoveWorkout.isPending) return;
                  const restore = workoutUndoState;
                  setWorkoutUndoState(null);
                  undoRemoveWorkout.mutate(restore);
                }}
                onDismiss={() => setWorkoutUndoState(null)}
              />
            ) : null}
            {workouts.length === 0 ? (
              <Text style={{ color: theme.text.secondary }}>No workouts yet. Add at least one to continue.</Text>
            ) : (
              workouts.map((workout) => (
                <View key={workout.tempId} style={styles.workoutRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={workout.name}
                      variant={selectedWorkoutTempId === workout.tempId ? 'primary' : 'secondary'}
                      onPress={() => setSelectedWorkoutTempId(workout.tempId)}
                    />
                  </View>
                  <IconButton
                    icon={MoreVertical}
                    variant="subtle"
                    accessibilityLabel={`Actions for ${workout.name}`}
                    onPress={() => setWorkoutActionsFor(workout)}
                  />
                </View>
              ))
            )}
          </View>
        ) : null}

        {currentStep === 2 ? (
          <View style={styles.stack}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>3. Add exercises</Text>
            <Text style={{ color: theme.text.secondary }}>
              Exercises are what you actually perform inside the selected workout — like Squat, RDL, or Bench Press. Pick one workout at a time and add its core exercises with a simple prescription.
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
            /* A schedule is not required to finish. A program with workouts
               and no schedule is a valid, useful thing — you train from it
               ad hoc and add the week later — and demanding one here, with
               no exit, was a dead end. */
            <Button label="Finish" onPress={goToEditor} disabled={!programId} />
          )}
        </View>
      </Card>
    </ScrollView>
    {actionsFor ? (
      <Sheet
        visible
        onRequestClose={() => setActionsFor(null)}
        dismissOnBackdropPress
        maxHeightPercent={50}
        gap={spacing[8]}
      >
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
      </Sheet>
    ) : null}

    {workoutActionsFor ? (
      <Sheet
        visible
        onRequestClose={() => setWorkoutActionsFor(null)}
        dismissOnBackdropPress
        maxHeightPercent={50}
        gap={spacing[8]}
      >
        <Text style={[sheetStyles.sheetTitle, { color: theme.text.primary }]} numberOfLines={1}>
          {workoutActionsFor.name}
        </Text>
        <Button
          label="Rename"
          variant="secondary"
          onPress={() => {
            setRenameDraft(workoutActionsFor.name);
            setRenamingWorkout(workoutActionsFor);
            setWorkoutActionsFor(null);
          }}
        />
        <Button
          label="Remove"
          variant="destructive"
          onPress={() => {
            void requestRemoveWorkout(workoutActionsFor);
            setWorkoutActionsFor(null);
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => setWorkoutActionsFor(null)} />
      </Sheet>
    ) : null}

    {renamingWorkout ? (
      <Sheet visible onRequestClose={() => setRenamingWorkout(null)} maxHeightPercent={50} gap={spacing[8]}>
        <Text style={[sheetStyles.sheetTitle, { color: theme.text.primary }]}>Rename workout</Text>
        <Input label="Workout name" value={renameDraft} onChangeText={setRenameDraft} />
        <Button
          label="Save"
          disabled={!renameDraft.trim() || renameDayType.isPending}
          loading={renameDayType.isPending}
          onPress={() => renameDayType.mutate({ dayTypeId: renamingWorkout.dayTypeId, name: renameDraft.trim() })}
        />
        <Button label="Cancel" variant="secondary" onPress={() => setRenamingWorkout(null)} />
      </Sheet>
    ) : null}

    {pendingWorkoutRemoval ? (
      <Sheet visible onRequestClose={() => setPendingWorkoutRemoval(null)} maxHeightPercent={50} gap={spacing[8]}>
        <Text style={[sheetStyles.sheetTitle, { color: theme.text.primary }]}>
          Remove {pendingWorkoutRemoval.workout.name}?
        </Text>
        <Text style={{ color: theme.text.secondary }}>
          This workout has {pendingWorkoutRemoval.exerciseCount} exercise
          {pendingWorkoutRemoval.exerciseCount === 1 ? '' : 's'} — removing it removes those workout-specific entries
          too. You can undo right after.
        </Text>
        <Button
          label="Remove workout"
          variant="destructive"
          loading={removeWorkout.isPending}
          onPress={() => {
            removeWorkout.mutate(pendingWorkoutRemoval.workout);
            setPendingWorkoutRemoval(null);
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={() => setPendingWorkoutRemoval(null)} />
      </Sheet>
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

    {/* The shared multi-select picker (story 78), replacing the single-select
        one that added one exercise and closed — building a day meant
        reopening it per exercise. */}
    <Modal
      visible={!!selectedWorkout && addExerciseOpen}
      animationType="slide"
      onRequestClose={() => setAddExerciseOpen(false)}
    >
      {selectedWorkout ? (
        <ExercisePickerV2
          exercises={exercises}
          title={`Add to ${selectedWorkout.name ?? 'workout'}`}
          onCancel={() => setAddExerciseOpen(false)}
          onAdd={(ids) => addExercisesToWorkout.mutate(ids)}
          busy={addExercisesToWorkout.isPending}
        />
      ) : null}
    </Modal>
      {feedback.node}
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
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leave: { fontSize: typeScale.helper.fontSize, fontWeight: '600' },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
    marginTop: spacing[8],
  },
  hierarchyHint: {
    fontSize: typeScale.caption.fontSize,
    lineHeight: typeScale.caption.fontSize * 1.5,
    borderRadius: radius.small,
    padding: spacing[8],
    marginTop: spacing[4],
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
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[8],
  },
});

const sheetStyles = StyleSheet.create({
  sheetTitle: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600', marginBottom: spacing[4] },
});
