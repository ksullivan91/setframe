import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Prescription,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
} from '@setframe/schemas';
import {
  buildCompletedExerciseReadout,
  formatPreviousSetCompact,
  getPrescriptionDefinition,
  isExerciseComplete,
  isSessionSetLogged,
  parseOptionalNumber,
  quickEntryFields,
  summarizePrescription,
  visibleSessionExercises,
  type SessionField,
} from '@setframe/domain';
import { useApiClient } from '../../src/lib/api-client';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ExerciseTableCard, CARD_WIDTH } from '../../src/components/workout-v2/ExerciseTableCard';
import {
  SetRowV2,
  type SetRowStatus,
  type SetRowValues,
} from '../../src/components/workout-v2/SetRowV2';

/**
 * Today's Workout, v2 — the table-format logger, native.
 *
 * The counterpart of `apps/web/src/pages/WorkoutSessionPageV2.tsx`, built
 * alongside the v1 screen rather than replacing it so the two can be compared
 * on real data. Route: /workout-v2/:sessionId.
 *
 * Design of record: docs/design/workout-logging-table.md and
 * workout-logging-interactions.md. ADR 0011 has the why.
 */

type RowSyncState = Record<string, 'pending' | 'error' | undefined>;

const EMPTY_VALUES: SetRowValues = { weight: '', reps: '', duration: '', distance: '', rpe: '' };

