import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, GripVertical, MoreVertical } from 'lucide-react-native';
import { calculateVolume, estimateOneRepMax, quickEntryFields, visibleSessionExercises } from '@setframe/domain';
import type {
  Exercise,
  Prescription,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutSetPreviousPerformance,
} from '@setframe/schemas';

/** The performance fields shared by a logged set and a previous-session set. */
type WorkoutSetLike = Pick<
  WorkoutSetPreviousPerformance,
  'weightValue' | 'weightUnit' | 'reps' | 'durationSeconds' | 'distanceValue' | 'distanceUnit' | 'rpe'
>;
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import { SetRowEditable, distanceUnitOptions } from '../../src/components/SetRow';
import { IconButton } from '../../src/components/IconButton';
import { AddExercisePicker } from '../../src/components/AddExercisePicker';
import { FadeIn, Skeleton, SkeletonStack } from '../../src/components/Skeleton';
import { Toast } from '../../src/components/Toast';
import { useApiClient } from '../../src/lib/api-client';
import {
  countsTowardVolume,
  formatSessionSet,
  getPrescriptionDefinition,
  getSessionFieldLabel,
  isSessionSetLogged,
  resolveSessionFields,
  summarizePrescription,
  validateSessionSet,
  type PrescriptionDefinition,
  type SessionField,
} from '../../src/lib/prescription';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

