import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react-native';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Toast } from '../../src/components/Toast';
import { WeekScheduleEditor } from '../../src/components/WeekScheduleEditor';
import { AddExercisePicker } from '../../src/components/AddExercisePicker';
import { ExerciseEditSheet, type ExerciseEditState } from '../../src/components/ExerciseEditSheet';
import { useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { summarizePrescription } from '../../src/lib/prescription';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The Training tab: where a program is built — programs, workouts,
 * exercises and the weekly schedule.
 *
 * This tab used to hold the active workout *logger*, which was wrong in
 * both directions: there was no way to build a program on mobile at all
 * (this screen existed only as a buried, read-only preview telling the
 * user to go use the web app), and a session-scoped screen sitting in a
 * tab had to invent a session to have something to render — which
 * created duplicate workouts and destroyed rest days. The logger now
 * lives at `app/workout/[sessionId].tsx`, reached with an explicit id.
 *
 * Training's only remaining relationship to a session is the resume
 * banner below: a way back, never a way to start or log one.
 */
export default function ProgramEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  /* Story 07: a tab left mounted across midnight must not keep querying
     yesterday — useLocalDate re-renders on the rollover. */
  const localDate = useLocalDate();
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseEditState | null>(null);
  /* Which day the schedule is mid-write on, so WeekScheduleEditor can show
     an inline spinner on that row rather than blocking the whole grid. */
  const [pendingDayIndex, setPendingDayIndex] = useState<number | null>(null);
  /* The workout "held" for assignment — tapping a day assigns this one. */
  const [heldWorkoutId, setHeldWorkoutId] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });

  /* Training is where a program is built; it does not log workouts. Its only
     relationship to an active session is offering a way back to one, so a
     user who wandered here mid-workout is not stranded. Read-only — this
     screen never starts, resumes or mutates a session. */
  const todayQuery = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => api.get<{ sessions: { id: string; status: string }[] }>(
      `/dashboard/today?localDate=${localDate}`,
    ),
  });
  /* `sessions` is optional-chained rather than assumed: a client can outrun
     the API and receive an older payload shape, and a resume banner is not
     worth taking the whole Training tab down for. Same reasoning as
     `isProgressOverview` in packages/domain. */
  const activeSessionId = todayQuery.data?.sessions?.find((s) => s.status === 'in_progress')?.id ?? null;
  const activeProgram = useMemo(
    () => programsQuery.data?.find((program) => program.isActive) ?? programsQuery.data?.[0] ?? null,
    [programsQuery.data],
  );
  // Distinct from `activeProgram`'s fallback-to-first behavior above (kept
  // so there's always something to view/select) — this is specifically
  // "does any program actually have isActive: true", so the switcher below
  // can surface a single non-active program too, not just >1 programs.
  const hasActiveProgram = programsQuery.data?.some((program) => program.isActive) ?? false;
  const selectedProgram = useMemo(
    () => programsQuery.data?.find((program) => program.id === selectedProgramId) ?? activeProgram,
    [programsQuery.data, selectedProgramId, activeProgram],
  );

  // Same fix as web (Story 24): viewing a non-active program must never
  // implicitly activate it. This only ever picks a *default* selection —
  // once on load, or if the previous selection stopped existing — and
  // never overwrites a manual selection.
  useEffect(() => {
    if (!programsQuery.data) return;
    const stillExists = programsQuery.data.some((program) => program.id === selectedProgramId);
    if (!stillExists) setSelectedProgramId(activeProgram?.id ?? programsQuery.data[0]?.id ?? null);
  }, [programsQuery.data, selectedProgramId, activeProgram]);

  const activateMutation = useMutation({
    mutationFn: (programId: string) => api.post<TrainingProgram>(`/programs/${programId}/activate`),
    onSuccess: (activated) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setToast({ variant: 'success', message: `${activated.name} is now your active program.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not switch your active program.' }),
  });

  const scheduleSlotsQuery = useQuery({
    queryKey: ['schedule-slots', selectedProgram?.id],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${selectedProgram?.id}/schedule-slots`),
    enabled: Boolean(selectedProgram?.id),
  });

  /* Story 25 scoped workouts to their owning program through an explicit
     `program_day_type` membership rather than a column on `day_type`, so
     the program-scoped endpoint is the only correct source here — a flat
     `/day-types` would offer another program's workouts for scheduling. */
  const dayTypesQuery = useQuery({
    queryKey: ['program-day-types', selectedProgram?.id],
    queryFn: () => api.get<DayType[]>(`/programs/${selectedProgram?.id}/day-types`),
    enabled: Boolean(selectedProgram?.id),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  /* Editing mutations.
   *
   * Every one of these already existed on mobile — inside `program-wizard`,
   * reachable exactly once during onboarding and never again. The wizard
   * carried 13 mutations while this screen carried one (`activate`), which
   * is how mobile ended up able to *create* a program but never to change
   * it. These reuse the wizard's proven request shapes rather than
   * inventing new ones; ADR 0005's intent/fact split is preserved because
   * they only ever touch `day_type`, `day_type_exercise` and
   * `program_schedule_slot` — never a `workout_session`. */

  const createExercise = useMutation({
    mutationFn: (name: string) => api.post<Exercise>('/exercises', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  });

  const createWorkout = useMutation({
    mutationFn: (name: string) =>
      api.post<DayType>('/day-types', { name, programId: selectedProgram?.id }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['day-types'] });
      setSelectedDayTypeId(created.id);
      setNewWorkoutName('');
      setToast({ variant: 'success', message: `${created.name} added.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not add that workout.' }),
  });

  const addExerciseToWorkout = useMutation({
    mutationFn: ({ dayTypeId, exerciseId, prescription }: { dayTypeId: string; exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${dayTypeId}/exercises`, { exerciseId, prescription }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
      setShowAddExercise(false);
      setToast({ variant: 'success', message: 'Exercise added.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not add that exercise.' }),
  });

  const updateExercise = useMutation({
    // `notes` travels with the prescription: ExerciseEditSheet edits both,
    // and sending only the prescription silently discarded a note the user
    // had just typed and been told was saved.
    mutationFn: ({ dayTypeId, exerciseId, prescription, notes }: { dayTypeId: string; exerciseId: string; prescription: Prescription; notes: string }) =>
      api.patch(`/day-types/${dayTypeId}/exercises/${exerciseId}`, { prescription, notes: notes || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
      setEditingExercise(null);
      setToast({ variant: 'success', message: 'Exercise updated.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not update that exercise.' }),
  });

  const removeExercise = useMutation({
    mutationFn: ({ dayTypeId, exerciseId }: { dayTypeId: string; exerciseId: string }) =>
      api.del(`/day-types/${dayTypeId}/exercises/${exerciseId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
      setEditingExercise(null);
      setToast({ variant: 'success', message: 'Exercise removed.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not remove that exercise.' }),
  });

  const upsertSlot = useMutation({
    mutationFn: (body: { id?: string; dayTypeId: string; weekNumber: number | null; dayIndex: number; sortOrder: number }) =>
      body.id
        ? api.patch(`/programs/${selectedProgram?.id}/schedule-slots/${body.id}`, body)
        : api.post(`/programs/${selectedProgram?.id}/schedule-slots`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgram?.id] });
      setPendingDayIndex(null);
    },
    onError: () => {
      setPendingDayIndex(null);
      setToast({ variant: 'error', message: 'Could not update your schedule.' });
    },
  });

  const removeSlot = useMutation({
    mutationFn: (slotId: string) => api.del(`/programs/${selectedProgram?.id}/schedule-slots/${slotId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgram?.id] });
      setPendingDayIndex(null);
    },
    onError: () => {
      setPendingDayIndex(null);
      setToast({ variant: 'error', message: 'Could not clear that day.' });
    },
  });

  const weekOneSlots = useMemo(
    () =>
      (scheduleSlotsQuery.data ?? [])
        .filter((slot) => slot.weekNumber === null || slot.weekNumber === 1)
        .sort((a, b) => a.dayIndex - b.dayIndex),
    [scheduleSlotsQuery.data],
  );

  const dayTypeById = useMemo(() => {
    const map = new Map<string, DayType>();
    (dayTypesQuery.data ?? []).forEach((dayType) => map.set(dayType.id, dayType));
    return map;
  }, [dayTypesQuery.data]);

  const exerciseNameById = useMemo(() => {
    const map = new Map<string, string>();
    (exercisesQuery.data ?? []).forEach((exercise) => map.set(exercise.id, exercise.name));
    return map;
  }, [exercisesQuery.data]);

  const programWorkouts = dayTypesQuery.data ?? [];

  /* WeekScheduleEditor wants dayIndex → assigned workout id, with absent
     meaning "rest". */
  const assignmentsByDay = useMemo(() => {
    const map: Record<number, string | null> = {};
    weekOneSlots.forEach((slot) => {
      map[slot.dayIndex] = slot.dayTypeId;
    });
    return map;
  }, [weekOneSlots]);

  // Switching the viewed program must not leave a day selected from the
  // previous one's schedule (Story 26's "no leaking selection" rule
  // applies here too, even though this screen is read-only).
  useEffect(() => {
    setSelectedDayTypeId(null);
  }, [selectedProgram?.id]);

  useEffect(() => {
    if (!selectedDayTypeId && weekOneSlots.length > 0) {
      setSelectedDayTypeId(weekOneSlots[0]!.dayTypeId);
    }
  }, [selectedDayTypeId, weekOneSlots]);

  const selectedDayTypeDetailQuery = useQuery({
    queryKey: ['day-type', selectedDayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`),
    enabled: Boolean(selectedDayTypeId),
  });

  const isLoading = programsQuery.isLoading || dayTypesQuery.isLoading;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas }]}>
        <ActivityIndicator color={theme.action.primary} />
      </View>
    );
  }

  if (programsQuery.isError || dayTypesQuery.isError) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16] }]}>
        <Text style={{ color: theme.text.primary, textAlign: 'center' }}>Couldn&apos;t load your training program.</Text>
      </View>
    );
  }

  if (!activeProgram) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16], gap: spacing[16] }]}>
        <Text style={{ color: theme.text.primary, textAlign: 'center', fontWeight: '600' }}>No training program yet</Text>
        <Text style={{ color: theme.text.secondary, textAlign: 'center' }}>
          Set up your first program with a few guided steps.
        </Text>
        <Button label="Start guided setup" onPress={() => router.push('/program-wizard')} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      {/* The one place Training acknowledges a live workout: a way back to
          it. Logging happens on the session's own screen, not here. */}
      {activeSessionId ? (
        <Card style={{ backgroundColor: theme.action.accentSubtle }}>
          <Text style={{ color: theme.text.primary, fontWeight: '600' }}>Workout in progress</Text>
          <Text style={{ color: theme.text.secondary }}>You have a workout started today.</Text>
          <Button
            label="Resume workout"
            onPress={() => router.push({ pathname: '/workout/[sessionId]', params: { sessionId: activeSessionId } })}
          />
        </Card>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{selectedProgram?.name ?? activeProgram.name}</Text>
        <Badge
          label={selectedProgram?.isActive ? 'Active' : 'Inactive'}
          tone={selectedProgram?.isActive ? 'success' : 'neutral'}
        />
      </View>

      {/* Story 24 — only shown once there's an actual choice to make; the
          header above already makes the single-program case clear. */}
      {programsQuery.data && (programsQuery.data.length > 1 || !hasActiveProgram) ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Your programs</Text>
          {programsQuery.data.map((program) => (
            <View key={program.id} style={styles.programRow}>
              <Pressable
                onPress={() => setSelectedProgramId(program.id)}
                accessibilityRole="button"
                accessibilityLabel={`View ${program.name}`}
                style={styles.programRowName}
              >
                <Text
                  style={[
                    styles.bodyText,
                    { color: theme.text.primary, fontWeight: program.id === selectedProgram?.id ? '600' : '400' },
                  ]}
                  numberOfLines={1}
                >
                  {program.name}
                </Text>
                {program.isActive ? <Badge label="Active" tone="success" /> : null}
              </Pressable>
              <Button
                label={program.isActive ? 'Active' : 'Set active'}
                variant="secondary"
                fullWidth={false}
                disabled={program.isActive}
                loading={activateMutation.isPending && activateMutation.variables === program.id}
                onPress={() => activateMutation.mutate(program.id)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      {/* Workouts — creating one used to be possible only inside the
          onboarding wizard, so a user who finished setup could never add
          another without switching to the web app. */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Workouts</Text>
        {programWorkouts.length === 0 ? (
          <Text style={{ color: theme.text.secondary }}>
            No workouts yet. Add one — a reusable training day like &quot;Upper A&quot;.
          </Text>
        ) : (
          programWorkouts.map((workout) => (
            <Pressable
              key={workout.id}
              onPress={() => setSelectedDayTypeId(workout.id)}
              style={[
                styles.dayRow,
                workout.id === selectedDayTypeId
                  ? { backgroundColor: theme.action.accentSubtle, borderRadius: spacing[8] }
                  : null,
              ]}
            >
              <Text style={{ color: theme.text.primary, flex: 1 }}>{workout.name}</Text>
              <ChevronRight size={16} color={theme.text.secondary} />
            </Pressable>
          ))
        )}
        <View style={styles.addWorkoutRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="New workout"
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
              placeholder="e.g. Upper A"
            />
          </View>
        </View>
        <Button
          label="Add workout"
          variant="secondary"
          loading={createWorkout.isPending}
          onPress={() => {
            const name = newWorkoutName.trim();
            if (!name) {
              setToast({ variant: 'error', message: 'Give the workout a name first.' });
              return;
            }
            createWorkout.mutate(name);
          }}
        />
      </Card>

      {/* Schedule — assigning days was previously web-only. Reuses the same
          WeekScheduleEditor the onboarding wizard already drives. */}
      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Weekly schedule</Text>
        <WeekScheduleEditor
          workouts={programWorkouts.map((workout) => ({ id: workout.id, name: workout.name }))}
          assignmentsByDay={assignmentsByDay}
          selectedWorkoutId={heldWorkoutId}
          onSelectWorkout={setHeldWorkoutId}
          isLoading={scheduleSlotsQuery.isLoading}
          pendingDayIndex={pendingDayIndex}
          emptyMessage="Add a workout above before scheduling your week."
          errorMessage={scheduleSlotsQuery.isError ? "Couldn't load your schedule." : null}
          onRetry={() => scheduleSlotsQuery.refetch()}
          onAssignDay={(dayIndex, dayTypeId) => {
            setPendingDayIndex(dayIndex);
            const existing = weekOneSlots.find((slot) => slot.dayIndex === dayIndex);
            upsertSlot.mutate({
              id: existing?.id,
              dayTypeId,
              weekNumber: existing?.weekNumber ?? null,
              dayIndex,
              sortOrder: 0,
            });
          }}
          onClearDay={(dayIndex) => {
            const existing = weekOneSlots.find((slot) => slot.dayIndex === dayIndex);
            if (!existing) return;
            setPendingDayIndex(dayIndex);
            removeSlot.mutate(existing.id);
          }}
        />
      </Card>

      {selectedDayTypeId ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            {dayTypeById.get(selectedDayTypeId)?.name ?? 'Workout'}
          </Text>
          {selectedDayTypeDetailQuery.isLoading ? (
            <ActivityIndicator color={theme.action.primary} />
          ) : selectedDayTypeDetailQuery.isError ? (
            <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load this workout&apos;s exercises.</Text>
          ) : (selectedDayTypeDetailQuery.data?.exercises.length ?? 0) === 0 ? (
            <Text style={{ color: theme.text.secondary }}>No exercises added to this workout yet.</Text>
          ) : (
            selectedDayTypeDetailQuery.data!.exercises
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((exercise) => (
                <Pressable
                  key={exercise.id}
                  style={styles.exerciseRow}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${exerciseNameById.get(exercise.exerciseId) ?? 'exercise'}`}
                  onPress={() =>
                    setEditingExercise({
                      dayTypeId: selectedDayTypeId,
                      // The join row's id, not the catalog exercise's — this
                      // is what `/day-types/:id/exercises/:id` addresses.
                      exerciseId: exercise.id,
                      exerciseName: exerciseNameById.get(exercise.exerciseId) ?? 'Exercise',
                      prescription: exercise.prescription,
                      notes: exercise.notes ?? '',
                    })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text.primary }}>
                      {exerciseNameById.get(exercise.exerciseId) ?? 'Exercise'}
                    </Text>
                    <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                      {summarizePrescription(exercise.prescription)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={theme.text.secondary} />
                </Pressable>
              ))
          )}
          <Button
            label="Add exercise"
            variant="secondary"
            onPress={() => setShowAddExercise(true)}
          />
        </Card>
      ) : null}

      {toast ? <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} /> : null}

      <AddExercisePicker
        open={showAddExercise}
        exercises={exercisesQuery.data ?? []}
        exercisesLoading={exercisesQuery.isLoading}
        exercisesError={exercisesQuery.isError}
        onRetryExercises={() => void exercisesQuery.refetch()}
        onClose={() => setShowAddExercise(false)}
        onCreateExercise={(name) => createExercise.mutateAsync(name)}
        isCreatingExercise={createExercise.isPending}
        onAddExercise={(exerciseId, prescription) =>
          addExerciseToWorkout.mutateAsync({ dayTypeId: selectedDayTypeId!, exerciseId, prescription })
        }
        isAddingExercise={addExerciseToWorkout.isPending}
      />

      {editingExercise ? (
        <ExerciseEditSheet
          state={editingExercise}
          onClose={() => setEditingExercise(null)}
          isSaving={updateExercise.isPending || removeExercise.isPending}
          onSave={(next) =>
            updateExercise.mutate({
              dayTypeId: next.dayTypeId,
              exerciseId: next.exerciseId,
              prescription: next.prescription,
              notes: next.notes,
            })
          }
          onRemove={() =>
            removeExercise.mutate({
              dayTypeId: editingExercise.dayTypeId,
              exerciseId: editingExercise.exerciseId,
            })
          }
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  addWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[8],
  },
  bodyText: {
    fontSize: typeScale.compactBody.fontSize,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  programRowName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
    minWidth: 0,
  },
});