export default function WorkoutSessionV2Screen() {
  const { sessionId: raw } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  const api = useApiClient();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [sync, setSync] = useState<RowSyncState>({});

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });

  const saveSet = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: Record<string, unknown> }) =>
      api.patch<WorkoutSet>(`/workout-sets/${setId}`, body),
    onMutate: ({ setId }) => setSync((prev) => ({ ...prev, [setId]: 'pending' })),
    onError: (_error, { setId }) => setSync((prev) => ({ ...prev, [setId]: 'error' })),
    onSuccess: async (_data, { setId }) => {
      setSync((prev) => ({ ...prev, [setId]: undefined }));
      await invalidate();
    },
  });

  const addSet = useMutation({
    mutationFn: (exerciseLogId: string) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, {}),
    onSuccess: invalidate,
  });

  const finish = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${sessionId}/complete`),
    onSuccess: invalidate,
  });

  const session = query.data;
  const exercises = useMemo(
    () => (session ? visibleSessionExercises(session.exercises) : []),
    [session],
  );

  if (!session) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Loading…</Text>
      </View>
    );
  }

  const sessionComplete = session.status === 'completed';
  const totalVolume = exercises.reduce(
    (sum, log) => sum + log.sets.reduce((s, set) => s + (set.weightValue ?? 0) * (set.reps ?? 0), 0),
    0,
  );
  const loggedSets = exercises.reduce(
    (n, log) => n + log.sets.filter((set) => isSessionSetLogged(log.prescription, set)).length,
    0,
  );
  const plannedSets = exercises.reduce((n, log) => n + log.sets.length, 0);

  const commit = (log: WorkoutSessionExerciseDetail, set: WorkoutSet, values: SetRowValues) => {
    const definition = getPrescriptionDefinition(log.prescription);
    const body: Record<string, unknown> = {};
    for (const field of quickEntryFields(definition)) {
      const key = field === 'weight' ? 'weightValue' : field;
      body[key] = parseOptionalNumber(values[field]) ?? null;
    }
    /* A half-filled row is simply not written — not an error, not a nag. */
    const wouldBeLogged = definition.requiredFields
      .filter((field) => field !== 'setType')
      .every((field) => body[field === 'weight' ? 'weightValue' : field] != null);
    if (!wouldBeLogged) return;
    saveSet.mutate({ setId: set.id, body });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]} testID="workout-v2">
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface.raised, borderBottomColor: theme.border.subtle },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to Today"
              style={styles.back}
            >
              <Text style={[styles.backGlyph, { color: theme.text.secondary }]}>‹</Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
              {sessionComplete ? 'Workout complete' : 'Workout session'}
            </Text>
          </View>
          {sessionComplete ? null : (
            <Pressable
              onPress={() => finish.mutate()}
              style={[styles.finish, { backgroundColor: theme.action.primary }]}
              accessibilityRole="button"
            >
              <Text style={[styles.finishText, { color: theme.action.primaryText }]}>Finish</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.meta, { color: theme.text.secondary }]} testID="session-meta">
          {totalVolume.toLocaleString('en-US')} lb · {loggedSets} of {plannedSets} sets
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {exercises.map((log) => {
          const definition = getPrescriptionDefinition(log.prescription);
          const fields = visibleFields(definition);
          const complete = isExerciseComplete(log.prescription, log.sets);
          const readout = complete
            ? buildCompletedExerciseReadout(
                log.prescription,
                log.sets,
                log.previousSession?.sets ?? null,
              )
            : null;
          const volume = log.sets.reduce(
            (s, set) => s + (set.weightValue ?? 0) * (set.reps ?? 0),
            0,
          );

          return (
            <ExerciseTableCard
              key={log.id}
              testID={`exercise-card-${log.id}`}
              exerciseName={log.exercise.name}
              planLabel={summarizePrescription(log.prescription)}
              resultLabel={
                readout
                  ? `${volume.toLocaleString('en-US')} lb${
                      readout.comparison ? ` · ${readout.comparison.compactLabel}` : ''
                    }`
                  : null
              }
              resultTone={
                readout?.comparison?.direction === 'down'
                  ? 'down'
                  : readout?.comparison?.direction === 'up'
                    ? 'up'
                    : 'neutral'
              }
              complete={complete}
              fields={fields}
              onAddSet={() => addSet.mutate(log.id)}
              onOpenActions={() => undefined}
            >
              {log.sets.map((set, index) => {
                const previousSet = log.previousSession?.sets[index];
                const state = sync[set.id];
                const logged = isSessionSetLogged(log.prescription, set);
                const status: SetRowStatus =
                  state === 'error'
                    ? 'error'
                    : state === 'pending'
                      ? 'pending'
                      : set.isPrWeight || set.isPrReps
                        ? 'pr'
                        : logged
                          ? 'saved'
                          : 'empty';

                return (
                  <SetRowV2
                    key={set.id}
                    setId={set.id}
                    label={set.setType === 'warmup' ? 'W' : String(workingIndex(log.sets, index))}
                    status={status}
                    exerciseName={log.exercise.name}
                    fields={fields}
                    values={{
                      ...EMPTY_VALUES,
                      weight: set.weightValue?.toString() ?? '',
                      reps: set.reps?.toString() ?? '',
                      duration: set.durationSeconds?.toString() ?? '',
                      distance: set.distanceValue?.toString() ?? '',
                      rpe: set.rpe?.toString() ?? '',
                    }}
                    targets={targetsFor(log.prescription)}
                    previous={
                      previousSet ? formatPreviousSetCompact(log.prescription, previousSet) : null
                    }
                    onCommit={(values) => commit(log, set, values)}
                    onOpenSetType={() => undefined}
                    onCopyPrevious={() => undefined}
                    onRetry={() => setSync((prev) => ({ ...prev, [set.id]: undefined }))}
                  />
                );
              })}
            </ExerciseTableCard>
          );
        })}
      </ScrollView>

      {sessionComplete ? null : (
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: theme.surface.raised, borderTopColor: theme.border.subtle },
          ]}
        >
          <Pressable
            style={[styles.addExercise, { backgroundColor: theme.surface.sunken }]}
            accessibilityRole="button"
          >
            <Text style={[styles.addExerciseText, { color: theme.action.primary }]}>
              + Add exercise
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/**
 * RPE is an optional extra column, off by default — the table cannot spare a
 * permanent column for a field most sets leave blank. Governs the column only:
 * `commit` still writes every field the prescription supports.
 */
function visibleFields(
  definition: ReturnType<typeof getPrescriptionDefinition>,
): Exclude<SessionField, 'setType'>[] {
  return quickEntryFields(definition).filter((field) => field !== 'rpe');
}

/** Warm-ups take no number and do not advance the sequence. */
function workingIndex(sets: readonly WorkoutSet[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (sets[i]?.setType !== 'warmup') n += 1;
  }
  return n;
}

/** Planned targets, shown in placeholder tone until the user types over them. */
function targetsFor(prescription: Prescription | null | undefined): Partial<SetRowValues> {
  if (!prescription) return {};
  const p = prescription as unknown as Record<string, number | undefined>;
  const reps = p.repsMin ?? p.repsMax ?? p.topRepsMin ?? p.reps;
  const duration = p.durationMinutes != null ? p.durationMinutes * 60 : p.durationSeconds;
  return {
    reps: reps != null ? String(reps) : '',
    duration: duration != null ? String(duration) : '',
    distance: p.distanceMiles != null ? String(p.distanceMiles) : '',
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: 6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  back: { width: 24, height: 28, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 22, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  finish: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  finishText: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12 },
  body: { alignItems: 'center', gap: 12, padding: 16 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, alignItems: 'center' },
  addExercise: { width: CARD_WIDTH, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addExerciseText: { fontSize: 14, fontWeight: '600' },
});