interface DashboardSessionSummary {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

interface DashboardTodayResponse {
  localDate: string;
  sessions: DashboardSessionSummary[];
  dayLabel: string | null;
  dayTypeId: string | null;
}

interface ExerciseHistoryItem {
  sessionId: string;
  weightValue: number | null;
  reps: number | null;
}

interface ExerciseHistoryResponse {
  items: ExerciseHistoryItem[];
  nextCursor: string | null;
}

/** Draft values keyed by the shared `SessionField` identifiers, so the same
 *  prescription definition drives mobile and web identically. */
interface SetDraft {
  values: Partial<Record<SessionField, string>>;
  distanceUnit: string;
  completed: boolean;
}

function localDateString() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatElapsed(startedAt: string | null | undefined, completedAt?: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}:${`${minutes % 60}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

function parseNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/* Duration is persisted in seconds; continuous efforts read far better in
   minutes, so the draft holds the displayed unit and converts either way. */
function secondsToDisplay(seconds: number | null | undefined, definition: PrescriptionDefinition): string {
  if (seconds == null) return '';
  if (definition.units.duration !== 'minutes') return `${seconds}`;
  const minutes = seconds / 60;
  return `${Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(2))}`;
}

function displayToSeconds(value: string | undefined, definition: PrescriptionDefinition): number | undefined {
  const parsed = parseNumber(value ?? '');
  if (parsed == null) return undefined;
  return definition.units.duration === 'minutes' ? Math.round(parsed * 60) : parsed;
}

function buildDraft(set: WorkoutSet, definition: PrescriptionDefinition, prescription: Prescription | null): SetDraft {
  return {
    values: {
      setType: set.setType,
      weight: set.weightValue?.toString() ?? '',
      reps: set.reps?.toString() ?? '',
      duration: secondsToDisplay(set.durationSeconds, definition),
      distance: set.distanceValue?.toString() ?? '',
      rpe: set.rpe?.toString() ?? '',
    },
    distanceUnit: set.distanceUnit ?? definition.units.distance,
    completed: isSessionSetLogged(prescription, set),
  };
}

/**
 * Story 37: the quick-entry header's starting point. The first set already
 * carries the template's prefill (session-start expands the prescription
 * onto every set — weight left blank, everything else pre-populated), so
 * reusing it here means the header never has to re-derive prescription
 * defaults on its own. An exercise with no sets yet just starts blank.
 */
function getHeaderDraft(exerciseLog: WorkoutSessionDetail['exercises'][number], definition: PrescriptionDefinition): SetDraft {
  const firstSet = exerciseLog.sets[0];
  return firstSet
    ? buildDraft(firstSet, definition, exerciseLog.prescription)
    : { values: { setType: 'working' }, distanceUnit: definition.units.distance, completed: false };
}

function draftToValues(draft: SetDraft, definition: PrescriptionDefinition) {
  return {
    setType: draft.values.setType ?? 'working',
    weightValue: parseNumber(draft.values.weight ?? '') ?? null,
    reps: parseNumber(draft.values.reps ?? '') ?? null,
    durationSeconds: displayToSeconds(draft.values.duration, definition) ?? null,
    distanceValue: parseNumber(draft.values.distance ?? '') ?? null,
    rpe: parseNumber(draft.values.rpe ?? '') ?? null,
  };
}

/* Only visible fields are submitted. A hidden field is omitted from the patch
   entirely rather than sent as null, so nothing the user cannot see is
   silently wiped. */
function buildSetPatch(set: WorkoutSet, draft: SetDraft, visible: SessionField[], definition: PrescriptionDefinition) {
  const patch: Record<string, unknown> = {};
  if (visible.includes('setType')) patch.setType = draft.values.setType ?? set.setType;
  if (visible.includes('weight')) {
    const weightValue = parseNumber(draft.values.weight ?? '');
    patch.weightValue = weightValue;
    patch.weightUnit = weightValue != null ? set.weightUnit ?? 'lb' : undefined;
  }
  if (visible.includes('reps')) patch.reps = parseNumber(draft.values.reps ?? '');
  if (visible.includes('duration')) patch.durationSeconds = displayToSeconds(draft.values.duration, definition);
  if (visible.includes('distance')) {
    const distanceValue = parseNumber(draft.values.distance ?? '');
    patch.distanceValue = distanceValue;
    patch.distanceUnit = distanceValue != null ? draft.distanceUnit : undefined;
  }
  if (visible.includes('rpe')) patch.rpe = parseNumber(draft.values.rpe ?? '');
  patch.completed = draft.completed;
  return patch;
}

function getPreviousLabels(
  set: WorkoutSetLike | undefined,
  definition: PrescriptionDefinition,
): Partial<Record<SessionField, string>> {
  if (!set) return {};
  return {
    weight: set.weightValue != null ? `${set.weightValue}` : undefined,
    reps: set.reps != null ? `${set.reps}` : undefined,
    duration: set.durationSeconds != null ? secondsToDisplay(set.durationSeconds, definition) : undefined,
    distance: set.distanceValue != null ? `${set.distanceValue}` : undefined,
    rpe: set.rpe != null ? `${set.rpe}` : undefined,
  };
}

function createClientId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const routeSessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const [elapsedLabel, setElapsedLabel] = useState('—');
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  // Story 37: a separate, exercise-level draft for the quick-entry header —
  // distinct from any one set's own draft, since it's a value to apply,
  // not a value that's itself logged.
  const [headerDrafts, setHeaderDrafts] = useState<Record<string, SetDraft>>({});
  // Story 37: which header keys the user has actually edited since the
  // header was last reset — Apply to all sets must only ever patch these,
  // not every quick-entry field, or changing just reps would silently
  // blow away a sibling set's own distinct weight/duration/etc. `'unit'`
  // is tracked separately from `'distance'` (the value) so touching only
  // the unit dropdown doesn't also drag the distance value along — they're
  // one field, but two independent draft keys. Cleared after a successful
  // Apply and whenever a set is added, so a stale earlier edit can never
  // silently reapply on a later, unrelated click.
  const [headerTouchedKeys, setHeaderTouchedKeys] = useState<Record<string, ('unit' | SessionField)[]>>({});
  // Story 37: undefined means expanded — every exercise starts open,
  // matching the screen's existing pre-collapsible behavior.
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Record<string, boolean>>({});
  const [createdSessionId, setCreatedSessionId] = useState<string | undefined>();
  const [toast, setToast] = useState<{
    variant: 'success' | 'error';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const todayQuery = useQuery({
    queryKey: ['dashboard-today-mobile-workout'],
    queryFn: () => api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDateString()}`),
    enabled: !routeSessionId,
  });

  const resumeSessionMutation = useMutation({
    mutationFn: async () => {
      const active = todayQuery.data?.sessions.find((session) => session.status === 'in_progress');
      if (active) return { id: active.id } as Pick<WorkoutSession, 'id'>;
      return api.post<WorkoutSession>('/workout-sessions', {
        templateId: todayQuery.data?.dayTypeId ?? undefined,
        localDate: todayQuery.data?.localDate ?? localDateString(),
        timezone: localTimezone(),
      });
    },
    // Persist the resolved id in local state (not just mutation.data) so a
    // later mutation.reset() (e.g. from the error screen's Retry action)
    // can't make resolvedSessionId fall back to undefined and re-trigger
    // session creation, which would create a duplicate in-progress session.
    onSuccess: (data) => setCreatedSessionId(data.id),
  });

  const resolvedSessionId =
    routeSessionId ??
    todayQuery.data?.sessions.find((session) => session.status === 'in_progress')?.id ??
    createdSessionId;

  useEffect(() => {
    if (
      !routeSessionId &&
      !todayQuery.isLoading &&
      !todayQuery.isError &&
      !resolvedSessionId &&
      !resumeSessionMutation.isPending &&
      !resumeSessionMutation.isError
    ) {
      resumeSessionMutation.mutate();
    }
    // resumeSessionMutation intentionally omitted from deps: it's a stable
    // mutate/isPending/isError object reference from useMutation, and
    // including the whole object would re-run this effect on every render
    // once isError flips, defeating the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSessionId, routeSessionId, todayQuery.isError, todayQuery.isLoading, resumeSessionMutation.isPending, resumeSessionMutation.isError]);

  const sessionQuery = useQuery({
    queryKey: ['mobile-workout-session', resolvedSessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${resolvedSessionId}`),
    enabled: Boolean(resolvedSessionId),
  });

  const exercisesQuery = useQuery({
    queryKey: ['mobile-exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  useEffect(() => {
    if (!sessionQuery.data) return;
    setElapsedLabel(formatElapsed(sessionQuery.data.startedAt, sessionQuery.data.completedAt));
    if (sessionQuery.data.status === 'completed' || !sessionQuery.data.startedAt) return;
    const interval = setInterval(() => {
      setElapsedLabel(formatElapsed(sessionQuery.data.startedAt, sessionQuery.data.completedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionQuery.data]);

  useEffect(() => {
    if (!sessionQuery.data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const exerciseLog of sessionQuery.data.exercises) {
        const definition = getPrescriptionDefinition(exerciseLog.prescription);
        for (const set of exerciseLog.sets) {
          if (!next[set.id]) {
            next[set.id] = buildDraft(set, definition, exerciseLog.prescription);
          }
        }
      }
      return next;
    });
  }, [sessionQuery.data]);

  const refreshSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['mobile-workout-session', resolvedSessionId] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-today-mobile-workout'] }),
    ]);
  };

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onSuccess: refreshSession,
  });

  const addSetMutation = useMutation({
    mutationFn: ({ exerciseLogId, sourceSet }: { exerciseLogId: string; sourceSet?: WorkoutSet }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, {
        clientId: createClientId(),
        setType: sourceSet?.setType ?? 'working',
        weightValue: sourceSet?.weightValue ?? undefined,
        weightUnit: sourceSet?.weightValue != null ? sourceSet.weightUnit ?? 'lb' : undefined,
        reps: sourceSet?.reps ?? undefined,
        durationSeconds: sourceSet?.durationSeconds ?? undefined,
        distanceValue: sourceSet?.distanceValue ?? undefined,
        distanceUnit: sourceSet?.distanceValue != null ? sourceSet.distanceUnit ?? undefined : undefined,
        rpe: sourceSet?.rpe ?? undefined,
      }),
    onSuccess: async (_, variables) => {
      await refreshSession();
      // Story 37: a newly added set didn't exist when any header field was
      // marked touched, so a stale touched key could otherwise reapply to
      // it (and every other set) on the next unrelated Apply click.
      setHeaderTouchedKeys((prev) => ({ ...prev, [variables.exerciseLogId]: [] }));
    },
  });

  const saveSetMutation = useMutation({
    mutationFn: ({
      setId,
      draft,
      set,
      visible,
      definition,
    }: {
      setId: string;
      draft: SetDraft;
      set: WorkoutSet;
      visible: SessionField[];
      definition: PrescriptionDefinition;
    }) => api.patch<WorkoutSet>(`/workout-sets/${setId}`, buildSetPatch(set, draft, visible, definition)),
    onSuccess: refreshSession,
  });

  /* The session carries its own prescription snapshot, because an exercise
     added mid-session has no day-type row to inherit one from. */
  const addExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, prescription }: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/workout-sessions/${resolvedSessionId}/exercises`, { exerciseId, prescription }),
    onSuccess: async () => {
      setShowAddExercise(false);
      await refreshSession();
    },
  });

  const createExerciseMutation = useMutation({
    mutationFn: (name: string) => api.post<Exercise>('/exercises', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  });

  /* Story 34: removal is session-scoped, so it flips the existing `skipped`
     flag on the exercise log rather than deleting it — the underlying rows
     (and any sets already logged) are untouched, the workout template and
     program are never involved, and undo is just flipping the flag back. */
  const removeExerciseMutation = useMutation({
    mutationFn: ({ exerciseLogId }: { exerciseLogId: string; name: string }) =>
      api.patch(`/workout-exercise-logs/${exerciseLogId}`, { skipped: true }),
    onSuccess: async (_, { exerciseLogId, name }) => {
      await refreshSession();
      setToast({
        variant: 'success',
        message: `${name} removed from today's workout.`,
        actionLabel: 'Undo',
        onAction: () => restoreExerciseMutation.mutate(exerciseLogId),
      });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not remove exercise.' }),
  });

  const restoreExerciseMutation = useMutation({
    mutationFn: (exerciseLogId: string) => api.patch(`/workout-exercise-logs/${exerciseLogId}`, { skipped: false }),
    onSuccess: async () => {
      await refreshSession();
      setToast({ variant: 'success', message: "Exercise restored to today's workout." });
    },
    onError: () => setToast({ variant: 'error', message: 'Could not undo.' }),
  });

  function confirmRemoveExercise(exerciseLogId: string, name: string, loggedSetCount: number) {
    Alert.alert(
      loggedSetCount > 0
        ? `Remove ${name} and its ${loggedSetCount} logged set${loggedSetCount === 1 ? '' : 's'} from today's workout?`
        : `Remove ${name} from today's workout?`,
      loggedSetCount > 0
        ? `This only changes today's session — the sets you've already logged stay on record, and ${name} will stay in the workout template.`
        : `This only changes today's session. ${name} will stay in the workout template.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeExerciseMutation.mutate({ exerciseLogId, name }),
        },
      ],
    );
  }

  const finishMutation = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${resolvedSessionId}/complete`),
    onSuccess: async () => {
      await refreshSession();
      router.replace({ pathname: '/session-summary', params: { sessionId: resolvedSessionId! } });
    },
  });

  const visibleExercises = useMemo(
    () => visibleSessionExercises(sessionQuery.data?.exercises ?? []),
    [sessionQuery.data],
  );

  const totalSetsLogged = useMemo(
    () =>
      visibleExercises.reduce(
        (sum, exerciseLog) =>
          sum + exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length,
        0,
      ),
    [visibleExercises],
  );

  /* Story 36: Finish workout became persistently reachable via the sticky
     action bar below, so a stray tap must not end the session outright —
     the button previously completed immediately with no confirmation. */
  function confirmFinishWorkout() {
    Alert.alert(
      'Finish workout?',
      `You logged ${visibleExercises.length} exercise${visibleExercises.length === 1 ? '' : 's'} and ${totalSetsLogged} set${totalSetsLogged === 1 ? '' : 's'}. You can review the workout after finishing.`,
      [
        { text: 'Keep training', style: 'cancel' },
        { text: 'Finish workout', onPress: () => finishMutation.mutate() },
      ],
    );
  }

  function toggleExpanded(exerciseLogId: string) {
    setExpandedExerciseIds((prev) => ({ ...prev, [exerciseLogId]: !(prev[exerciseLogId] ?? true) }));
  }

  /**
   * Story 37: applies the header's quick-entry values onto every set's own
   * draft. Explicit and only ever fired by this button — the cascade never
   * runs on its own, so a set the user already edited by hand is never
   * silently overwritten; the user has to knowingly re-apply over it.
   *
   * Only the exact keys the user actually edited in the header are
   * copied — not every key belonging to the same quick-entry field. That
   * distinction matters for distance specifically: touching only the unit
   * dropdown must not also drag the (untouched) distance value along.
   */
  function applyHeaderToAllSets(exerciseLog: WorkoutSessionDetail['exercises'][number], definition: PrescriptionDefinition) {
    const header = headerDrafts[exerciseLog.id] ?? getHeaderDraft(exerciseLog, definition);
    const touchedKeys = headerTouchedKeys[exerciseLog.id] ?? [];
    setDrafts((prev) => {
      const next = { ...prev };
      for (const set of exerciseLog.sets) {
        const current = next[set.id] ?? buildDraft(set, definition, exerciseLog.prescription);
        const patch: Partial<Record<SessionField, string>> = {};
        for (const key of touchedKeys) {
          if (key !== 'unit') patch[key] = header.values[key];
        }
        next[set.id] = {
          ...current,
          values: { ...current.values, ...patch },
          distanceUnit: touchedKeys.includes('unit') ? header.distanceUnit : current.distanceUnit,
        };
      }
      return next;
    });
    // Cleared so a later, unrelated Apply click can't silently reapply a
    // stale edit — the next click only ever acts on what's touched after
    // this point.
    setHeaderTouchedKeys((prev) => ({ ...prev, [exerciseLog.id]: [] }));
  }

  // Timed, distance and bodyweight work carries no weight, so including it
  // would contribute nothing while making the total look authoritative.
  const totalVolume = useMemo(
    () =>
      calculateVolume(
        visibleExercises
          .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
          .flatMap((exerciseLog) => exerciseLog.sets),
      ),
    [visibleExercises],
  );

  const bestEstimated1rm = useMemo(() => {
    const values = visibleExercises
      .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
      .flatMap((exerciseLog) => exerciseLog.sets)
      .filter((set) => set.weightValue != null && set.reps != null)
      .map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
    return values.length ? `${Math.round(Math.max(...values))} lb` : '—';
  }, [visibleExercises]);

  const isLoading = todayQuery.isLoading || resumeSessionMutation.isPending || sessionQuery.isLoading || exercisesQuery.isLoading;
  const isError = todayQuery.isError || resumeSessionMutation.isError || sessionQuery.isError || exercisesQuery.isError;

  if (isLoading) {
    return <SessionSkeleton />;
  }

  if (isError || !sessionQuery.data) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16], gap: spacing[16] }]}> 
        <Text style={{ color: theme.text.primary, textAlign: 'center' }}>Couldn&apos;t load workout session.</Text>
        <Button
          label="Retry"
          variant="secondary"
          fullWidth={false}
          onPress={() => {
            resumeSessionMutation.reset();
            todayQuery.refetch();
            sessionQuery.refetch();
            exercisesQuery.refetch();
          }}
        />
      </View>
    );
  }

  return (
    // Fades the session in over the skeleton it replaces, so the swap reads
    // as a transition rather than a pop.
    <FadeIn>
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerMeta}>
        <Text style={[styles.title, { color: theme.text.primary }]}>{todayQuery.data?.dayLabel ?? 'Workout session'}</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Elapsed {elapsedLabel}</Text>
      </View>

      <Card>
        <View style={styles.summaryRow}>
          <Stat label="Sets" value={`${totalSetsLogged}`} />
          <Stat label="Volume" value={totalVolume ? `${totalVolume.toLocaleString()} lb` : '—'} />
          <Stat label="Best 1RM" value={bestEstimated1rm} />
        </View>
      </Card>

      {visibleExercises.map((exerciseLog) => {
        const definition = getPrescriptionDefinition(exerciseLog.prescription);
        const loggedSetCount = exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length;
        const isExpanded = expandedExerciseIds[exerciseLog.id] ?? true;
        const headerDraft = headerDrafts[exerciseLog.id] ?? getHeaderDraft(exerciseLog, definition);
        const touchHeaderKey = (key: 'unit' | SessionField) =>
          setHeaderTouchedKeys((prev) => ({
            ...prev,
            [exerciseLog.id]: prev[exerciseLog.id]?.includes(key) ? prev[exerciseLog.id]! : [...(prev[exerciseLog.id] ?? []), key],
          }));
        // Touched keys are derived straight from the patch's own keys, so
        // e.g. changing only the distance value marks just `distance`
        // touched, never the (separately tracked) unit alongside it.
        const updateHeader = (patch: Partial<Record<SessionField, string>>) => {
          setHeaderDrafts((prev) => ({ ...prev, [exerciseLog.id]: { ...headerDraft, values: { ...headerDraft.values, ...patch } } }));
          for (const key of Object.keys(patch) as SessionField[]) touchHeaderKey(key);
        };
        return (
        <Card key={exerciseLog.id}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleRow}>
              <IconButton
                icon={isExpanded ? ChevronUp : ChevronDown}
                variant="subtle"
                accessibilityLabel={isExpanded ? `Collapse ${exerciseLog.exercise.name}` : `Expand ${exerciseLog.exercise.name}`}
                onPress={() => toggleExpanded(exerciseLog.id)}
              />
              <GripVertical size={18} color={theme.text.secondary} />
              <Text style={[styles.exerciseTitle, { color: theme.text.primary }]}>{exerciseLog.exercise.name}</Text>
            </View>
            <View style={styles.exerciseHeaderActions}>
              <Button
                label="Add set"
                variant="secondary"
                fullWidth={false}
                disabled={sessionQuery.data.status === 'completed' || addSetMutation.isPending}
                onPress={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: exerciseLog.sets.at(-1) })}
              />
              <IconButton
                icon={MoreVertical}
                variant="subtle"
                accessibilityLabel={`${exerciseLog.exercise.name} actions`}
                onPress={() =>
                  sessionQuery.data.status !== 'completed' &&
                  confirmRemoveExercise(exerciseLog.id, exerciseLog.exercise.name, loggedSetCount)
                }
              />
            </View>
          </View>

          <Text style={[styles.prescription, { color: theme.text.secondary }]}>{summarizePrescription(exerciseLog.prescription)}</Text>

          {/* Story 37: quick-entry — set a common value once here and apply
              it to every set instead of repeating it per row. Visible
              regardless of expand state, matching the collapsed header's
              own content per the story's UX intent. */}
          <View style={styles.quickEntryGrid}>
            {quickEntryFields(definition).map((field) => {
              // Distinct from the per-set field labels below (not just
              // "Weight"/"Reps") — two identically-labeled inputs in the
              // same section would be genuinely ambiguous for a
              // screen-reader user navigating by label, not only in tests.
              const label = `All sets: ${getSessionFieldLabel(field, definition)}`;
              if (field === 'distance') {
                return (
                  <View key={field} style={styles.quickEntryDistanceRow}>
                    <View style={styles.quickEntryDistanceValue}>
                      <Input
                        label={label}
                        value={headerDraft.values.distance ?? ''}
                        onChangeText={(value) => updateHeader({ distance: value })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Select
                      label="All sets: Distance unit"
                      value={headerDraft.distanceUnit}
                      options={distanceUnitOptions.map((option) => ({ ...option }))}
                      onChange={(value) => {
                        setHeaderDrafts((prev) => ({ ...prev, [exerciseLog.id]: { ...headerDraft, distanceUnit: value } }));
                        touchHeaderKey('unit');
                      }}
                    />
                  </View>
                );
              }
              return (
                <Input
                  key={field}
                  label={label}
                  value={headerDraft.values[field] ?? ''}
                  onChangeText={(value) => updateHeader({ [field]: value })}
                  keyboardType={field === 'reps' ? 'number-pad' : 'decimal-pad'}
                  unit={field === 'weight' ? exerciseLog.sets[0]?.weightUnit ?? 'lb' : undefined}
                />
              );
            })}
          </View>
          <View style={styles.quickEntryFooter}>
            <Button
              label="Apply to all sets"
              variant="secondary"
              fullWidth={false}
              disabled={!exerciseLog.sets.length || sessionQuery.data.status === 'completed'}
              onPress={() => applyHeaderToAllSets(exerciseLog, definition)}
            />
          </View>

          {isExpanded ? (
          <>
          {exerciseLog.previousSession ? (
            <Card style={[styles.previousCard, { backgroundColor: theme.surface.sunken }]}>
              <Text style={[styles.previousTitle, { color: theme.text.secondary }]}>Previous session</Text>
              {exerciseLog.previousSession.sets.map((set, index) => (
                <Text key={`${exerciseLog.previousSession?.sessionId}-${index}`} style={{ color: theme.text.primary }}>
                  Set {index + 1} · {formatSessionSet(exerciseLog.prescription, set, { includeRpe: true }) || '—'}
                </Text>
              ))}
            </Card>
          ) : null}

          {exerciseLog.sets.map((set, index) => {
            const draft = drafts[set.id] ?? buildDraft(set, definition, exerciseLog.prescription);
            const draftValues = draftToValues(draft, definition);
            // Union of the prescription's fields and anything this set already
            // stores, so legacy values stay visible and editable.
            const visibleFields = resolveSessionFields(exerciseLog.prescription, { ...set, ...draftValues });
            const fieldErrors = validateSessionSet(exerciseLog.prescription, draftValues);
            const previous = getPreviousLabels(exerciseLog.previousSession?.sets[index], definition);
            // PR flags come straight from the server, which resolves them
            // against all-time history for the whole exercise log after every
            // save. Guessing on the client used a different, narrower baseline
            // and produced badges that contradicted the persisted state.
            const isPr = set.isPrWeight || set.isPrReps;
            const planned = summarizePrescription(exerciseLog.prescription).replace(/^Planned:\s*/, '');

            return (
              <View key={set.id} style={styles.setBlock}>
                <View style={styles.setBlockHeader}>
                  <Text style={[styles.setMeta, { color: theme.text.secondary }]}>Set {index + 1}</Text>
                  <Text style={[styles.setMeta, { color: theme.text.secondary }]}>Target {planned}</Text>
                </View>
                <SetRowEditable
                  setLabel={`Set ${index + 1}`}
                  fields={visibleFields}
                  definition={definition}
                  values={draft.values}
                  errors={fieldErrors}
                  weightUnit={set.weightUnit ?? 'lb'}
                  distanceUnit={draft.distanceUnit}
                  onChangeDistanceUnit={(value) =>
                    setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, distanceUnit: value } }))
                  }
                  onChangeField={(field, value) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [set.id]: { ...draft, values: { ...draft.values, [field]: value } },
                    }))
                  }
                  completed={draft.completed}
                  onToggleCompleted={(completed) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, completed } }))}
                  previous={previous}
                  isPr={isPr}
                  onDuplicate={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: set })}
                  onRemove={() =>
                    Alert.alert('Remove set', `Remove Set ${index + 1}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => deleteSetMutation.mutate(set.id) },
                    ])
                  }
                />
                <View style={styles.saveRow}>
                  <Text style={[styles.helperNote, { color: theme.text.secondary }]}>Log actual performance, then save to sync the session.</Text>
                  <Button
                    label="Save"
                    variant="secondary"
                    fullWidth={false}
                    loading={saveSetMutation.isPending}
                    disabled={sessionQuery.data.status === 'completed' || Object.keys(fieldErrors).length > 0}
                    onPress={() =>
                      saveSetMutation.mutate({ setId: set.id, draft, set, visible: visibleFields, definition })
                    }
                  />
                </View>
              </View>
            );
          })}
          </>
          ) : null}
        </Card>
        );
      })}

      {toast ? (
        <Toast
          variant={toast.variant}
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      <AddExercisePicker
        open={showAddExercise}
        exercises={exercisesQuery.data ?? []}
        exercisesLoading={exercisesQuery.isLoading}
        exercisesError={exercisesQuery.isError}
        onRetryExercises={() => void exercisesQuery.refetch()}
        onClose={() => setShowAddExercise(false)}
        onCreateExercise={(name) => createExerciseMutation.mutateAsync(name)}
        isCreatingExercise={createExerciseMutation.isPending}
        onAddExercise={(exerciseId, prescription) => addExerciseMutation.mutateAsync({ exerciseId, prescription })}
        isAddingExercise={addExerciseMutation.isPending}
      />
    </ScrollView>

    {/* Story 36: Add exercise / Finish workout stay reachable during a long
        workout instead of living only at the top of the screen (Finish) or
        the bottom of the scroll (Add exercise, previously its own Card
        below the last exercise). Positioned absolutely within this screen's
        own content area, which Expo Router's tab navigator already sizes to
        exclude the bottom tab bar — no extra height/inset math needed to
        clear it. Disappears once the workout is completed (AC). */}
    {sessionQuery.data.status !== 'completed' ? (
      <View
        style={[styles.sessionActionBar, { backgroundColor: theme.surface.raised, borderTopColor: theme.border.subtle }]}
      >
        <View style={styles.sessionActionBarButton}>
          <Button
            label="Add exercise"
            variant="secondary"
            onPress={() => setShowAddExercise(true)}
          />
        </View>
        <View style={styles.sessionActionBarButton}>
          <Button
            label="Finish workout"
            loading={finishMutation.isPending}
            onPress={confirmFinishWorkout}
          />
        </View>
      </View>
    ) : null}
    </FadeIn>
  );
}

/**
 * Mirrors the real session layout — header, summary stats card and exercise
 * blocks — so the screen keeps its shape while loading. It previously showed
 * a bare spinner on an empty canvas, which meant the whole page blanked and
 * then snapped to full content.
 */
function SessionSkeleton() {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={styles.content}
      /* Every skeleton bar is removed from the accessibility tree, so
         without `accessible` this container is not exposed as an element on
         iOS and VoiceOver would announce nothing at all here. */
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading workout session"
      accessibilityState={{ busy: true }}
      testID="session-skeleton"
    >
      <View style={styles.headerRow}>
        <SkeletonStack gap={spacing[8]} style={{ flex: 1 }}>
          <Skeleton height={26} width="60%" />
          <Skeleton height={14} width="35%" />
        </SkeletonStack>
        <Skeleton height={40} width={92} />
      </View>

      <Card>
        <View style={styles.summaryRow}>
          {[0, 1, 2].map((index) => (
            <SkeletonStack key={index} gap={spacing[8]} style={styles.stat}>
              <Skeleton height={28} width="70%" />
              <Skeleton height={12} width="50%" />
            </SkeletonStack>
          ))}
        </View>
      </Card>

      {[0, 1].map((index) => (
        <Card key={index}>
          <View style={styles.exerciseHeader}>
            <Skeleton height={20} width="55%" />
            <Skeleton height={36} width={84} />
          </View>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Card>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statValue,
          { color: theme.text.primary, fontSize: typeScale.numericMetric.fontSize, lineHeight: typeScale.numericMetric.lineHeight },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing[16],
    // Story 36: clears the sticky session action bar below, which floats
    // over this scroll content — sized to roughly its own rendered height
    // (two 44px buttons + padding) rather than a rounder, less-motivated
    // number.
    paddingBottom: spacing[16] + 44 + spacing[16] * 2,
    gap: spacing[16],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
  headerMeta: {
    flex: 1,
    gap: spacing[4],
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.compactBody.fontSize,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  stat: {
    alignItems: 'center',
    gap: spacing[4],
    flex: 1,
  },
  statValue: {
    fontWeight: '600',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: typeScale.label.fontSize,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[8],
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flex: 1,
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  exerciseTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
    flexShrink: 1,
  },
  quickEntryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  quickEntryDistanceRow: {
    flexDirection: 'row',
    gap: spacing[8],
    flex: 1,
  },
  quickEntryDistanceValue: {
    flex: 1,
  },
  quickEntryFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  prescription: {
    fontSize: typeScale.compactBody.fontSize,
  },
  previousCard: {
    borderWidth: 0,
  },
  previousTitle: {
    fontSize: typeScale.label.fontSize,
    fontWeight: '600',
  },
  setBlock: {
    gap: spacing[8],
  },
  setBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[8],
    flexWrap: 'wrap',
  },
  setMeta: {
    fontSize: typeScale.caption.fontSize,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[8],
  },
  helperNote: {
    fontSize: typeScale.caption.fontSize,
    flex: 1,
  },
  sectionLabel: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  sessionActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing[8],
    padding: spacing[16],
    borderTopWidth: 1,
  },
  sessionActionBarButton: {
    flex: 1,
  },
});
