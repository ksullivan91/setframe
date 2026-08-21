import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical } from 'lucide-react-native';
import { calculateVolume, detectRepPR, detectWeightPR, estimateOneRepMax } from '@setline/domain';
import type { Exercise, WorkoutSession, WorkoutSessionDetail, WorkoutSet } from '@setline/schemas';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { SetRowEditable } from '../../src/components/SetRow';
import { IconButton } from '../../src/components/IconButton';
import { Select } from '../../src/components/Select';
import { useApiClient } from '../../src/lib/api-client';
import { summarizePrescription } from '../../src/lib/prescription';
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

interface SetDraft {
  weight: string;
  reps: string;
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

function formatSetValue(set: { weightValue: number | null; weightUnit?: string | null; reps: number | null }) {
  const weight = set.weightValue != null ? `${set.weightValue}${set.weightUnit ?? 'lb'}` : '—';
  const reps = set.reps != null ? `${set.reps}` : '—';
  return `${weight} × ${reps}`;
}

function getPreviousLabel(set: { weightValue: number | null; reps: number | null } | undefined) {
  return {
    previousWeight: set?.weightValue != null ? `${set.weightValue}` : undefined,
    previousReps: set?.reps != null ? `${set.reps}` : undefined,
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
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
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

  const historyQueries = useQueries({
    queries: (sessionQuery.data?.exercises ?? []).map((exerciseLog) => ({
      queryKey: ['mobile-exercise-history', exerciseLog.exerciseId],
      queryFn: () => api.get<ExerciseHistoryResponse>(`/exercises/${exerciseLog.exerciseId}/history`),
      enabled: Boolean(sessionQuery.data),
    })),
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
        for (const set of exerciseLog.sets) {
          if (!next[set.id]) {
            next[set.id] = {
              weight: set.weightValue?.toString() ?? '',
              reps: set.reps?.toString() ?? '',
              completed: Boolean(set.weightValue != null || set.reps != null),
            };
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
      }),
    onSuccess: refreshSession,
  });

  const saveSetMutation = useMutation({
    mutationFn: ({ setId, draft, set }: { setId: string; draft: SetDraft; set: WorkoutSet }) =>
      api.patch<WorkoutSet>(`/workout-sets/${setId}`, {
        setType: set.setType,
        weightValue: parseNumber(draft.weight),
        weightUnit: parseNumber(draft.weight) != null ? set.weightUnit ?? 'lb' : undefined,
        reps: parseNumber(draft.reps),
      }),
    onSuccess: refreshSession,
  });

  const addExerciseMutation = useMutation({
    mutationFn: (exerciseId: string) => api.post(`/workout-sessions/${resolvedSessionId}/exercises`, { exerciseId }),
    onSuccess: async () => {
      setShowAddExercise(false);
      setSelectedExerciseId('');
      await refreshSession();
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${resolvedSessionId}/complete`),
    onSuccess: async () => {
      await refreshSession();
      router.replace({ pathname: '/session-summary', params: { sessionId: resolvedSessionId! } });
    },
  });

  const historyByExerciseId = useMemo(
    () =>
      new Map(
        (sessionQuery.data?.exercises ?? []).map((exerciseLog, index) => [
          exerciseLog.exerciseId,
          historyQueries[index]?.data?.items
            ?.filter((item) => item.sessionId !== sessionQuery.data?.id)
            .map((item) => ({ weightValue: item.weightValue, reps: item.reps })) ?? [],
        ]),
      ),
    [historyQueries, sessionQuery.data],
  );

  const addableExercises = useMemo(() => {
    const usedExerciseIds = new Set((sessionQuery.data?.exercises ?? []).map((exerciseLog) => exerciseLog.exerciseId));
    return (exercisesQuery.data ?? []).filter((exercise) => !usedExerciseIds.has(exercise.id));
  }, [exercisesQuery.data, sessionQuery.data]);

  const totalVolume = useMemo(
    () => calculateVolume((sessionQuery.data?.exercises ?? []).flatMap((exerciseLog) => exerciseLog.sets)),
    [sessionQuery.data],
  );

  const bestEstimated1rm = useMemo(() => {
    const values = (sessionQuery.data?.exercises ?? [])
      .flatMap((exerciseLog) => exerciseLog.sets)
      .filter((set) => set.weightValue != null && set.reps != null)
      .map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
    return values.length ? `${Math.round(Math.max(...values))} lb` : '—';
  }, [sessionQuery.data]);

  const isLoading = todayQuery.isLoading || resumeSessionMutation.isPending || sessionQuery.isLoading || exercisesQuery.isLoading;
  const isError = todayQuery.isError || resumeSessionMutation.isError || sessionQuery.isError || exercisesQuery.isError;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas }]}> 
        <ActivityIndicator color={theme.action.primary} />
      </View>
    );
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
          <Stat label="Sets" value={`${sessionQuery.data.exercises.reduce((sum, exerciseLog) => sum + exerciseLog.sets.length, 0)}`} />
          <Stat label="Volume" value={totalVolume ? `${totalVolume.toLocaleString()} lb` : '—'} />
          <Stat label="Best 1RM" value={bestEstimated1rm} />
        </View>
      </Card>

      {sessionQuery.data.exercises.map((exerciseLog) => (
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
                  Set {index + 1} · {formatSetValue(set)}
                </Text>
              ))}
            </Card>
          ) : null}

          {exerciseLog.sets.map((set, index) => {
            const draft = drafts[set.id] ?? {
              weight: set.weightValue?.toString() ?? '',
              reps: set.reps?.toString() ?? '',
              completed: Boolean(set.weightValue != null || set.reps != null),
            };
            const previous = getPreviousLabel(exerciseLog.previousSession?.sets[index]);
            const history = historyByExerciseId.get(exerciseLog.exerciseId) ?? [];
            const candidate = { weightValue: parseNumber(draft.weight) ?? null, reps: parseNumber(draft.reps) ?? null };
            const isPr = draft.completed && (detectWeightPR(candidate, history) || detectRepPR(candidate, history));
            const planned = summarizePrescription(exerciseLog.prescription).replace(/^Planned:\s*/, '');

            return (
              <View key={set.id} style={styles.setBlock}>
                <View style={styles.setBlockHeader}>
                  <Text style={[styles.setMeta, { color: theme.text.secondary }]}>Set {index + 1}</Text>
                  <Text style={[styles.setMeta, { color: theme.text.secondary }]}>Target {planned}</Text>
                </View>
                <SetRowEditable
                  setLabel={`Set ${index + 1}`}
                  weight={draft.weight}
                  reps={draft.reps}
                  onChangeWeight={(value) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, weight: value } }))}
                  onChangeReps={(value) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, reps: value } }))}
                  completed={draft.completed}
                  onToggleCompleted={(completed) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, completed } }))}
                  previousWeight={previous.previousWeight}
                  previousReps={previous.previousReps}
                  isPr={isPr || set.isPrWeight || set.isPrReps}
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
                    disabled={sessionQuery.data.status === 'completed'}
                    onPress={() => saveSetMutation.mutate({ setId: set.id, draft, set })}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      ))}

      <Card>
        <Text style={[styles.sectionLabel, { color: theme.text.primary }]}>Add exercise</Text>
        <Select
          value={selectedExerciseId}
          onChange={setSelectedExerciseId}
          options={[
            { value: '', label: addableExercises.length ? 'Select exercise' : 'No more exercises available' },
            ...addableExercises.map((exercise) => ({ value: exercise.id, label: exercise.name })),
          ]}
        />
        <View style={styles.addSetRow}>
          <IconButton icon={Plus} accessibilityLabel="Toggle add exercise" onPress={() => setShowAddExercise((value) => !value)} />
          <Text style={{ color: theme.action.primary }} onPress={() => setShowAddExercise((value) => !value)}>
            Add exercise
          </Text>
        </View>
        {showAddExercise ? (
          <Button
            label="Confirm add exercise"
            disabled={!selectedExerciseId}
            loading={addExerciseMutation.isPending}
            onPress={() => addExerciseMutation.mutate(selectedExerciseId)}
          />
        ) : null}
      </Card>
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
