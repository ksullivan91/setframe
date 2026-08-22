import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { calculateVolume, estimateOneRepMax } from '@setframe/domain';
import type { Exercise, ExerciseHistoryResponse, ExerciseProgressResponse } from '@setframe/schemas';
import { Card } from '../../src/components/Card';
import { Select } from '../../src/components/Select';
import { SetRowReadOnly } from '../../src/components/SetRow';
import { useApiClient } from '../../src/lib/api-client';
import { useTheme } from '../../src/theme/ThemeProvider';
import { spacing, typeScale } from '../../src/theme/getTheme';

/**
 * `Screen/Mobile/ExerciseHistory` per style guide §14 — explicitly NOT a
 * tab-bar destination (History stays web-nav-only per §13); a drill-in
 * screen (e.g. tapping an exercise name from a past session) with a
 * condensed single-row stat strip (top set, est. 1RM, last session
 * volume — no chart, per "keep charts restrained") and a shorter session
 * list than web's version.
 *
 * TODO: wire GET /v1/exercises/:exerciseId/history and
 * /v1/exercises/:exerciseId/progress (docs/api.md) once available.
 */
export default function ExerciseHistoryScreen() {
  const theme = useTheme();
  const api = useApiClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseId = typeof params.exerciseId === 'string' ? params.exerciseId : undefined;

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  const selectedExercise = useMemo(
    () => exercisesQuery.data?.find((exercise) => exercise.id === exerciseId) ?? null,
    [exerciseId, exercisesQuery.data],
  );

  const historyQuery = useQuery({
    queryKey: ['exercise-history', selectedExercise?.id],
    queryFn: () => api.get<ExerciseHistoryResponse>(`/exercises/${selectedExercise!.id}/history`),
    enabled: !!selectedExercise,
  });

  const progressQuery = useQuery({
    queryKey: ['exercise-progress', selectedExercise?.id],
    queryFn: () => api.get<ExerciseProgressResponse>(`/exercises/${selectedExercise!.id}/progress`),
    enabled: !!selectedExercise,
  });

  const sessionGroups = useMemo(() => {
    const grouped = new Map<string, ExerciseHistoryResponse['items']>();
    for (const item of historyQuery.data?.items ?? []) {
      const items = grouped.get(item.sessionId) ?? [];
      items.push(item);
      grouped.set(item.sessionId, items);
    }
    return [...grouped.values()].map((items) => ({
      sessionId: items[0]!.sessionId,
      date: items[0]!.sessionLocalDate,
      sessionName: items[0]!.sessionName,
      items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
      isPr: items.some((item) => item.isPrWeight || item.isPrReps),
    }));
  }, [historyQuery.data]);

  const topSet = useMemo(
    () =>
      (historyQuery.data?.items ?? []).reduce<ExerciseHistoryResponse['items'][number] | null>((best, item) => {
        if (item.weightValue == null || item.reps == null) return best;
        if (!best) return item;
        return estimateOneRepMax(item.weightValue, item.reps) > estimateOneRepMax(best.weightValue!, best.reps!) ? item : best;
      }, null),
    [historyQuery.data],
  );

  const estimatedOneRepMaxValue =
    topSet?.weightValue != null && topSet.reps != null ? Math.round(estimateOneRepMax(topSet.weightValue, topSet.reps)) : null;
  const lastSessionVolume =
    sessionGroups[0] != null
      ? calculateVolume(sessionGroups[0].items.map((item) => ({ weightValue: item.weightValue, reps: item.reps })))
      : 0;

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {selectedExercise ? `${selectedExercise.name} history` : 'Exercise history'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Pick an exercise to review session history, volume, personal records, and estimated strength trends.
        </Text>
      </View>

      {exercisesQuery.isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={theme.action.primary} />
          <Text style={[styles.stateText, { color: theme.text.secondary }]}>Loading exercises…</Text>
        </View>
      ) : exercisesQuery.isError || !exercisesQuery.data ? (
        <View style={styles.centeredState}>
          <Text style={[styles.stateTitle, { color: theme.text.primary }]}>Couldn't load exercises.</Text>
        </View>
      ) : exercisesQuery.data.length === 0 ? (
        <View style={styles.centeredState}>
          <Text style={[styles.stateTitle, { color: theme.text.primary }]}>No exercises available</Text>
        </View>
      ) : (
        <>
          <Select
            label="Exercise"
            value={selectedExercise?.id ?? ''}
            options={exercisesQuery.data.map((exercise) => ({ value: exercise.id, label: exercise.name }))}
            onChange={(value) => router.replace(`/exercise-history/${value}`)}
          />

          {!exerciseId ? (
            <View style={styles.centeredState}>
              <Text style={[styles.stateTitle, { color: theme.text.primary }]}>Choose an exercise</Text>
              <Text style={[styles.stateText, { color: theme.text.secondary }]}>
                Select an exercise above to view its history.
              </Text>
            </View>
          ) : !selectedExercise ? (
            <View style={styles.centeredState}>
              <Text style={[styles.stateTitle, { color: theme.text.primary }]}>Exercise not found</Text>
              <Text style={[styles.stateText, { color: theme.text.secondary }]}>
                Select a valid exercise from the list above.
              </Text>
            </View>
          ) : historyQuery.isLoading || progressQuery.isLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={theme.action.primary} />
              <Text style={[styles.stateText, { color: theme.text.secondary }]}>Loading history…</Text>
            </View>
          ) : historyQuery.isError || progressQuery.isError ? (
            <View style={styles.centeredState}>
              <Text style={[styles.stateTitle, { color: theme.text.primary }]}>Couldn't load history.</Text>
              <Text style={[styles.stateText, { color: theme.text.secondary }]}>
                Pull to refresh and try again.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.statStrip}>
                <Stat label="Top set" value={topSet ? `${topSet.weightValue} × ${topSet.reps}` : '—'} />
                <Stat label="Est. 1RM" value={estimatedOneRepMaxValue != null ? `${estimatedOneRepMaxValue} lb` : '—'} />
                <Stat label="Last volume" value={lastSessionVolume ? `${lastSessionVolume.toLocaleString()} lb` : '—'} />
              </View>

              <Card>
                <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Recent progress</Text>
                {progressQuery.data?.points.length ? (
                  progressQuery.data.points.slice(-5).reverse().map((point) => (
                    <View key={point.sessionId} style={styles.progressRow}>
                      <Text style={[styles.sessionDate, { color: theme.text.primary }]}>{formatSessionDate(point.localDate)}</Text>
                      <Text style={[styles.progressMeta, { color: theme.text.secondary }]}>
                        {point.estimatedOneRepMax != null ? `${point.estimatedOneRepMax} lb est. 1RM` : 'Need load + reps'} ·{' '}
                        {point.topWeight != null && point.topReps != null ? `top set ${point.topWeight} × ${point.topReps}` : 'no top set'}
                      </Text>
                      <Text style={[styles.progressMeta, { color: theme.text.secondary }]}>
                        {point.volume.toLocaleString()} lb volume
                        {point.isWeightPr || point.isRepPr
                          ? ` · ${[point.isWeightPr ? 'Weight PR' : null, point.isRepPr ? 'Rep PR' : null].filter(Boolean).join(' + ')}`
                          : ''}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.stateText, { color: theme.text.secondary }]}>
                    No {selectedExercise.name.toLowerCase()} progress yet.
                  </Text>
                )}
              </Card>

              {sessionGroups.length === 0 ? (
                <View style={styles.centeredState}>
                  <Text style={[styles.stateTitle, { color: theme.text.primary }]}>
                    No {selectedExercise.name.toLowerCase()} history yet
                  </Text>
                  <Text style={[styles.stateText, { color: theme.text.secondary }]}>
                    Complete a workout containing {selectedExercise.name} and your sets will appear here.
                  </Text>
                </View>
              ) : (
                sessionGroups.map((session) => (
                  <Card key={session.sessionId}>
                    <Text style={[styles.sessionDate, { color: theme.text.primary }]}>
                      {session.sessionName} · {formatSessionDate(session.date)}
                    </Text>
                    {session.items.map((set, index) => (
                      <SetRowReadOnly
                        key={set.setId}
                        setLabel={`Set ${index + 1}`}
                        valueLabel={formatSetValue(set)}
                        isPr={set.isPrWeight || set.isPrReps || session.isPr}
                      />
                    ))}
                  </Card>
                ))
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function formatSessionDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatSetValue(item: ExerciseHistoryResponse['items'][number]) {
  if (item.weightValue != null && item.reps != null) {
    return `${item.weightValue} × ${item.reps}`;
  }
  if (item.durationSeconds != null) {
    return `${item.durationSeconds}s`;
  }
  if (item.distanceValue != null && item.distanceUnit) {
    return `${item.distanceValue} ${item.distanceUnit}`;
  }
  return '—';
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.text.secondary }]}>{label}</Text>
    </View>
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
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.caption.fontSize,
  },
  statStrip: {
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
    fontSize: typeScale.numericMetric.fontSize,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: typeScale.label.fontSize,
  },
  sessionDate: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  progressRow: {
    gap: spacing[4],
  },
  progressMeta: {
    fontSize: typeScale.compactBody.fontSize,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
  stateTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateText: {
    fontSize: typeScale.compactBody.fontSize,
    textAlign: 'center',
  },
});
