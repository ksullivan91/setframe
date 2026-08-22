import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { calculateVolume, estimateOneRepMax } from '@setframe/domain';
import { countsTowardVolume } from '../src/lib/prescription';
import type { WorkoutSessionDetail, WorkoutSet } from '@setframe/schemas';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { SetRowReadOnly } from '../src/components/SetRow';
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
  for (const exerciseLog of session.exercises) {
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
  return session.exercises.reduce((count, exerciseLog) => count + exerciseLog.sets.filter((set) => set.isPrWeight || set.isPrReps).length, 0);
}

function bestEstimated1rm(sets: WorkoutSet[]) {
  const values = sets.filter((set) => set.weightValue != null && set.reps != null).map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
  return values.length ? `${Math.round(Math.max(...values))} lb` : '—';
}

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  const sessionQuery = useQuery({
    queryKey: ['mobile-session-summary', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const allSets = useMemo(() => sessionQuery.data?.exercises.flatMap((exerciseLog) => exerciseLog.sets) ?? [], [sessionQuery.data]);
  // Only weighted strength work contributes volume; see Story 09.
  const volume = useMemo(
    () =>
      calculateVolume(
        (sessionQuery.data?.exercises ?? [])
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

      {sessionQuery.data.exercises.map((exerciseLog) => (
        <Card key={exerciseLog.id}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{exerciseLog.exercise.name}</Text>
          {exerciseLog.sets.map((set, index) => (
            <SetRowReadOnly
              key={set.id}
              setLabel={`Set ${index + 1}`}
              valueLabel={formatSet(set)}
              isPr={set.isPrWeight || set.isPrReps}
            />
          ))}
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
});
