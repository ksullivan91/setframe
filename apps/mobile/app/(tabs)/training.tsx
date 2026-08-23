import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical } from 'lucide-react-native';
import { calculateVolume, estimateOneRepMax } from '@setframe/domain';
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
import { SetRowEditable } from '../../src/components/SetRow';
import { IconButton } from '../../src/components/IconButton';
import { AddExercisePicker } from '../../src/components/AddExercisePicker';
import { FadeIn, Skeleton, SkeletonStack } from '../../src/components/Skeleton';
import { useApiClient } from '../../src/lib/api-client';
import {
  countsTowardVolume,
  formatSessionSet,
  getPrescriptionDefinition,
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
  const [createdSessionId, setCreatedSessionId] = useState<string | undefined>();

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
    onSuccess: refreshSession,
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

  const finishMutation = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${resolvedSessionId}/complete`),
    onSuccess: async () => {
      await refreshSession();
      router.replace({ pathname: '/session-summary', params: { sessionId: resolvedSessionId! } });
    },
  });

  // Timed, distance and bodyweight work carries no weight, so including it
  // would contribute nothing while making the total look authoritative.
  const totalVolume = useMemo(
    () =>
      calculateVolume(
        (sessionQuery.data?.exercises ?? [])
          .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
          .flatMap((exerciseLog) => exerciseLog.sets),
      ),
    [sessionQuery.data],
  );

  const bestEstimated1rm = useMemo(() => {
    const values = (sessionQuery.data?.exercises ?? [])
      .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
      .flatMap((exerciseLog) => exerciseLog.sets)
      .filter((set) => set.weightValue != null && set.reps != null)
      .map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
    return values.length ? `${Math.round(Math.max(...values))} lb` : '—';
  }, [sessionQuery.data]);

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
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={[styles.title, { color: theme.text.primary }]}>{todayQuery.data?.dayLabel ?? 'Workout session'}</Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Elapsed {elapsedLabel}</Text>
        </View>
        <Button
          label="Finish"
          variant="secondary"
          fullWidth={false}
          loading={finishMutation.isPending}
          disabled={sessionQuery.data.status === 'completed'}
          onPress={() => finishMutation.mutate()}
        />
      </View>

      <Card>
        <View style={styles.summaryRow}>
          <Stat
            label="Sets"
            value={`${sessionQuery.data.exercises.reduce(
              (sum, exerciseLog) =>
                sum + exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length,
              0,
            )}`}
          />
          <Stat label="Volume" value={totalVolume ? `${totalVolume.toLocaleString()} lb` : '—'} />
          <Stat label="Best 1RM" value={bestEstimated1rm} />
        </View>
      </Card>

      {sessionQuery.data.exercises.map((exerciseLog) => {
        const definition = getPrescriptionDefinition(exerciseLog.prescription);
        return (
        <Card key={exerciseLog.id}>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleRow}>
              <GripVertical size={18} color={theme.text.secondary} />
              <Text style={[styles.exerciseTitle, { color: theme.text.primary }]}>{exerciseLog.exercise.name}</Text>
            </View>
            <Button
              label="Add set"
              variant="secondary"
              fullWidth={false}
              disabled={sessionQuery.data.status === 'completed' || addSetMutation.isPending}
              onPress={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: exerciseLog.sets.at(-1) })}
            />
          </View>

          <Text style={[styles.prescription, { color: theme.text.secondary }]}>{summarizePrescription(exerciseLog.prescription)}</Text>

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
        </Card>
        );
      })}

      {/* Story 08: one self-contained flow — search the canonical catalog,
          create a custom exercise, configure it, add it, all without leaving
          the session. */}
      <Card>
        <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>Add exercise</Text>
        <Text style={[styles.helperNote, { color: theme.text.secondary }]}>
          Search the catalog or create something new without leaving this workout.
        </Text>
        <View style={styles.addSetRow}>
          <IconButton
            icon={Plus}
            accessibilityLabel="Add exercise to this workout"
            onPress={() => sessionQuery.data.status !== 'completed' && setShowAddExercise(true)}
          />
          <Text
            style={{ color: theme.action.primary }}
            accessibilityRole="button"
            onPress={() => sessionQuery.data.status !== 'completed' && setShowAddExercise(true)}
          >
            Add exercise
          </Text>
        </View>
      </Card>

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
  exerciseTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
    flexShrink: 1,
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
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
});
