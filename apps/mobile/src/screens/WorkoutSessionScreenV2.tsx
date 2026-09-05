import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SetDraftStore } from '../lib/setDraftStore';
import {
  KeyboardAwareScrollProvider,
  useKeyboardAwareScrollProps,
} from '../lib/keyboardAwareScroll';
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
import { LoggerHeader } from '../components/workout-v2/LoggerHeader';
import { EmptySessionCard } from '../components/workout-v2/EmptySessionCard';
import { FinishConfirmSheet } from '../components/workout-v2/FinishConfirmSheet';
import { LoggerCompleteBanner } from '../components/workout-v2/LoggerCompleteBanner';
import { SaveAsWorkoutCard } from '../components/training-v2/SaveAsWorkoutCard';
import { useActionFeedback } from '../lib/useActionFeedback';
import { WatchSummaryCard } from '../components/watch/WatchSummaryCard';
import { WatchAttachCard } from '../components/watch/WatchAttachCard';
import { HeartRateCard } from '../components/watch/HeartRateCard';
import { EffortByExerciseCard } from '../components/watch/EffortByExerciseCard';
import { useSessionWatchWorkouts, candidatesForSession } from '../healthkit/useSessionWatchWorkouts';
import { isTrainingType } from '../healthkit/workout-discovery';
import { useWorkoutDiscovery } from '../healthkit/useWorkoutDiscovery';
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

/**
 * The provider has to sit above the screen that consumes it, and both need
 * the same ScrollView ref — so the ref is created here and handed down
 * rather than the screen trying to provide and consume in one component.
 */
export default function WorkoutSessionV2Screen() {
  const scrollRef = useRef<ScrollView | null>(null);
  return (
    <KeyboardAwareScrollProvider scrollRef={scrollRef}>
      <SessionContent scrollRef={scrollRef} />
    </KeyboardAwareScrollProvider>
  );
}

