import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Prescription,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
} from '@setframe/schemas';
import {
  buildCompletedExerciseReadout,
  buildCompletedSessionReadout,
  formatPreviousSetCompact,
  formatSessionDuration,
  formatSessionMeta,
  formatSessionTotalSuffix,
  getPrescriptionDefinition,
  isExerciseComplete,
  isSessionSetLogged,
  parseOptionalNumber,
  quickEntryFields,
  summarizePrescription,
  visibleSessionExercises,
  type PickableExercise,
  type SessionField,
} from '@setframe/domain';
import { useApiClient } from '../lib/api-client';
import { useTheme } from '../theme/ThemeProvider';
import { ExerciseTableCard, CARD_WIDTH } from '../components/workout-v2/ExerciseTableCard';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';
import {
  SetRowV2,
  type SetRowStatus,
  type SetRowValues,
} from '../components/workout-v2/SetRowV2';

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
  /* The native stack header is disabled for this route because v2 draws its
     own, so the status bar inset is now this screen's job. Same rule as the
     web build's env(safe-area-inset-top). */
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [sync, setSync] = useState<RowSyncState>({});

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const [pickerOpen, setPickerOpen] = useState(false);

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

  const { data: catalogue = [] } = useQuery({
    queryKey: ['exercises'],
    /* Only fetched once the picker opens — the catalogue is large and the
       logger does not otherwise need it. */
    queryFn: () => api.get<PickableExercise[]>('/exercises'),
    enabled: pickerOpen,
  });

  const addExercises = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      /* Sequential, not Promise.all: sortOrder comes from insertion order
         server-side, and the picker promises they are added in the order
         picked — parallel posts would race that promise. */
      for (const exerciseId of exerciseIds) {
        await api.post(`/workout-sessions/${sessionId}/exercises`, { exerciseId });
      }
    },
    onSuccess: async () => {
      setPickerOpen(false);
      await invalidate();
    },
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
    /* The header is chrome, not data — rendering it immediately means the
       screen does not visibly reflow when the session arrives, and there is a
       back affordance during a slow load rather than a bare word. */
    return (
      <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]} testID="workout-v2">
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 16,
              backgroundColor: theme.surface.raised,
              borderBottomColor: theme.border.subtle,
            },
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
              <Text style={[styles.title, { color: theme.text.primary }]}>Workout session</Text>
            </View>
          </View>
          <Text style={[styles.meta, { color: theme.text.secondary }]}>
            {query.isError ? "Couldn't load this workout." : 'Loading…'}
          </Text>
        </View>
      </View>
    );
  }

  const sessionComplete = session.status === 'completed';
  /* The same shared readout web uses — the banner is the most prominent
     surface in the product and its numbers must not differ by platform. */
  const sessionReadout = buildCompletedSessionReadout(exercises);
  const totalVolume = sessionReadout.totalVolume;
  const loggedSets = sessionReadout.loggedSetCount;
  const plannedSets = exercises.reduce((n, log) => n + log.sets.length, 0);
  const duration = formatSessionDuration(session.startedAt, session.completedAt);
  const sessionDate = new Date(session.localDate + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

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
      {sessionComplete ? (
        /* The session's strongest reward, and the only place a green wash
           appears — the completed exercise cards deliberately stay white with
           a tinted border so this stays distinct from them. */
        <View
          style={[
            styles.banner,
            {
              paddingTop: insets.top + 16,
              backgroundColor: theme.status.success + '1F',
              borderBottomColor: theme.status.success + '40',
            },
          ]}
          testID="completion-banner"
        >
          <View style={styles.headerRow}>
            <View style={styles.bannerMark}>
              <View
                style={[
                  styles.bannerRing,
                  { backgroundColor: theme.surface.raised, borderColor: theme.status.success },
                ]}
              >
                <Text style={[styles.bannerCheck, { color: theme.status.success }]}>✓</Text>
              </View>
              <Text style={[styles.bannerTitle, { color: theme.text.primary }]}>
                Workout complete
              </Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              style={[styles.finish, { backgroundColor: theme.action.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={[styles.finishText, { color: theme.action.primaryText }]}>Done</Text>
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: theme.text.secondary }]} testID="banner-meta">
            {formatSessionMeta({
              title: sessionDate,
              duration,
              loggedSetCount: loggedSets,
              personalRecordCount: sessionReadout.personalRecordCount,
            })}
          </Text>
          <View style={styles.bannerTotal}>
            <Text style={[styles.bannerTotalValue, { color: theme.text.primary }]}>
              {totalVolume.toLocaleString('en-US')}
            </Text>
            <Text
              style={[styles.bannerTotalUnit, { color: theme.text.secondary }]}
              testID="banner-total-suffix"
            >
              {formatSessionTotalSuffix(sessionReadout)}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 16,
              backgroundColor: theme.surface.raised,
              borderBottomColor: theme.border.subtle,
            },
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
                Workout session
              </Text>
            </View>
            <Pressable
              onPress={() => finish.mutate()}
              style={[styles.finish, { backgroundColor: theme.action.primary }]}
              accessibilityRole="button"
            >
              <Text style={[styles.finishText, { color: theme.action.primaryText }]}>Finish</Text>
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: theme.text.secondary }]} testID="session-meta">
            {totalVolume.toLocaleString('en-US')} lb · {loggedSets} of {plannedSets} sets
          </Text>
        </View>
      )}

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
            {
              /* Home indicator, not a literal — matches the web build's
                 env(safe-area-inset-bottom). */
              paddingBottom: Math.max(insets.bottom, 20),
              backgroundColor: theme.surface.raised,
              borderTopColor: theme.border.subtle,
            },
          ]}
        >
          <Pressable
            style={[styles.addExercise, { backgroundColor: theme.surface.sunken }]}
            accessibilityRole="button"
            testID="add-exercise"
            onPress={() => setPickerOpen(true)}
          >
            <Text style={[styles.addExerciseText, { color: theme.action.primary }]}>
              + Add exercise
            </Text>
          </Pressable>
        </View>
      )}

      {/* Full-screen, not a bottom sheet: the picker has its own header,
          scroll region and footer, and is the whole screen in the design. */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <ExercisePickerV2
          exercises={catalogue}
          title="Add to this workout"
          onCancel={() => setPickerOpen(false)}
          onAdd={(ids) => addExercises.mutate(ids)}
          busy={addExercises.isPending}
        />
      </Modal>
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
  banner: { gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1 },
  bannerMark: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  bannerRing: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCheck: { fontSize: 14, fontWeight: '600' },
  bannerTitle: { fontSize: 22, fontWeight: '600', flexShrink: 1 },
  bannerTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bannerTotalValue: { fontSize: 32, fontWeight: '600' },
  bannerTotalUnit: { fontSize: 13, fontWeight: '500' },
  body: { alignItems: 'center', gap: 12, padding: 16 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, alignItems: 'center' },
  addExercise: { width: CARD_WIDTH, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addExerciseText: { fontSize: 14, fontWeight: '600' },
});
