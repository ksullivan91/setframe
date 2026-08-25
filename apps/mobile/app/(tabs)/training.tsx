import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ChevronUp, MoreVertical, Plus } from 'lucide-react-native';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { IconButton } from '../../src/components/IconButton';
import { Tabs } from '../../src/components/Tabs';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Toast } from '../../src/components/Toast';
import { Sheet } from '../../src/components/Sheet';
import { WeekScheduleEditor } from '../../src/components/WeekScheduleEditor';
import { AddExercisePicker } from '../../src/components/AddExercisePicker';
import { ExerciseEditSheet, type ExerciseEditState } from '../../src/components/ExerciseEditSheet';
import { useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { summarizePrescription } from '../../src/lib/prescription';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing, typeScale } from '../../src/theme/getTheme';

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
  /* Tab screens take top padding only — `BottomTabBar` already applies
     the bottom inset itself. See `useScreenInsets.ts`. */
  const topPadding = useScreenTopPadding();
  /* Mirrors web's Training tabs exactly, including its default of
     'workouts' — the thing a returning user most often came to change. */
  const [activeTab, setActiveTab] = useState<'programs' | 'workouts' | 'schedule'>('workouts');
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  /* Web keeps workout creation behind a button rather than an always-open
     form (`CreateWorkoutActions` → `WorkoutCreateForm`); an input wedged
     permanently into the list reads as another list row. */
  const [showCreateWorkout, setShowCreateWorkout] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
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

  /* Web has three program-level mutations — create, activate, rename —
     while mobile had only activate. A program could be created exactly
     once, inside the onboarding wizard, and never again: the guided-setup
     entry point below was gated on having *no* program, the inverse of
     web, which offers it in both states (banner when empty, secondary
     header button once configured). */
  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      // Select — deliberately not activate. Story 24: viewing or creating a
      // program must never silently change which one Today follows.
      setSelectedProgramId(created.id);
      setNewProgramName('');
      setToast({ variant: 'success', message: `${created.name} created.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not create that program.' }),
  });

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
      // The list this screen renders is keyed ['program-day-types', id] —
      // invalidating ['day-types'] matched no query at all, so a created
      // workout never appeared until the screen remounted. Prefix-matches
      // every program, which is what we want after a create.
      await queryClient.invalidateQueries({ queryKey: ['program-day-types'] });
      setSelectedDayTypeId(created.id);
      setNewWorkoutName('');
      // Dismiss the form too, not just its contents — leaving an empty
      // input open after a successful create reads as though it failed.
      setShowCreateWorkout(false);
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

  /* Story 25 made program↔workout membership explicit (`program_day_type`),
     so these two are genuinely different acts and web offers both: removing
     from a program leaves the workout intact for every other program that
     uses it, while deleting destroys it outright. Mobile offered neither —
     a workout added by mistake could not be taken back off a program, let
     alone deleted, without switching to the web app. */
  /* The constructive half of the membership pair. Shipping "Remove from
     this program" without it made removal a one-way door on mobile: the
     `day_type` survives exactly as the confirmation promises, but nothing
     on mobile lists workouts outside the current program, so it could
     never be added back — the only recovery was the web app, on the one
     platform whose reason for having this at all was not needing web. */
  const allDayTypesQuery = useQuery({
    queryKey: ['day-types'],
    queryFn: () => api.get<DayType[]>('/day-types'),
  });

  const addableDayTypes = useMemo(() => {
    const memberIds = new Set((dayTypesQuery.data ?? []).map((dayType) => dayType.id));
    return (allDayTypesQuery.data ?? []).filter((dayType) => !memberIds.has(dayType.id));
  }, [allDayTypesQuery.data, dayTypesQuery.data]);

  const addExistingToProgram = useMutation({
    mutationFn: (dayTypeId: string) =>
      api.post<DayType>(`/programs/${selectedProgram?.id}/day-types`, { dayTypeId }),
    onSuccess: async (added) => {
      await queryClient.invalidateQueries({ queryKey: ['program-day-types'] });
      setShowAddExisting(false);
      setSelectedDayTypeId(added.id);
      setToast({ variant: 'success', message: `${added.name} added to this program.` });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not add that workout.' }),
  });

  const removeFromProgram = useMutation({
    mutationFn: (dayTypeId: string) =>
      api.del(`/programs/${selectedProgram?.id}/day-types/${dayTypeId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['program-day-types'] });
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgram?.id] });
      setSelectedDayTypeId(null);
      setToast({ variant: 'success', message: 'Removed from this program.' });
    },
    onError: () =>
      setToast({ variant: 'error', message: 'Could not remove that workout from the program.' }),
  });

  const deleteDayType = useMutation({
    mutationFn: (dayTypeId: string) => api.del(`/day-types/${dayTypeId}`),
    onSuccess: async () => {
      /* Both prefixes, deliberately. This route clears the workout's
         schedule slots and program memberships across *every* program, not
         just the selected one, so scoping the invalidation to the current
         program would leave another program's cached schedule still
         showing a workout that no longer exists. `removeFromProgram` below
         is correctly scoped because that route only touches this program. */
      await queryClient.invalidateQueries({ queryKey: ['program-day-types'] });
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots'] });
      setSelectedDayTypeId(null);
      setToast({ variant: 'success', message: 'Workout deleted.' });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not delete that workout.' }),
  });

  /* Order is meaningful — it is the order the exercises appear in during a
     session — and mobile had no way to change it. ADR 0009 recorded this as
     web-only because "drag-reorder needs an interaction that doesn't
     exist", but web does not use drag either: it moves one position at a
     time with arrow buttons and PUTs the resulting order. Nothing about
     that is platform-specific. */
  const reorderExercises = useMutation({
    mutationFn: ({ dayTypeId, exerciseIdsInOrder }: { dayTypeId: string; exerciseIdsInOrder: string[] }) =>
      api.post(`/day-types/${dayTypeId}/exercises/reorder`, { exerciseIdsInOrder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] }),
    onError: () => setToast({ variant: 'error', message: 'Could not reorder those exercises.' }),
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

  /* Web puts these behind a `⋮` dropdown; the native equivalent is an
     action sheet, which is also what this app already uses for destructive
     per-item actions (see the logger's exercise removal). Both actions
     destroy something, so both confirm — and "Delete permanently" says
     plainly that it is not scoped to this program, because the two options
     sit next to each other and the difference is the whole point. */
  function confirmWorkoutActions(dayTypeId: string, name: string) {
    Alert.alert(name, undefined, [
      {
        text: 'Remove from this program',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Remove ${name} from ${selectedProgram?.name ?? 'this program'}?`,
            'The workout itself is kept, along with any other program using it. Its scheduled days in this program are cleared.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeFromProgram.mutate(dayTypeId),
              },
            ],
          ),
      },
      {
        text: 'Delete permanently',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Delete ${name}?`,
            'This deletes the workout for every program that uses it, along with its exercises. Workouts you have already logged are not affected.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteDayType.mutate(dayTypeId),
              },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

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

  /* Seeds a default selection once per program, not every time the
     selection happens to be null.

     Re-firing on any null meant deleting or removing a workout re-opened
     the detail card on whatever was scheduled earliest — the toast said
     "Workout deleted." while a different workout appeared in its place,
     which reads as though the wrong one went. Closing the card is the
     point of nulling it there, so this must not undo that. */
  const seededForProgramId = useRef<string | null>(null);
  useEffect(() => {
    const programId = selectedProgram?.id ?? null;
    if (seededForProgramId.current === programId) return;
    if (!selectedDayTypeId && weekOneSlots.length > 0) {
      setSelectedDayTypeId(weekOneSlots[0]!.dayTypeId);
      seededForProgramId.current = programId;
    }
  }, [selectedDayTypeId, weekOneSlots, selectedProgram?.id]);

  const selectedDayTypeDetailQuery = useQuery({
    queryKey: ['day-type', selectedDayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`),
    enabled: Boolean(selectedDayTypeId),
  });

  /* Exercises as displayed — sortOrder ascending. Reordering works against
     this array's indices, so it has to be the same ordering the rows are
     rendered from, not the raw query order.
   *
   * Also the single place the detail payload's `exercises` is read. The
   * count and empty-state checks used to dereference it separately as
   * `data?.exercises.length`, which guards `data` but not the field — a
   * payload arriving without it took the whole Training tab down rather
   * than rendering an empty workout. Same version-skew reasoning as
   * `isProgressOverview` and the optional-chained `sessions` above. */
  const sortedExercises = useMemo(
    () =>
      (selectedDayTypeDetailQuery.data?.exercises ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedDayTypeDetailQuery.data],
  );

  /* Moves one exercise a single position and sends the whole resulting
     order, matching web. Sending the full list rather than a delta means
     the server never has to reconcile two clients' partial moves. */
  function moveExercise(index: number, delta: number) {
    const nextIndex = index + delta;
    if (!selectedDayTypeId) return;
    if (nextIndex < 0 || nextIndex >= sortedExercises.length) return;
    const ids = sortedExercises.map((exercise) => exercise.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(nextIndex, 0, moved);
    reorderExercises.mutate({ dayTypeId: selectedDayTypeId, exerciseIdsInOrder: ids });
  }

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

  /* Ports web's `programContextLabel`. With the header no longer naming
     the program, the Workouts and Schedule tabs would otherwise give no
     clue which program their mutations land on — and "View" deliberately
     selects a program without activating it (Story 24), so that can be a
     program Today does not follow. Web shows the name; mobile also flags
     the not-active case, which is the state that actually misleads. */
  const programContext =
    (programsQuery.data?.length ?? 0) > 1 && selectedProgram ? (
      <View style={styles.contextLabel}>
        <Text style={[styles.helpText, { color: theme.text.secondary }]} numberOfLines={2}>
          Editing <Text style={{ fontWeight: '600' }}>{selectedProgram.name}</Text>
        </Text>
        {selectedProgram.isActive ? null : <Badge label="Not active" tone="neutral" />}
      </View>
    ) : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
    >
      {/* Web's header is the static word "Training" with a one-line
          description — not the program name. Mobile used the program name
          at page-title size, so "3 lower 2 upper strength split" wrapped
          straight under the Dynamic Island. Program identity belongs in
          the Programs tab, where it can be acted on. */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Training</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Manage the workouts and schedule in your program.
        </Text>
        {/* Matches web: a lower-emphasis "build another one" entry point in
            the header once the user already has a program. The Programs tab
            keeps its own copy for the empty case; web makes the same split
            between this button and its onboarding banner. */}
        <View style={styles.headerAction}>
          <Button
            label="Guided setup"
            variant="secondary"
            fullWidth={false}
            onPress={() => router.push('/program-wizard')}
          />
        </View>
      </View>

      {/* The one place Training acknowledges a live workout: a way back to
          it. Logging happens on the session's own screen, not here. Sits
          under the header rather than above it — a screen states what it
          is before it states what is going on elsewhere. */}
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

      <Tabs
        label="Training views"
        items={[
          { key: 'programs', label: 'Programs' },
          { key: 'workouts', label: 'Workouts' },
          { key: 'schedule', label: 'Schedule' },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'programs' | 'workouts' | 'schedule')}
      />

      {activeTab === 'programs' ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Your programs</Text>
          <Text style={[styles.helpText, { color: theme.text.secondary }]}>
            Select a program to view or edit it. Only one is active at a time — that&apos;s the one Today
            follows.
          </Text>
          {(programsQuery.data ?? []).map((program) => (
            <View key={program.id} style={styles.programRow}>
              <Pressable
                onPress={() => setSelectedProgramId(program.id)}
                accessibilityRole="button"
                accessibilityLabel={`View ${program.name}`}
                accessibilityState={{ selected: program.id === selectedProgram?.id }}
                style={styles.programRowName}
              >
                <Text
                  style={[
                    styles.bodyText,
                    { color: theme.text.primary, fontWeight: program.id === selectedProgram?.id ? '600' : '400' },
                  ]}
                  numberOfLines={2}
                >
                  {program.name}
                </Text>
                {program.isActive ? <Badge label="Active" tone="success" /> : null}
              </Pressable>
              {/* Only rendered for programs that are *not* active. Web
                  disables this button and relabels it "Active" when it is,
                  which — beside the badge that already says so — put the
                  word "Active" on screen twice for one program. The badge
                  states the fact; the button is only ever an action. */}
              {program.isActive ? null : (
                <Button
                  label="Set active"
                  variant="secondary"
                  fullWidth={false}
                  loading={activateMutation.isPending && activateMutation.variables === program.id}
                  onPress={() => activateMutation.mutate(program.id)}
                />
              )}
            </View>
          ))}

          {/* Creating a program was previously reachable only from the
              wizard, and only while none existed. Both entry points web
              offers are here: build one from scratch, or run guided setup
              again for another. */}
          <View style={[styles.createProgramBlock, { borderTopColor: theme.border.subtle }]}>
            <Input
              label="New program"
              placeholder="e.g. Off-season block"
              value={newProgramName}
              onChangeText={setNewProgramName}
            />
            <Button
              label="Create program"
              variant="secondary"
              loading={createProgram.isPending}
              disabled={!newProgramName.trim()}
              onPress={() => createProgram.mutate({ name: newProgramName.trim() })}
            />
            <Text style={[styles.helpText, { color: theme.text.secondary }]}>
              Or set one up with guided steps — pick your workouts and weekly schedule as you go.
            </Text>
            <Button
              label="Start guided setup"
              variant="secondary"
              onPress={() => router.push('/program-wizard')}
            />
          </View>
        </Card>
      ) : null}

      {/* Workouts — creating one used to be possible only inside the
          onboarding wizard, so a user who finished setup could never add
          another without switching to the web app. */}
      {activeTab === 'workouts' ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Workouts</Text>
          {programContext}
          {programWorkouts.length === 0 ? (
            <Text style={[styles.helpText, { color: theme.text.secondary }]}>
              No workouts yet. Create reusable training days like &quot;Upper A&quot; or &quot;Recovery&quot;.
            </Text>
          ) : (
            programWorkouts.map((workout) => (
              <Pressable
                key={workout.id}
                onPress={() => setSelectedDayTypeId(workout.id)}
                accessibilityRole="button"
                accessibilityLabel={workout.name}
                accessibilityState={{ selected: workout.id === selectedDayTypeId }}
                style={[
                  styles.dayRow,
                  workout.id === selectedDayTypeId
                    ? { backgroundColor: theme.action.accentSubtle, borderRadius: radius.small }
                    : null,
                ]}
              >
                {/* Web's rows carry the estimated duration under the name;
                    it is often the thing that distinguishes two similarly
                    named workouts at a glance. */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bodyText, { color: theme.text.primary }]}>{workout.name}</Text>
                  {workout.estimatedDurationMinutes != null ? (
                    <Text style={[styles.helpText, { color: theme.text.secondary }]}>
                      ~{workout.estimatedDurationMinutes} min
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={16} color={theme.text.secondary} />
              </Pressable>
            ))
          )}
          {showCreateWorkout ? (
            <View style={styles.createForm}>
              <Input
                label="Workout name"
                value={newWorkoutName}
                onChangeText={setNewWorkoutName}
                placeholder="e.g. Upper A"
              />
              <View style={styles.createFormActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    setShowCreateWorkout(false);
                    setNewWorkoutName('');
                  }}
                />
                <Button
                  label="Create"
                  fullWidth={false}
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
              </View>
            </View>
          ) : (
            <>
              <Button
                label="New workout"
                variant="secondary"
                icon={Plus}
                onPress={() => setShowCreateWorkout(true)}
              />
              {/* Only offered when there is actually something to add —
                  an empty picker is a dead end, and most users have every
                  workout they own already in the program they are editing. */}
              {addableDayTypes.length > 0 ? (
                <Button
                  label="Add existing workout"
                  variant="secondary"
                  onPress={() => setShowAddExisting(true)}
                />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {/* Schedule — assigning days was previously web-only. Reuses the same
          WeekScheduleEditor the onboarding wizard already drives. */}
      {activeTab === 'schedule' ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Program schedule</Text>
          {programContext}
          <WeekScheduleEditor
          workouts={programWorkouts.map((workout) => ({ id: workout.id, name: workout.name }))}
          assignmentsByDay={assignmentsByDay}
          selectedWorkoutId={heldWorkoutId}
          onSelectWorkout={setHeldWorkoutId}
          isLoading={scheduleSlotsQuery.isLoading}
          pendingDayIndex={pendingDayIndex}
          // Not "above" any more — the workout list is a different tab now.
          emptyMessage="Add a workout in the Workouts tab before scheduling your week."
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
      ) : null}

      {/* The selected workout's exercises. Belongs to the Workouts tab —
          web pairs the library and this detail panel side by side at
          desktop width and stacks them at mobile width, which is exactly
          this. */}
      {activeTab === 'workouts' && selectedDayTypeId ? (
        <Card>
          <View style={styles.detailHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary, flex: 1 }]}>
              {dayTypeById.get(selectedDayTypeId)?.name ?? 'Workout'}
            </Text>
            <IconButton
              icon={MoreVertical}
              variant="subtle"
              accessibilityLabel={`Actions for ${dayTypeById.get(selectedDayTypeId)?.name ?? 'workout'}`}
              onPress={() =>
                confirmWorkoutActions(
                  selectedDayTypeId,
                  dayTypeById.get(selectedDayTypeId)?.name ?? 'this workout',
                )
              }
            />
          </View>
          {/* Web summarises the workout under its name — the count is how a
              user judges whether a training day is actually built out. */}
          {(() => {
            const count = sortedExercises.length;
            const minutes = dayTypeById.get(selectedDayTypeId)?.estimatedDurationMinutes;
            if (selectedDayTypeDetailQuery.isLoading || selectedDayTypeDetailQuery.isError) return null;
            return (
              <Text style={[styles.helpText, { color: theme.text.secondary }]}>
                {count} {count === 1 ? 'exercise' : 'exercises'}
                {minutes != null ? ` · approximately ${minutes} min` : ''}
              </Text>
            );
          })()}
          {selectedDayTypeDetailQuery.isLoading ? (
            <ActivityIndicator color={theme.action.primary} />
          ) : selectedDayTypeDetailQuery.isError ? (
            <Text style={{ color: theme.text.secondary }}>Couldn&apos;t load this workout&apos;s exercises.</Text>
          ) : sortedExercises.length === 0 ? (
            <Text style={{ color: theme.text.secondary }}>No exercises added to this workout yet.</Text>
          ) : (
            sortedExercises.map((exercise, index) => {
              const exerciseName = exerciseNameById.get(exercise.exerciseId) ?? 'Exercise';
              return (
                <View key={exercise.id} style={styles.exerciseRow}>
                  {/* Tapping the row opens the edit sheet, which already
                      carries its own destructive Remove — so web's `⋮`
                      menu (Edit / Delete) is fully reachable here in the
                      same number of taps, and a second menu offering the
                      same two things would be redundant. */}
                  <Pressable
                    style={styles.exerciseRowMain}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${exerciseName}`}
                    onPress={() =>
                      setEditingExercise({
                        dayTypeId: selectedDayTypeId,
                        // The join row's id, not the catalog exercise's — this
                        // is what `/day-types/:id/exercises/:id` addresses.
                        exerciseId: exercise.id,
                        exerciseName,
                        prescription: exercise.prescription,
                        notes: exercise.notes ?? '',
                      })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text.primary }}>{exerciseName}</Text>
                      <Text style={{ color: theme.text.secondary, fontSize: typeScale.caption.fontSize }}>
                        {summarizePrescription(exercise.prescription)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={theme.text.secondary} />
                  </Pressable>
                  <View style={styles.reorderControls}>
                    <IconButton
                      icon={ChevronUp}
                      variant="subtle"
                      size={28}
                      accessibilityLabel={`Move ${exerciseName} up, position ${index + 1} of ${sortedExercises.length}`}
                      disabled={index === 0 || reorderExercises.isPending}
                      onPress={() => moveExercise(index, -1)}
                    />
                    <IconButton
                      icon={ChevronDown}
                      variant="subtle"
                      size={28}
                      accessibilityLabel={`Move ${exerciseName} down, position ${index + 1} of ${sortedExercises.length}`}
                      disabled={index === sortedExercises.length - 1 || reorderExercises.isPending}
                      onPress={() => moveExercise(index, 1)}
                    />
                  </View>
                </View>
              );
            })
          )}
          <Button
            label="Add exercise"
            variant="secondary"
            onPress={() => setShowAddExercise(true)}
          />
        </Card>
      ) : null}

      {/* Adds a workout this user already owns to the selected program —
          the counterpart to "Remove from this program", so removal is
          reversible without leaving the app. */}
      <Sheet
        visible={showAddExisting}
        onRequestClose={() => setShowAddExisting(false)}
        dismissOnBackdropPress
        maxHeightPercent={60}
      >
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Add an existing workout</Text>
        <Text style={[styles.helpText, { color: theme.text.secondary }]}>
          Workouts you have built that are not in {selectedProgram?.name ?? 'this program'} yet.
        </Text>
        {addableDayTypes.map((dayType) => (
          <View key={dayType.id} style={styles.dayRow}>
            <Text style={[styles.bodyText, { color: theme.text.primary, flex: 1 }]}>{dayType.name}</Text>
            <Button
              label="Add"
              variant="secondary"
              fullWidth={false}
              disabled={addExistingToProgram.isPending}
              onPress={() => addExistingToProgram.mutate(dayType.id)}
            />
          </View>
        ))}
      </Sheet>

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
  header: {
    gap: spacing[4],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.compactBody.fontSize,
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  /* Supporting copy under a section heading — web's `Small`. */
  headerAction: {
    marginTop: spacing[12],
    alignSelf: 'flex-start',
  },
  helpText: {
    fontSize: typeScale.compactBody.fontSize,
  },
  /* Separated from the program list by a rule: creating a program is a
     different act from choosing among the ones that exist, and web keeps
     the two visually distinct too. */
  createProgramBlock: {
    gap: spacing[8],
    marginTop: spacing[16],
    paddingTop: spacing[16],
    borderTopWidth: 1,
  },
  contextLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  createForm: {
    gap: spacing[8],
  },
  createFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[8],
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
  /* The tappable part of the row. Split out from `exerciseRow` so the
     reorder arrows sit beside it rather than inside its press target —
     otherwise moving an exercise would also open the edit sheet. */
  exerciseRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