function SessionContent({ scrollRef }: { scrollRef: RefObject<ScrollView | null> }) {
  const keyboardScrollProps = useKeyboardAwareScrollProps();
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
  /* Bumped whenever the draft store changes, to re-render the rows it
     feeds. The store itself is a ref: it must survive every render, and
     rebuilding it would drop whatever was typed. */
  const [, bumpDrafts] = useState(0);

  /* The store is built once and delegates through refs, because what it
     needs — the prescription for a set, the api client — is defined further
     down this component. Rebuilding it per render would drop typing. */
  const saveImpl = useRef<(setId: string, values: SetRowValues) => Promise<void>>(
    async () => {},
  );
  const writableImpl = useRef<(setId: string, values: SetRowValues) => boolean>(() => false);
  /* Which exercise a set belongs to, so a save can find its prescription. */
  const logForSet = useRef(new Map<string, WorkoutSessionExerciseDetail>());
  const draftsRef = useRef<SetDraftStore | null>(null);
  if (!draftsRef.current) {
    draftsRef.current = new SetDraftStore(
      (setId, values) => saveImpl.current(setId, values),
      (setId, values) => writableImpl.current(setId, values),
    );
  }
  const drafts = draftsRef.current;

  useEffect(() => drafts.subscribe(() => bumpDrafts((n) => n + 1)), [drafts]);

  /* Anything still unwritten goes out when the screen leaves or the app
     backgrounds. Waiting for the next keystroke would strand the last set of
     the workout — the one most likely to be the hardest. */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') void drafts.flush();
    });
    return () => {
      subscription.remove();
      /* Write what is left, then stop: a pending debounce outliving the
         screen fires into a tree that no longer exists. */
      void drafts.flush().finally(() => drafts.dispose());
    };
  }, [drafts]);

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [setSheetFor, setSetSheetFor] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [saveOfferDismissed, setSaveOfferDismissed] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [savedWorkoutName, setSavedWorkoutName] = useState<string | null>(null);

  /* Both keys, always.
     Today renders this session's status and volume from ['today', date],
     and nothing here ever told it anything had changed — so finishing a
     workout left Today still offering "Resume Workout", and still offering
     the day's Watch activity as unattached. Prefix-matched, so it covers
     whichever date the session belongs to without this screen having to
     know it. */
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['today'] });
  };

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
      /* The rollback alone is indistinguishable from the app undoing the
         action on purpose — the row reappears and nothing says why. */
      feedback.report('Could not add that set. Try again.')();
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
      /* The rollback alone is indistinguishable from the app undoing the
         action on purpose — the row reappears and nothing says why. */
      feedback.report('Could not change that set type. Try again.')();
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
      /* The rollback alone is indistinguishable from the app undoing the
         action on purpose — the row reappears and nothing says why. */
      feedback.report('Could not delete that set. Try again.')();
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
      /* The rollback alone is indistinguishable from the app undoing the
         action on purpose — the row reappears and nothing says why. */
      feedback.report('Could not remove that exercise. Try again.')();
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
  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<{ id: string; isActive: boolean }[]>('/programs'),
    enabled: sessionCompleteForOffer && sessionIsUnplanned,
  });
  const programs = programsQuery.data ?? [];
  const hasActiveProgram = programs.some((program) => program.isActive);

  /* Story 45, and above the early return for exactly the reason written
     above: placing these below `if (!session)` made them conditional hooks
     and reproduced the crash that comment describes. Lint caught it.
     `useSessionWatchWorkouts` takes a nullable id and disables its query,
     so it is safe to call before the session exists. */
  const watch = useSessionWatchWorkouts(session?.id ?? null, {
    onError: feedback.report('Could not update Watch data. Try again.'),
    localDate: session?.localDate ?? '',
  });
  const insights = useWatchSessionInsights({ workouts: watch.attached, exercises });

  /* The day's Watch workouts, filtered to those belonging to this session:
     overlapping it, or starting inside the window after it ends. The
     discovery hook already handles permission, dedupe and dismissal. */
  const discovery = useWorkoutDiscovery({
    localDate: session?.localDate ?? '',
    sessions: [],
    importedExternalIds: watch.attachedExternalIds,
  });
  const attachCandidates = useMemo(
    () =>
      session
        ? candidatesForSession(
            [...discovery.suggestions, ...discovery.suppressed.map((s) => s.workout)],
            { startedAt: session.startedAt ?? null, completedAt: session.completedAt ?? null },
            watch.attachedExternalIds,
          ).filter((c) => !watch.dismissedExternalIds.includes(c.workout.externalId))
        : [],
    [
      session,
      discovery.suggestions,
      discovery.suppressed,
      watch.attachedExternalIds,
      watch.dismissedExternalIds,
    ],
  );

  /* Two kinds of candidate, and only one of them is a question.
     A Watch workout that OVERLAPS the session and is a training type is
     the session — it is the same test that already hides it from Today's
     Additional Activity ("this is your Upper A session, already logged
     here"). Acting on that conclusion in one place and discarding it in
     the other left the workout attached to nothing and offered nowhere.
     Everything else is the "After" case — the run, the walk home — where
     only you know whether it counted, so that still asks. */
  const [autoAttach, toOffer] = useMemo(() => {
    const auto: typeof attachCandidates = [];
    const offer: typeof attachCandidates = [];
    for (const candidate of attachCandidates) {
      const unambiguous =
        candidate.relation === 'overlaps' && isTrainingType(candidate.workout.appleType);
      (unambiguous ? auto : offer).push(candidate);
    }
    return [auto, offer];
  }, [attachCandidates]);

  /* Attempted ids, not attached ids: the attach is optimistic and the list
     it lands in is refetched, so keying off `attached` would fire the
     mutation again on every render until the round trip completed. */
  const autoAttempted = useRef(new Set<string>());
  useEffect(() => {
    if (!sessionCompleteForOffer) return;
    for (const candidate of autoAttach) {
      const id = candidate.workout.externalId;
      if (autoAttempted.current.has(id)) continue;
      autoAttempted.current.add(id);
      watch.attach.mutate(candidate.workout);
    }
  }, [autoAttach, sessionCompleteForOffer, watch.attach]);

  /* Everything below the exercise list is a second wave.
     None of these queries can start until the session query names an id
     and a date, so they all land after the page is already on screen and
     each one pops its card in while the user is reading. Held together
     and rendered once: a block that may legitimately render nothing is
     worse as a skeleton than as a beat of nothing.
     `canRead === null` is discovery's undetermined state — it has no
     separate loading flag. */
  const completedBlockReady =
    !watch.isLoading &&
    discovery.canRead !== null &&
    !(sessionCompleteForOffer && sessionIsUnplanned && programsQuery.isPending);

  if (!session) {
    /* The header is chrome, not data — rendering it immediately means the
       screen does not visibly reflow when the session arrives, and there is a
       back affordance during a slow load rather than a bare word. */
    return (
      <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]} testID="workout-v2-loading">
        <LoggerHeader
          totalVolume={0}
          loggedSets={0}
          plannedSets={0}
          statusLine={query.isError ? "Couldn't load this workout." : 'Loading…'}
          onBack={() => router.back()}
          onFinish={() => {}}
        />
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
  /* Rows that exist but hold nothing. A session with no exercises at all has
     none of these, so it is called out separately below. */
  const unloggedSets = Math.max(plannedSets - loggedSets, 0);
  const duration = formatSessionDuration(session.startedAt, session.completedAt);
  const sessionDate = new Date(session.localDate + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  /** The wire body for a set's typed values. */
  const bodyFor = (log: WorkoutSessionExerciseDetail, values: SetRowValues) => {
    const definition = getPrescriptionDefinition(log.prescription);
    const body: Record<string, unknown> = {};
    for (const field of quickEntryFields(definition)) {
      const key = wireNameFor(field);
      const parsed = parseOptionalNumber(values[field]) ?? null;
      /* Duration is typed in the column's declared unit — minutes for a walk
         — and stored in seconds. */
      body[key] = field === 'duration' ? displayToDurationSeconds(parsed, definition) : parsed;
    }
    return body;
  };

  /** Whether a row holds enough to write. A half-filled one is kept, not sent. */
  const isWritable = (log: WorkoutSessionExerciseDetail, values: SetRowValues) => {
    const definition = getPrescriptionDefinition(log.prescription);
    const body = bodyFor(log, values);
    return definition.requiredFields
      .filter((field) => field !== 'setType')
      .every((field) => body[wireNameFor(field)] != null);
  };

  /* Which exercise a set belongs to, so the store can find its prescription
     without the row telling it twice. */
  saveImpl.current = async (setId, values) => {
    const log = logForSet.current.get(setId);
    if (!log) return;
    await api.patch<WorkoutSet>(`/workout-sets/${setId}`, bodyFor(log, values));
    /* Deliberately no invalidate. Refetching the whole session after every
       set is what made fast entry unusable: each response replaced the
       values of every row, and the rows reset themselves from them. The
       cache is patched optimistically instead, and reconciled when the
       workout finishes. */
    patchCachedSession((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((item) =>
          item.id === setId
            ? { ...item, ...(bodyFor(log, values) as Partial<WorkoutSet>) }
            : item,
        ),
      })),
    }));
  };

  writableImpl.current = (setId, values) => {
    const log = logForSet.current.get(setId);
    return log ? isWritable(log, values) : false;
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.surface.canvas }]} testID="workout-v2">
      {sessionComplete ? (
        <LoggerCompleteBanner
          total={totalVolume.toLocaleString('en-US')}
          totalUnit={formatSessionTotalSuffix(sessionReadout)}
          loggedSets={loggedSets}
          personalRecordCount={sessionReadout.personalRecordCount}
          duration={duration}
          onDone={() => router.back()}
        />
      ) : (
        <LoggerHeader
          totalVolume={totalVolume}
          loggedSets={loggedSets}
          plannedSets={plannedSets}
          finishing={finish.isPending}
          onBack={() => router.back()}
          /* Straight through when everything planned is written; otherwise
             ask. Spec §4 — unwritten rows are discarded, never zeroed. */
          onFinish={() => (unloggedSets > 0 ? setConfirmingFinish(true) : finish.mutate())}
        />
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        {...keyboardScrollProps}
      >
        {/* Under the banner, never over it: the workout is already recorded,
            so the offer must not block the acknowledgement of what was just
            done. */}
        {sessionComplete && completedBlockReady && isUnplanned && !saveOfferDismissed ? (
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
        {sessionComplete && completedBlockReady ? (
          /* Pinned to CARD_WIDTH, the same width the exercise cards use.
             The scroll body centres its children, so a bare Card hugs its
             content and lands narrower than everything below it — which is
             exactly how the Activity card ended up visibly inset from the
             set cards on device. */
          <View style={styles.watchBlock}>
            {/* The offer precedes what it buys: with nothing attached the
                cards below render nothing at all, so this is the only thing
                on screen until the user confirms. */}
            <WatchAttachCard
              candidates={toOffer}
              onAttach={({ workout }) => watch.attach.mutate(workout)}
              onAttachAll={() => toOffer.forEach((c) => watch.attach.mutate(c.workout))}
              onDismiss={watch.dismiss}
              pendingId={watch.attach.isPending ? (watch.attach.variables?.externalId ?? null) : null}
              busy={watch.attach.isPending}
            />
            <WatchSummaryCard
              workouts={watch.attached}
              onRemove={(id) => {
                /* Dismiss as well as detach. Without this, removing an
                   auto-attached workout only holds until the screen
                   remounts — the candidate reappears and the effect
                   attaches it again. Removing it has to mean it stays
                   gone, so it goes into the same device-local dismissal
                   the offer flow uses. */
                const removed = watch.attached.find((w) => w.id === id);
                if (removed) watch.dismiss(removed.externalId);
                watch.detach.mutate(id);
              }}
              removingId={watch.detach.isPending ? (watch.detach.variables ?? null) : null}
            />
            {insights.series && insights.model ? (
              <HeartRateCard
                series={insights.series}
                model={insights.model}
                startedAt={insights.startedAt!}
                endedAt={insights.endedAt!}
                selectedIndex={insights.selectedIndex}
                onSelect={insights.setSelectedIndex}
                maxIsEstimated={insights.maxIsEstimated}
                avgBpm={insights.avgBpm}
                peakBpm={insights.peakBpm}
              />
            ) : null}
            <EffortByExerciseCard efforts={insights.efforts} />
          </View>
        ) : null}
        {/* An empty session is a real state now that the workout picker
            offers "Start an empty workout"; before, `exercises.map` over
            nothing simply rendered nothing. Not shown once the workout is
            complete — an empty finished session is a different problem, and
            the banner above already says the workout is over. */}
        {exercises.length === 0 && !sessionComplete ? (
          <EmptySessionCard onAddExercise={() => setPickerOpen(true)} />
        ) : null}
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
              onAddSet={() => addSet.mutate({ exerciseLogId: log.id, clientId: createClientId() })}
              onOpenActions={() => setActionsFor(log.id)}
            >
              {log.sets.map((set, index) => {
                const previousSet = log.previousSession?.sets[index];
                /* Status comes from the draft store now. `sync` tracked one
                   in-flight mutation per row and knew nothing about a value
                   still sitting in memory, so a row with unsaved typing
                   looked identical to an untouched one. */
                const state = drafts.statusFor(set.id);
                const logged = isSessionSetLogged(log.prescription, set);
                /* `queued` and `saving` both read as pending: from the
                   lifter's side there is no difference between "about to be
                   written" and "being written", and the row already says the
                   number is theirs. */
                const status: SetRowStatus =
                  state === 'error'
                    ? 'error'
                    : state === 'queued' || state === 'saving'
                      ? 'pending'
                      : set.isPrWeight || set.isPrReps
                        ? 'pr'
                        : logged || drafts.hasDraft(set.id)
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
                    /* The draft if there is one, otherwise the server's
                       copy. The store never lets the latter overwrite the
                       former. */
                    values={drafts.valuesFor(set.id, {
                      ...EMPTY_VALUES,
                      weight: set.weightValue?.toString() ?? '',
                      reps: set.reps?.toString() ?? '',
                      duration: durationToDisplay(set.durationSeconds, definition),
                      distance: set.distanceValue?.toString() ?? '',
                      rpe: set.rpe?.toString() ?? '',
                    })}
                    targets={targetsFor(log.prescription)}
                    previous={
                      previousSet ? formatPreviousSetCompact(log.prescription, previousSet) : null
                    }
                    onCommit={(values) => {
                      logForSet.current.set(set.id, log);
                      drafts.edit(set.id, values);
                    }}
                    onOpenSetType={() => setSetSheetFor(set.id)}
                    onCopyPrevious={() => undefined}
                    onRetry={() => void drafts.flush()}
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
              /* Dark, like the header it bookends. Left light through the
                 first reskin pass, which put a white bar under a dark header
                 with dark cards between them. */
              backgroundColor: theme.inverse.surface,
              borderTopColor: 'transparent',
            },
          ]}
        >
          <Pressable
            style={[styles.addExercise, { backgroundColor: theme.inverse.raised }]}
            accessibilityRole="button"
            testID="add-exercise"
            onPress={() => setPickerOpen(true)}
          >
            <Text style={[styles.addExerciseText, { color: theme.inverse.accentMuted }]}>
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
          onClose={() => setActionsFor(null)}
          onViewHistory={() => router.push(`/exercise-history/${activeActions.exerciseId}`)}
          onRemove={() => removeExercise.mutate(activeActions.id)}
        />
      ) : null}

      <FinishConfirmSheet
        visible={confirmingFinish}
        unloggedCount={unloggedSets}
        empty={exercises.length === 0}
        busy={finish.isPending}
        onConfirm={() => {
          setConfirmingFinish(false);
          finish.mutate();
        }}
        onKeepGoing={() => setConfirmingFinish(false)}
      />

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <ExercisePickerV2
          tone="inverse"
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
 * The table cannot spare a
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
  body: { alignItems: 'center', gap: 12, padding: 16 },
  watchBlock: { width: CARD_WIDTH, gap: 12 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, alignItems: 'center' },
  addExercise: { width: CARD_WIDTH, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addExerciseText: { fontSize: 14, fontWeight: '600' },
  savedNotice: { fontSize: 13, paddingVertical: 14, paddingHorizontal: 16 },
});
