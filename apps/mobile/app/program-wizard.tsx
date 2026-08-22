import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { Select, type SelectOption } from '../src/components/Select';
import { useApiClient } from '../src/lib/api-client';
import { summarizePrescription } from '../src/lib/prescription';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

interface WizardWorkoutDraft {
  tempId: string;
  dayTypeId: string;
  name: string;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_SCHEDULE_SLOTS: ProgramScheduleSlot[] = [];

const modeOptions: SelectOption<'perpetual' | 'block'>[] = [
  { value: 'perpetual', label: 'Repeats weekly' },
  { value: 'block', label: 'Fixed block/cycle' },
];

const prescriptionOptions: SelectOption<string>[] = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];

const steps = [
  { key: 'program', title: 'Program', description: 'Name it and choose how it repeats.' },
  { key: 'workouts', title: 'Workouts', description: 'Create your first workout templates.' },
  { key: 'exercises', title: 'Exercises', description: 'Add the main exercises for each workout.' },
  { key: 'schedule', title: 'Schedule', description: 'Assign workouts to your week.' },
];

function emptyPrescription(kind: string): Prescription {
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
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');
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

  const selectedWorkoutDetail = useQuery({
    queryKey: ['day-type', selectedWorkout?.dayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedWorkout?.dayTypeId}`),
    enabled: Boolean(selectedWorkout?.dayTypeId),
  });

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
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setSelectedExerciseId(created.id);
      setCustomExerciseName('');
    },
    onError: () => Alert.alert('Could not create exercise', 'Please try again.'),
  });

  const addExercise = useMutation({
    mutationFn: (body: { dayTypeId: string; exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${body.dayTypeId}/exercises`, { exerciseId: body.exerciseId, prescription: body.prescription }),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', vars.dayTypeId] });
    },
    onError: () => Alert.alert('Could not add exercise', 'Please try again.'),
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
                    {exercisesLoading ? (
                      <Text style={{ color: theme.text.secondary }}>Loading exercise catalog…</Text>
                    ) : exercisesError ? (
                      <View style={styles.chipRow}>
                        <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load exercises.</Text>
                        <Button label="Retry" variant="secondary" onPress={() => refetchExercises()} />
                      </View>
                    ) : (
                      <Select
                        label="Exercise"
                        value={selectedExerciseId}
                        onChange={setSelectedExerciseId}
                        options={[
                          { value: '', label: 'Select exercise' },
                          ...exercises.map((exercise) => ({
                            value: exercise.id,
                            label: exercise.isCustom ? `${exercise.name} (custom)` : exercise.name,
                          })),
                        ]}
                      />
                    )}
                    <Select
                      label="Prescription"
                      value={prescriptionKind}
                      onChange={setPrescriptionKind}
                      options={prescriptionOptions}
                    />
                    <Input
                      label="Need a custom exercise?"
                      value={customExerciseName}
                      onChangeText={setCustomExerciseName}
                      placeholder="Cable face pull"
                    />
                    <Button
                      label="Create exercise"
                      variant="secondary"
                      onPress={() => customExerciseName.trim() && createExercise.mutate({ name: customExerciseName.trim() })}
                      disabled={!customExerciseName.trim() || exercisesLoading}
                      loading={createExercise.isPending}
                    />
                    <Button
                      label={`Add to ${selectedWorkout.name}`}
                      onPress={() =>
                        selectedExerciseId &&
                        addExercise.mutate({
                          dayTypeId: selectedWorkout.dayTypeId,
                          exerciseId: selectedExerciseId,
                          prescription: emptyPrescription(prescriptionKind),
                        })
                      }
                      disabled={!selectedExerciseId}
                      loading={addExercise.isPending}
                    />
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
                            <Text style={{ color: theme.text.primary, fontWeight: '600' }}>
                              {exercises.find((item) => item.id === exercise.exerciseId)?.name ?? 'Exercise'}
                            </Text>
                            <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                              {summarizePrescription(exercise.prescription)}
                            </Text>
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
              dayNames.map((dayName, dayIndex) => {
                const assignedDayTypeId = scheduleByDay[dayIndex] ?? '';
                const assignedWorkout = workouts.find((workout) => workout.dayTypeId === assignedDayTypeId) ?? null;
                const slot = scheduleSlots.find(
                  (item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1),
                );
                return (
                  <Card key={dayName}>
                    <Text style={{ color: theme.text.primary, fontWeight: '600' }}>{dayName}</Text>
                    <Text style={{ color: theme.text.secondary }}>{assignedWorkout?.name ?? 'Rest / unassigned'}</Text>
                    <Select
                      label="Workout"
                      value={assignedDayTypeId}
                      onChange={(nextDayTypeId) => {
                        if (!nextDayTypeId) {
                          if (slot) removeSlot.mutate(slot.id);
                          setScheduleByDay((current) => ({ ...current, [dayIndex]: null }));
                          return;
                        }
                        setScheduleByDay((current) => ({ ...current, [dayIndex]: nextDayTypeId }));
                        upsertSlot.mutate({
                          id: slot?.id,
                          dayTypeId: nextDayTypeId,
                          weekNumber: mode === 'block' ? 1 : null,
                          dayIndex,
                          sortOrder: dayIndex,
                        });
                      }}
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...workouts.map((workout) => ({ value: workout.dayTypeId, label: workout.name })),
                      ]}
                    />
                  </Card>
                );
              })
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
