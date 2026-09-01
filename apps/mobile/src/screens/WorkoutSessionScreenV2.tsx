import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  deriveWorkoutFromSession,
  formatPreviousSetCompact,
  formatSessionDuration,
  formatSessionMeta,
  formatSessionTotalSuffix,
  getPrescriptionDefinition,
  isExerciseComplete,
  isSessionSetLogged,
  parseOptionalNumber,
  quickEntryFields,
  durationToDisplay,
  displayToDurationSeconds,
  wireNameFor,
  summarizePrescription,
  visibleSessionExercises,
  type PickableExercise,
  type SessionField,
} from '@setframe/domain';
import { useApiClient } from '../lib/api-client';
import { createClientId } from '../lib/client-id';
import { useTheme } from '../theme/ThemeProvider';
import { ExerciseTableCard, CARD_WIDTH } from '../components/workout-v2/ExerciseTableCard';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';
import { ExerciseCardsSkeleton } from '../components/training-v2/TrainingSkeletons';
import { SetTypeSheet } from '../components/workout-v2/SetTypeSheet';
import { ExerciseActionsSheet } from '../components/workout-v2/ExerciseActionsSheet';
import { SaveAsWorkoutCard } from '../components/training-v2/SaveAsWorkoutCard';
import { useActionFeedback } from '../lib/useActionFeedback';
import { WatchSummaryCard } from '../components/watch/WatchSummaryCard';
import { HeartRateCard } from '../components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../components/watch/EffortByExerciseCard';
import { useSessionWatchWorkouts } from '../healthkit/useSessionWatchWorkouts';
import { useWatchSessionInsights } from '../healthkit/useWatchSessionInsights';
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

/**
 * What an exercise added mid-session is prescribed. See the web counterpart:
 * one row to log into, and weight-and-reps columns rather than every column
 * the unprescribed fallback declares.
 */
/** A body value as the cached set stores it: a number, or null when cleared. */
function numeric(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * A placeholder set, shown while the real one is created. Its `id` is the
 * `clientId` the server echoes back, so the row is stable across the swap.
 */
function draftSet(exerciseLogId: string, clientId: string, sortOrder: number) {
  const now = new Date().toISOString();
  return {
    id: clientId,
    exerciseLogId,
    clientId,
    sortOrder,
    setType: 'working' as const,
    weightValue: null,
    weightUnit: null,
    reps: null,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    rpe: null,
    completed: false,
    isPrWeight: false,
    isPrReps: false,
    createdAt: now,
    updatedAt: now,
  };
}

const DEFAULT_ADDED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };

export default function WorkoutSessionV2Screen() {
  const { sessionId: raw } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  const api = useApiClient();
  const feedback = useActionFeedback();
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
  const [setSheetFor, setSetSheetFor] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [rpeShownFor, setRpeShownFor] = useState<Record<string, boolean>>({});
  const [saveOfferDismissed, setSaveOfferDismissed] = useState(false);
  const [savedWorkoutName, setSavedWorkoutName] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });

  const sessionKey = ['workout-session', sessionId];

  /**
   * Writes a change straight into the cached session. Counterpart of the web
   * page's helper — every mutation on this screen is optimistic, because a
   * control that does nothing for a round trip reads as broken and gets
   * tapped again.
   */
  const patchCachedSession = (
    update: (session: WorkoutSessionDetail) => WorkoutSessionDetail,
  ) => {
    const previous = queryClient.getQueryData<WorkoutSessionDetail>(sessionKey);
    if (previous) queryClient.setQueryData(sessionKey, update(previous));
    return previous;
  };

  const saveSet = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: Record<string, unknown> }) =>
      api.patch<WorkoutSet>(`/workout-sets/${setId}`, body),
    onMutate: ({ setId, body }) => {
      setSync((prev) => ({ ...prev, [setId]: 'pending' }));
      /* The typed values land in the cache immediately, so the row keeps
         showing them instead of reverting to the server's older copy while
         the request is in flight. */
      const previous = patchCachedSession((session) => ({
        ...session,
        exercises: session.exercises.map((log) => ({
          ...log,
          sets: log.sets.map((item) =>
            item.id === setId
              ? {
                  ...item,
                  weightValue: numeric(body.weightValue) ?? item.weightValue,
                  reps: numeric(body.reps) ?? item.reps,
                  durationSeconds: numeric(body.durationSeconds) ?? item.durationSeconds,
                  distanceValue: numeric(body.distanceValue) ?? item.distanceValue,
                  rpe: 'rpe' in body ? (numeric(body.rpe) ?? null) : item.rpe,
                }
              : item,
          ),
        })),
      }));
      return { previous };
    },
    onError: (_error, { setId }, context) => {
      setSync((prev) => ({ ...prev, [setId]: 'error' }));
      /* Put back exactly what was there — a failed save must not leave the
         optimistic value on screen as though it had been written. */
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSuccess: async (_data, { setId }) => {
      setSync((prev) => ({ ...prev, [setId]: undefined }));
      await invalidate();
    },
  });

  const addSet = useMutation({
    /* `clientId` is REQUIRED by createWorkoutSetSchema, and posting `{}` made
       "+ Add set" fail with a 400 every time. It is the idempotency key, so
       the client generates it — that is what makes a retry converge rather
       than create a duplicate set. */
    mutationFn: ({ exerciseLogId, clientId }: { exerciseLogId: string; clientId: string }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, { clientId }),
    /* The row appears on tap and lands at the END of the list. Waiting for
       the round trip made the button look dead, and a dead-looking button
       gets tapped again. */
    onMutate: ({ exerciseLogId, clientId }) => {
      const previous = patchCachedSession((session) => ({
        ...session,
        exercises: session.exercises.map((log) =>
          log.id === exerciseLogId
            ? { ...log, sets: [...log.sets, draftSet(exerciseLogId, clientId, log.sets.length)] }
            : log,
        ),
      }));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
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
        /* Without a prescription the snapshot is null and the logger falls
           back to `unprescribedDefinition`, which declares EVERY field — the
           card rendered SET / PREVIOUS / LB / REPS / TIME / DISTANCE. */
        await api.post(`/workout-sessions/${sessionId}/exercises`, {
          exerciseId,
          prescription: DEFAULT_ADDED_PRESCRIPTION,
        });
      }
    },
    onSuccess: async () => {
      setPickerOpen(false);
      await invalidate();
    },
  
    onError: feedback.report('Could not add those exercises. Try again.'),
  });

  const changeSetType = useMutation({
    mutationFn: ({ setId, setType }: { setId: string; setType: string }) =>
      api.patch<WorkoutSet>(`/workout-sets/${setId}`, { setType }),
    onMutate: ({ setId, setType }) => {
      setSetSheetFor(null);
      const previous = patchCachedSession((session) => ({
        ...session,
        exercises: session.exercises.map((log) => ({
          ...log,
          sets: log.sets.map((item) =>
            item.id === setId ? { ...item, setType: setType as typeof item.setType } : item,
          ),
        })),
      }));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSuccess: invalidate,
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onMutate: (setId) => {
      setSetSheetFor(null);
      const previous = patchCachedSession((session) => ({
        ...session,
        exercises: session.exercises.map((log) => ({
          ...log,
          sets: log.sets.filter((item) => item.id !== setId),
        })),
      }));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSuccess: invalidate,
  });

  const removeExercise = useMutation({
    /* `skipped`, not a delete: story 34 treats a removed exercise as one that
       never happened for trends, while keeping the row so it is reversible. */
    mutationFn: (exerciseLogId: string) =>
      api.patch(`/workout-exercise-logs/${exerciseLogId}`, { skipped: true }),
    onMutate: (exerciseLogId) => {
      setActionsFor(null);
      const previous = patchCachedSession((session) => ({
        ...session,
        exercises: session.exercises.filter((log) => log.id !== exerciseLogId),
      }));
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSuccess: invalidate,
  });

  const saveAsWorkout = useMutation({
    /* With no plan yet the plan is created FIRST and the workout joins it — a
       new program is created active, and save-as-workout attaches to whatever
       is active. That ordering is what stops a saved workout landing
       somewhere the user never looks. */
    mutationFn: async ({ workoutName, programName }: { workoutName: string; programName?: string }) => {
      if (programName) {
        await api.post('/programs', { name: programName });
        await queryClient.invalidateQueries({ queryKey: ['programs'] });
      }
      return api.post<{ name: string }>(`/workout-sessions/${sessionId}/save-as-workout`, {
        name: workoutName,
      });
    },
    onSuccess: (created) => setSavedWorkoutName(created.name),
  
    onError: feedback.report('Could not save this as a workout. Try again.'),
  });

  const finish = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${sessionId}/complete`),
    onSuccess: invalidate,
  
    onError: feedback.report('Could not finish the workout. Your sets are saved — try again.'),
  });

  const session = query.data;
  const exercises = useMemo(
    () => (session ? visibleSessionExercises(session.exercises) : []),
    [session],
  );

  /*
   * ABOVE the early return, deliberately.
   *
   * This sat below `if (!session)`, which made it a CONDITIONAL hook: on the
   * first render the session is still loading and the component returns
   * early, so the hook never runs; once the session arrives it does, the hook
   * count changes, and React throws "Rendered more hooks than during the
   * previous render". Opening a completed workout crashed the screen.
   *
   * Optional chaining rather than reordering the whole component, matching
   * the web page, which has always had it in the right place.
   */
  const sessionCompleteForOffer = session?.status === 'completed';
  const sessionIsUnplanned = session?.templateId == null;
  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<{ id: string; isActive: boolean }[]>('/programs'),
    enabled: sessionCompleteForOffer && sessionIsUnplanned,
  });
  const hasActiveProgram = programs.some((program) => program.isActive);

  /* Story 45, and above the early return for exactly the reason written
     above: placing these below `if (!session)` made them conditional hooks
     and reproduced the crash that comment describes. Lint caught it.
     `useSessionWatchWorkouts` takes a nullable id and disables its query,
     so it is safe to call before the session exists. */
  const watch = useSessionWatchWorkouts(session?.id ?? null, {
    onError: feedback.report('Could not update Watch data. Try again.'),
  });
  const insights = useWatchSessionInsights({ workouts: watch.attached, exercises });

  if (!session) {
    /* The header is chrome, not data — rendering it immediately means the
       screen does not visibly reflow when the session arrives, and there is a
       back affordance during a slow load rather than a bare word. */
    return (
      <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]} testID="workout-v2-loading">
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
        {/* Content-shaped, so the body is not simply blank while the session
            loads — and sized so the real cards land where the placeholders
            were. */}
        {query.isError ? null : (
          <View style={{ padding: 16 }}>
            <ExerciseCardsSkeleton />
          </View>
        )}
      </View>
    );
  }

  const activeActions = exercises.find((log) => log.id === actionsFor) ?? null;
  const activeSetSheet = (() => {
    if (!setSheetFor) return null;
    for (const log of exercises) {
      const index = log.sets.findIndex((item) => item.id === setSheetFor);
      if (index === -1) continue;
      const set = log.sets[index]!;
      return {
        set,
        exerciseName: log.exercise.name,
        label: set.setType === 'warmup' ? 'W' : String(workingIndex(log.sets, index)),
      };
    }
    return null;
  })();

  const sessionComplete = session.status === 'completed';

  /* "Do this one again?" only makes sense for an UNPLANNED session — offering
     it after a planned one invites duplicating a workout you already have. */
  const isUnplanned = session.templateId == null;

  const derivedWorkout = (() => {
    const names = new Map(exercises.map((log) => [log.exerciseId, log.exercise.name]));
    return deriveWorkoutFromSession(
      exercises.map((log) => ({
        exerciseId: log.exerciseId,
        sets: log.sets.map((set) => ({
          setType: set.setType,
          reps: set.reps,
          weightValue: set.weightValue,
        })),
      })),
    ).map((item) => ({ ...item, name: names.get(item.exerciseId) ?? 'Exercise' }));
  })();
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
      const key = wireNameFor(field);
      const parsed = parseOptionalNumber(values[field]) ?? null;
      /* Duration is typed in the column's declared unit — minutes for a walk
         — and stored in seconds. */
      body[key] = field === 'duration' ? displayToDurationSeconds(parsed, definition) : parsed;
    }
    /* A half-filled row is simply not written — not an error, not a nag. */
    const wouldBeLogged = definition.requiredFields
      .filter((field) => field !== 'setType')
      .every((field) => body[wireNameFor(field)] != null);
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
              /* Finishing is a real round trip that then navigates away.
                 With no pending state a second tap fired a second complete
                 while the first was still in flight — and, since it also
                 had no error path, a failure looked identical to a button
                 that did nothing. */
              disabled={finish.isPending}
              testID="finish-workout"
              style={[
                styles.finish,
                { backgroundColor: theme.action.primary, opacity: finish.isPending ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: finish.isPending }}
            >
              {finish.isPending ? (
                <ActivityIndicator color={theme.action.primaryText} />
              ) : (
                <Text style={[styles.finishText, { color: theme.action.primaryText }]}>Finish</Text>
              )}
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: theme.text.secondary }]} testID="session-meta">
            {totalVolume.toLocaleString('en-US')} lb · {loggedSets} of {plannedSets} sets
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Under the banner, never over it: the workout is already recorded,
            so the offer must not block the acknowledgement of what was just
            done. */}
        {sessionComplete && isUnplanned && !saveOfferDismissed ? (
          savedWorkoutName ? (
            <Text style={[styles.savedNotice, { color: theme.text.secondary }]} testID="saved-workout-notice">
              Saved as {savedWorkoutName}. You can start it from Training whenever you like.
            </Text>
          ) : (
            <SaveAsWorkoutCard
              derived={derivedWorkout}
              needsProgram={!hasActiveProgram}
              onSave={(input) => saveAsWorkout.mutate(input)}
              onDismiss={() => setSaveOfferDismissed(true)}
              busy={saveAsWorkout.isPending}
            />
          )
        ) : null}
        {sessionComplete ? (
          <>
            <WatchSummaryCard workouts={watch.attached} />
            {insights.series && insights.model ? (
              <HeartRateCard
                series={insights.series}
                model={insights.model}
                startedAt={insights.startedAt!}
                endedAt={insights.endedAt!}
                selectedIndex={insights.selectedIndex}
                onSelect={insights.setSelectedIndex}
                maxIsEstimated={insights.maxIsEstimated}
              />
            ) : null}
            <EffortByExerciseCard efforts={insights.efforts} />
          </>
        ) : null}
        {exercises.map((log) => {
          const definition = getPrescriptionDefinition(log.prescription);
          /* RPE is off by default and toggled per exercise from its ⋯
             sheet, the only place the design offers it. */
          const baseFields = visibleFields(definition);
          const fields = rpeShownFor[log.id] ? ([...baseFields, 'rpe'] as const) : baseFields;
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
              onAddSet={() => addSet.mutate({ exerciseLogId: log.id, clientId: createClientId() })}
              onOpenActions={() => setActionsFor(log.id)}
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
                    /* Keyed on clientId, NOT id.
                    
                       An optimistic row is created with the clientId as its
                       id; the server then assigns a real uuid. Keying on `id`
                       therefore changed the key when the save landed, so
                       React unmounted the row and built a new one — taking
                       the focused input with it. Typing into a freshly added
                       set threw focus elsewhere and jumped the scroll.
                    
                       clientId is stable from the optimistic row through to
                       the persisted one, which is the whole reason it is
                       client-generated. */
                    key={set.clientId}
                    setId={set.id}
                    label={set.setType === 'warmup' ? 'W' : String(workingIndex(log.sets, index))}
                    status={status}
                    exerciseName={log.exercise.name}
                    fields={fields}
                    values={{
                      ...EMPTY_VALUES,
                      weight: set.weightValue?.toString() ?? '',
                      reps: set.reps?.toString() ?? '',
                      duration: durationToDisplay(set.durationSeconds, definition),
                      distance: set.distanceValue?.toString() ?? '',
                      rpe: set.rpe?.toString() ?? '',
                    }}
                    targets={targetsFor(log.prescription)}
                    previous={
                      previousSet ? formatPreviousSetCompact(log.prescription, previousSet) : null
                    }
                    onCommit={(values) => commit(log, set, values)}
                    onOpenSetType={() => setSetSheetFor(set.id)}
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
      {activeSetSheet ? (
        <SetTypeSheet
          exerciseName={activeSetSheet.exerciseName}
          setLabel={activeSetSheet.label}
          currentType={activeSetSheet.set.setType}
          onClose={() => setSetSheetFor(null)}
          onSelect={(setType) => changeSetType.mutate({ setId: activeSetSheet.set.id, setType })}
          onDelete={() => deleteSet.mutate(activeSetSheet.set.id)}
        />
      ) : null}

      {activeActions ? (
        <ExerciseActionsSheet
          exerciseName={activeActions.exercise.name}
          context={`${activeActions.sets.length} set${activeActions.sets.length === 1 ? '' : 's'} in this session`}
          rpeVisible={!!rpeShownFor[activeActions.id]}
          onClose={() => setActionsFor(null)}
          onViewHistory={() => router.push(`/exercise-history/${activeActions.exerciseId}`)}
          onToggleRpe={() =>
            setRpeShownFor((prev) => ({ ...prev, [activeActions.id]: !prev[activeActions.id] }))
          }
          onRemove={() => removeExercise.mutate(activeActions.id)}
        />
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <ExercisePickerV2
          exercises={catalogue}
          title="Add to this workout"
          onCancel={() => setPickerOpen(false)}
          onAdd={(ids) => addExercises.mutate(ids)}
          busy={addExercises.isPending}
        />
      </Modal>
      {feedback.node}
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
  savedNotice: { fontSize: 13, paddingVertical: 14, paddingHorizontal: 16 },
});
