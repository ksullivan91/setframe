import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trophy } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculateVolume, estimateOneRepMax, visibleSessionExercises } from '@setframe/domain';
import { countsTowardVolume } from '../src/lib/prescription';
import type { WorkoutSessionDetail, WorkoutSet } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { SetRowReadOnly } from '../src/components/SetRow';
import { SetEditSheet, type SetEditPatch } from '../src/components/SetEditSheet';
import { Toast } from '../src/components/Toast';
import { useApiClient } from '../src/lib/api-client';
import { useTheme } from '../src/theme/ThemeProvider';
import { spacing, typeScale } from '../src/theme/getTheme';

function formatDuration(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return '—';
  const minutes = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${minutes} min`;
}

function formatDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function findPrSet(session: WorkoutSessionDetail) {
  for (const exerciseLog of visibleSessionExercises(session.exercises)) {
    const prSet = exerciseLog.sets.find((set) => set.isPrWeight || set.isPrReps);
    if (prSet) return { exerciseName: exerciseLog.exercise.name, set: prSet, previous: exerciseLog.previousSession?.sets.at(-1) };
  }
  return null;
}

function formatSet(set: { weightValue: number | null; weightUnit?: string | null; reps: number | null }) {
  const weight = set.weightValue != null ? `${set.weightValue} ${set.weightUnit ?? 'lb'}` : '—';
  const reps = set.reps != null ? `${set.reps}` : '—';
  return `${weight} × ${reps}`;
}

function totalPrs(session: WorkoutSessionDetail) {
  return visibleSessionExercises(session.exercises).reduce((count, exerciseLog) => count + exerciseLog.sets.filter((set) => set.isPrWeight || set.isPrReps).length, 0);
}

function bestEstimated1rm(sets: WorkoutSet[]) {
  const values = sets.filter((set) => set.weightValue != null && set.reps != null).map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
  return values.length ? `${Math.round(Math.max(...values))} lb` : '—';
}

interface EditTarget {
  set: WorkoutSet;
  setLabel: string;
  exerciseName: string;
  prescription: WorkoutSessionDetail['exercises'][number]['prescription'];
}

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['mobile-session-summary', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  // A correction here can change volume/e1RM/PRs, all derived live from
  // sets on every fetch — refetching this query and the ones that surface
  // the same session elsewhere is the entire cache-invalidation story.
  const saveSetMutation = useMutation({
    mutationFn: ({ setId, patch }: { setId: string; patch: SetEditPatch }) => api.patch<WorkoutSet>(`/workout-sets/${setId}`, patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mobile-session-summary', sessionId] }),
        // The logger route can stay mounted with this same session's id
        // cached under its own key (it invalidates the same pair on every
        // set mutation it makes itself, for the same reason) — without
        // this, an edit made here wouldn't show up if the user goes back.
        queryClient.invalidateQueries({ queryKey: ['mobile-workout-session', sessionId] }),
        queryClient.invalidateQueries({ queryKey: ['today'] }),
        queryClient.invalidateQueries({ queryKey: ['exercise-history'] }),
        queryClient.invalidateQueries({ queryKey: ['exercise-progress'] }),
        queryClient.invalidateQueries({ queryKey: ['progress-overview'] }),
      ]);
      setEditTarget(null);
      setToast({ variant: 'success', message: 'Set updated.' });
    },
    onError: () => setToast({ variant: 'error', message: "Couldn't save that set. Try again." }),
  });

  const allSets = useMemo(
    () => visibleSessionExercises(sessionQuery.data?.exercises ?? []).flatMap((exerciseLog) => exerciseLog.sets),
    [sessionQuery.data],
  );
  // Only weighted strength work contributes volume; see Story 09.
  const volume = useMemo(
    () =>
      calculateVolume(
        visibleSessionExercises(sessionQuery.data?.exercises ?? [])
          .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
          .flatMap((exerciseLog) => exerciseLog.sets),
      ),
    [sessionQuery.data],
  );
  const prSummary = useMemo(() => (sessionQuery.data ? findPrSet(sessionQuery.data) : null), [sessionQuery.data]);

  if (sessionQuery.isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas }]}> 
        <ActivityIndicator color={theme.action.primary} />
      </View>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16] }]}> 
        <Text style={{ color: theme.text.primary, textAlign: 'center' }}>Couldn&apos;t load session summary.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text.primary }]}>{sessionQuery.data.status === 'completed' ? 'Workout complete' : 'Workout summary'}</Text>
      <Text style={[styles.date, { color: theme.text.secondary }]}>{formatDate(sessionQuery.data.localDate)}</Text>

      <View style={styles.statRow}>
        <Stat label="Duration" value={formatDuration(sessionQuery.data.startedAt, sessionQuery.data.completedAt)} />
        <Stat label="Volume" value={volume ? `${volume.toLocaleString()} lb` : '—'} />
        <Stat label="PRs" value={`${totalPrs(sessionQuery.data)}`} />
      </View>

      {prSummary ? (
        <Card style={[styles.prCard, { backgroundColor: theme.action.accentSubtle }]}>
          <View style={styles.prHeader}>
            <Trophy size={20} color={theme.action.primary} />
            <Text style={[styles.prTitle, { color: theme.action.primary }]}>New PR</Text>
          </View>
          <Text style={{ color: theme.text.primary }}>
            {prSummary.exerciseName} — {formatSet(prSummary.set)}
            {prSummary.previous ? `, up from ${formatSet(prSummary.previous)}` : ''}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Session stats</Text>
        <SetRowReadOnly setLabel="Sets logged" valueLabel={`${allSets.length}`} />
        <SetRowReadOnly setLabel="Best est. 1RM" valueLabel={bestEstimated1rm(allSets)} />
      </Card>

      {visibleSessionExercises(sessionQuery.data.exercises).map((exerciseLog) => (
        <Card key={exerciseLog.id}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{exerciseLog.exercise.name}</Text>
          {exerciseLog.sets.map((set, index) => {
            const setLabel = `Set ${index + 1}`;
            return (
              <Pressable
                key={set.id}
                onPress={() =>
                  setEditTarget({ set, setLabel, exerciseName: exerciseLog.exercise.name, prescription: exerciseLog.prescription })
                }
                accessibilityRole="button"
                accessibilityLabel={`Edit ${setLabel.toLowerCase()}, ${exerciseLog.exercise.name}`}
                style={styles.editableSetRow}
              >
                <View style={{ flex: 1 }}>
                  <SetRowReadOnly setLabel={setLabel} valueLabel={formatSet(set)} isPr={set.isPrWeight || set.isPrReps} />
                </View>
                <Pencil size={16} color={theme.text.secondary} />
              </Pressable>
            );
          })}
        </Card>
      ))}

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Button label="Share" variant="secondary" onPress={() => {}} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Done" onPress={() => router.replace('/(tabs)/today')} />
        </View>
      </View>

      {editTarget ? (
        <SetEditSheet
          setLabel={editTarget.setLabel}
          exerciseName={editTarget.exerciseName}
          set={editTarget.set}
          prescription={editTarget.prescription}
          onClose={() => setEditTarget(null)}
          onSave={(patch) => saveSetMutation.mutate({ setId: editTarget.set.id, patch })}
          isSaving={saveSetMutation.isPending}
        />
      ) : null}

      {toast ? <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} /> : null}
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
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  date: {
    fontSize: typeScale.compactBody.fontSize,
  },
  statRow: {
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
  prCard: {
    borderWidth: 0,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  prTitle: {
    fontWeight: '600',
    fontSize: typeScale.sectionTitle.fontSize,
  },
  sectionTitle: {
    fontWeight: '600',
    fontSize: typeScale.sectionTitle.fontSize,
  },
  editableSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
});
