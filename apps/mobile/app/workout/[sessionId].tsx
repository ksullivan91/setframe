import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, GripVertical, MoreVertical } from 'lucide-react-native';
import {
  beginSync,
  calculateVolume,
  describeQuickLogAction,
  estimateOneRepMax,
  isExerciseComplete,
  isQuickLogComplete,
  plannedQuickLogSeed,
  quickLogFields,
  isCurrentAttempt,
  isSaving,
  quickLogTargets as quickLogTargetsFor,
  settleSync,
  buildCompletedExerciseReadout,
  completedSetCountLabel,
  supportsQuickLog,
  visibleSessionExercises,
  type SyncMap,
} from '@setframe/domain';
import type {
  Exercise,
  Prescription,
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
import { Badge } from '../../src/components/Badge';
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
import { CompletedExerciseCard } from '../../src/components/CompletedExerciseCard';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing, typeScale } from '../../src/theme/getTheme';

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
 * The quick-entry header's starting point.
 *
 * Story 37 read this from the first set, which worked only because session
 * start wrote the plan onto every set row — the conflation story 42.1
 * removed. With rows now empty, the plan is read from the prescription.
 *
 * Seeding is a convenience, never a claim: nothing here is persisted, and
 * completion is still derived from what the server holds. An already-logged
 * set still wins, so reopening shows what was done rather than what was
 * planned.
 */
function getHeaderDraft(exerciseLog: WorkoutSessionDetail['exercises'][number], definition: PrescriptionDefinition): SetDraft {
  const firstSet = exerciseLog.sets[0];
  if (firstSet && isSessionSetLogged(exerciseLog.prescription, firstSet)) {
    return buildDraft(firstSet, definition, exerciseLog.prescription);
  }

  const seed = plannedQuickLogSeed(exerciseLog.prescription);
  return {
    values: {
      setType: 'working',
      weight: '',
      reps: seed.reps != null ? String(seed.reps) : '',
      duration: seed.durationSeconds != null ? secondsToDisplay(seed.durationSeconds, definition) : '',
      distance: seed.distanceValue != null ? String(seed.distanceValue) : '',
      rpe: '',
    },
    distanceUnit: seed.distanceUnit ?? definition.units.distance,
    completed: false,
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

/**
 * Whether the draft differs from what the server holds.
 *
 * Story 42B removed the save row from a completed workout because native had
 * always disabled Save outright there, so it was a dead control. Web kept it,
 * because story 23 deliberately allows correcting a logged value after
 * completion — a genuine capability, not an oversight — and simply hides the
 * button until there is an edit to save.
 *
 * Native now matches: corrections stay possible, and the control appears only
 * when it would do something. The two platforms no longer disagree about
 * whether a finished workout is editable.
 */
function setHasChanges(
  set: WorkoutSet,
  draft: SetDraft,
  visible: SessionField[],
  definition: PrescriptionDefinition,
): boolean {
  const patch = buildSetPatch(set, draft, visible, definition) as Record<string, unknown>;
  const compare: Array<[string, unknown]> = [
    ['setType', set.setType],
    ['weightValue', set.weightValue],
    ['reps', set.reps],
    ['durationSeconds', set.durationSeconds],
    ['distanceValue', set.distanceValue],
    ['rpe', set.rpe],
  ];
  return compare.some(([key, current]) => key in patch && (patch[key] ?? null) !== (current ?? null));
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

export default function WorkoutSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const resolvedSessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
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
  // Story 39: single-active-exercise accordion — at most one exercise is
  // expanded at a time. `null` means none are (every exercise manually
  // collapsed, or nothing loaded yet); seeded to the first exercise once
  // the session loads (see the effect below), not left "all expanded",
  // since only one can be active from the very first render.
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const hasSeededActiveExercise = useRef(false);
  const [toast, setToast] = useState<{
    variant: 'success' | 'error';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  /* This screen renders one specific session, identified by the route. It
     has no way to create one, by construction.

     It used to be the Training *tab*, which meant it had to answer "what do
     I show when opened with no active session?" — and the answer implemented
     was to POST one from a mount effect. Merely opening the tab created a
     real `workout_session` pre-populated with the day's template sets, with
     no user action and no way to decline. That produced duplicate empty
     sessions shadowing finished workouts, and — because
     `POST /v1/workout-sessions` deletes that date's `rest_day` so a day
     cannot claim both — silently destroyed logged rest days.

     Keying the screen to a session id removes the question the bug was an
     answer to. There is no `todayQuery`, no create mutation, and nothing to
     resume: a caller that wants a session must already have one. */

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
      // Today shows this session's status and totals, so it goes stale on
      // every mutation here. `['today']` is now the single key for that
      // view — this screen used to keep a second, independent copy under
      // `['dashboard-today-mobile-workout']`, and the two silently
      // diverging is what let a just-created session be invisible to the
      // screen meant to display it.
      queryClient.invalidateQueries({ queryKey: ['today'] }),
    ]);
  };

  /* Every write below reports its own failure.
   *
   * These mutations previously had no `onError` at all, so a request that
   * failed — the ordinary case on gym wifi — was pixel-identical to one
   * that succeeded. The most costly was `saveSetMutation`: a user logs a
   * set, sees no change because the screen already shows what they typed,
   * and moves on. The set is gone and nothing ever said so. Web has
   * carried these toasts since Story 08; mobile never did. */
  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onSuccess: refreshSession,
    onError: () => setToast({ variant: 'error', message: 'Could not remove that set.' }),
  });

  /**
   * Story 59 — Quick Log persists. The old `Apply to all sets` only populated
   * the set inputs and left the user to expand the exercise and save each
   * one, so the "fast path" cost more taps than typing into the sets.
   *
   * One request rather than N sequential PATCHes, so the user is not
   * serialised behind the network for the most common case in the product.
   */
  /**
   * Story 42.4 — which exercises are mid-commit.
   *
   * `useMutation`'s `isPending` is one screen-wide boolean, so quick-logging
   * one exercise disabled the action on every other. Mid-workout that
   * serialises the user behind the network in the place that least tolerates
   * it — the same defect story 60 fixed for per-set saves.
   */
  const [quickLogPending, setQuickLogPending] = useState<Record<string, boolean>>({});

  const quickLogMutation = useMutation({
    mutationFn: ({
      exerciseLogId,
      setIds,
      values,
    }: {
      exerciseLogId: string;
      setIds: string[];
      values: Record<string, unknown>;
    }) => api.post<WorkoutSet[]>(`/workout-exercise-logs/${exerciseLogId}/quick-log`, { setIds, values }),
    /**
     * Story 42.4 — optimistic, and honest about it.
     *
     * The user is between sets; waiting on a round trip before the card
     * acknowledges them is the friction this story removes. The previous
     * cache is snapshotted so a rejected write cannot leave the screen
     * claiming work that was never saved.
     */
    onMutate: async (variables) => {
      setQuickLogPending((prev) => ({ ...prev, [variables.exerciseLogId]: true }));
      await queryClient.cancelQueries({ queryKey: ['workout-session', resolvedSessionId] });
      const previous = queryClient.getQueryData<WorkoutSessionDetail>([
        'workout-session',
        resolvedSessionId,
      ]);

      queryClient.setQueryData<WorkoutSessionDetail>(
        ['workout-session', resolvedSessionId],
        (current) => {
          if (!current) return current;
          const targets = new Set(variables.setIds);
          return {
            ...current,
            exercises: current.exercises.map((exerciseLog) =>
              exerciseLog.id !== variables.exerciseLogId
                ? exerciseLog
                : {
                    ...exerciseLog,
                    sets: exerciseLog.sets.map((set) =>
                      targets.has(set.id) ? { ...set, ...(variables.values as Partial<WorkoutSet>) } : set,
                    ),
                  },
            ),
          };
        },
      );

      return { previous };
    },
    onSuccess: async (_, variables) => {
      /* The drafts these sets were showing are now stale — the server holds
         the truth. Clearing them stops a half-typed local value from
         reappearing over what was just logged. */
      setDrafts((prev) => {
        const next = { ...prev };
        for (const setId of variables.setIds) delete next[setId];
        return next;
      });
      setHeaderTouchedKeys((prev) => ({ ...prev, [variables.exerciseLogId]: [] }));
      await refreshSession();
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['workout-session', resolvedSessionId], context.previous);
      }
/* Story 42.5 — reopen it. The optimistic completion auto-collapsed the
         exercise; rolling back leaves it incomplete again, and a collapsed
         card would hide both the failure and the values the user still needs
         to retry. Completion state and disclosure state have to fail
         together. */
      activateExercise(_variables.exerciseLogId);
      setToast({ variant: 'error', message: 'Could not log those sets. Your values are still here — try again.' });
    },
    onSettled: (_data, _error, variables) => {
      setQuickLogPending((prev) => {
        const next = { ...prev };
        delete next[variables.exerciseLogId];
        return next;
      });
    },
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
    onError: () => setToast({ variant: 'error', message: 'Could not add that set.' }),
  });

  /**
   * Story 60 — saving one set must not block any other.
   *
   * A single `useMutation` exposes one `isPending` for every set that uses
   * it, so the Save button showed a spinner on every set at once while any
   * one was in flight. The mutation stays shared; the *state* is now keyed by
   * set id in `syncMap`, and responses settle by sequence number so a slow
   * first save cannot overwrite a fast second one.
   */
  const [syncMap, setSyncMap] = useState<SyncMap>({});
  /* A ref alongside the state, because sequence numbers must be allocated
     synchronously — reading them from a `setState` updater does not work, as
     the updater has not run by the time the request starts. */
  const syncRef = useRef<SyncMap>({});
  const applySync = (update: (current: SyncMap) => SyncMap) => {
    syncRef.current = update(syncRef.current);
    setSyncMap(syncRef.current);
  };

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
      seq: number;
    }) => api.patch<WorkoutSet>(`/workout-sets/${setId}`, buildSetPatch(set, draft, visible, definition)),
    onSuccess: async (_result, variables) => {
      const current = isCurrentAttempt(syncRef.current, variables.setId, variables.seq);
      applySync((prev) => settleSync(prev, variables.setId, variables.seq, 'success'));
      // A superseded response must not refetch over the newer edit.
      if (current) await refreshSession();
    },
    /* The most important one on the screen: the inputs still show what the
       user typed after a failed save, so without this the set looks logged
       when it is not. Names the set so a user mid-workout knows which one
       to re-enter. */
    onError: (_err, variables) => {
      applySync((prev) => settleSync(prev, variables.setId, variables.seq, 'error'));
      setToast({
        variant: 'error',
        message: `Set ${variables.set.sortOrder + 1} did not save. Check your connection and save it again.`,
      });
    },
  });

  /** Starts a save and hands the mutation its attempt number. */
  function saveSet(args: {
    setId: string;
    draft: SetDraft;
    set: WorkoutSet;
    visible: SessionField[];
    definition: PrescriptionDefinition;
  }) {
    const begun = beginSync(syncRef.current, args.setId);
    syncRef.current = begun.map;
    setSyncMap(begun.map);
    saveSetMutation.mutate({ ...args, seq: begun.seq });
  }

  /* The session carries its own prescription snapshot, because an exercise
     added mid-session has no day-type row to inherit one from. */
  const addExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, prescription }: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/workout-sessions/${resolvedSessionId}/exercises`, { exerciseId, prescription }),
    onSuccess: async () => {
      setShowAddExercise(false);
      await refreshSession();
    },
    /* Deliberately leaves the picker open on failure, matching web: closing
       it would discard the prescription the user just configured. */
    onError: () => setToast({ variant: 'error', message: 'Could not add that exercise.' }),
  });

  const createExerciseMutation = useMutation({
    mutationFn: (name: string) => api.post<Exercise>('/exercises', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
    onError: () => setToast({ variant: 'error', message: 'Could not create that exercise.' }),
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
    /* A silent failure here left the session `in_progress` indefinitely
       while the user believed they had finished — and Today would keep
       offering to resume a workout they considered done. */
    onError: () =>
      setToast({ variant: 'error', message: 'Could not finish your workout. Check your connection and try again.' }),
  });

  const visibleExercises = useMemo(
    () => visibleSessionExercises(sessionQuery.data?.exercises ?? []),
    [sessionQuery.data],
  );

  // Story 39: seeds the accordion to the first exercise once the session
  // has loaded — a bare `useState(null)` would otherwise start with none
  // active, an odd first impression for a screen whose whole prior
  // history (through Story 37) opened every exercise by default. Fires
  // exactly once (the ref gates it, not "is anything active right now")
  // so a later manual collapse to none — a real, supported state — is
  // never fought by this effect re-seeding it back open.
  useEffect(() => {
    if (!hasSeededActiveExercise.current && visibleExercises.length > 0) {
      hasSeededActiveExercise.current = true;
      /* Story 42 — the first *incomplete* exercise, not simply the first.
         Reopening a session mid-workout used to expand the editor for an
         exercise already finished: the wrong place to land, and the one case
         that hides a completed exercise's own summary behind the editor it
         replaced. A session with nothing left to do keeps the original
         fallback, since there is no "next" to orient toward. */
      const next = visibleExercises.find(
        (exerciseLog) => !isExerciseComplete(exerciseLog.prescription, exerciseLog.sets),
      );
      setActiveExerciseId((next ?? visibleExercises[0]!).id);
    }
  }, [visibleExercises]);

  /**
   * Story 61 — an exercise collapses itself the moment it becomes complete.
   *
   * Keyed on the *transition*, not on the state: collapsing whenever the
   * active exercise happens to be complete would fight the user every time
   * they reopened a finished exercise to correct a set.
   *
   * Deliberately no scroll — moving the screen under someone who may be
   * looking at something else is the "forced jump" story 62 rules out.
   */
  const wasComplete = useRef<Record<string, boolean>>({});
  useEffect(() => {
    for (const exerciseLog of visibleExercises) {
      const complete = isExerciseComplete(exerciseLog.prescription, exerciseLog.sets);
      const justCompleted = complete && wasComplete.current[exerciseLog.id] === false;
      wasComplete.current[exerciseLog.id] = complete;
      if (justCompleted) {
        /* Story 42 — finishing hands off to the next unfinished exercise, so
           the workout reads as a queue emptying rather than a list changing
           colour. Null when nothing is left: every card is a summary and
           Finish is the only thing to do. */
        const next = visibleExercises.find(
          (candidate) =>
            candidate.id !== exerciseLog.id &&
            !isExerciseComplete(candidate.prescription, candidate.sets),
        );
        setActiveExerciseId((current) => (current === exerciseLog.id ? (next?.id ?? null) : current));
      }
    }
  }, [visibleExercises]);

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

  /**
   * Story 39: fired by focusing a quick-entry field belonging to this
   * exercise (the only inputs a *collapsed* exercise still renders) or by
   * choosing an action inside it (Add set, the actions menu) — always
   * activates, never toggles, so interacting with the already-active
   * exercise can't accidentally collapse it.
   */
  function activateExercise(exerciseLogId: string) {
    setActiveExerciseId((prev) => (prev === exerciseLogId ? prev : exerciseLogId));
  }

  /**
   * Story 39: the chevron's own press handler — the one place a collapse
   * can happen, so manual collapse of the currently active exercise stays
   * available. Tapping any other exercise's header switches to it.
   */
  function toggleActiveExercise(exerciseLogId: string) {
    setActiveExerciseId((prev) => (prev === exerciseLogId ? null : exerciseLogId));
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

  const isLoading = sessionQuery.isLoading || exercisesQuery.isLoading;
  const isError = sessionQuery.isError || exercisesQuery.isError;

  /* Reached only by a malformed link — every in-app caller passes an id.
     Deliberately offers a way back rather than a create button: this screen
     does not manufacture sessions. */
  if (!resolvedSessionId) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.surface.canvas, padding: spacing[16], gap: spacing[16] }]}>
        <Text style={{ color: theme.text.primary, textAlign: 'center' }}>No workout session was specified.</Text>
        <Button label="Go to Today" variant="secondary" fullWidth={false} onPress={() => router.replace('/(tabs)/today')} />
      </View>
    );
  }

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
        {/* Titled from the session itself rather than from "today", which
            this screen no longer queries — and must not, since a session
            reached from history is not necessarily today's. Mirrors web's
            WorkoutSessionPage. */}
        <Text style={[styles.title, { color: theme.text.primary }]}>
          {sessionQuery.data.status === 'completed' ? 'Workout complete' : 'Workout session'}
        </Text>
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
        const isComplete = isExerciseComplete(exerciseLog.prescription, exerciseLog.sets);
        const isExpanded = activeExerciseId === exerciseLog.id;
        const headerDraft = headerDrafts[exerciseLog.id] ?? getHeaderDraft(exerciseLog, definition);

        /* Story 58/59 — what Quick Log would write, and what to call the
           button. Derived from the server's sets, never from local drafts: a
           prefilled-but-unsaved value must not make a set look logged. */
        /* Story 42 — representation-aware figures plus an honest comparison,
           derived in the domain package so native and web decide identically. */
        const completedReadout = isComplete
          ? buildCompletedExerciseReadout(
              exerciseLog.prescription,
              exerciseLog.sets,
              exerciseLog.previousSession?.sets ?? null,
            )
          : null;
        /* "Collapsed" only means something once the accordion has been seeded;
           before that `activeExerciseId` is null and treating it as collapsed
           would flash a completed exercise as a summary and snap it back open. */
        const isCollapsed = hasSeededActiveExercise.current && !isExpanded;
        /* Story 42A/42B — the review boundary is the *workout* being marked
           complete, never an exercise finishing inside an active one. A
           completed exercise mid-workout still needs its editing controls when
           reopened; a completed workout has no mutations left to offer, so
           controls that would only render disabled are removed instead. */
        const sessionComplete = sessionQuery.data.status === 'completed';
        /* Once the workout is complete the summary card stays put whether or
           not the sets are showing, so the chevron keeps one fixed position
           instead of the card handing over to the editing header. */
        const showCompletedCard = completedReadout != null && (sessionComplete || isCollapsed);
        const quickLogValues = draftToValues(headerDraft, definition);
        const quickLogTargets = quickLogTargetsFor(exerciseLog.prescription, exerciseLog.sets);
        /* The denominator excludes warmups, so "Log all 3 sets" counts the
           three working sets rather than four rows including a warmup the
           action would never touch. */
        const loggableSetCount = exerciseLog.sets.filter((set) => set.setType !== 'warmup').length;
        const quickLogReady =
          quickLogTargets.length > 0 && isQuickLogComplete(exerciseLog.prescription, quickLogValues);
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
        <Card
          key={exerciseLog.id}
          testID={isComplete ? 'exercise-card-complete' : 'exercise-card'}
          /* Story 61, corrected by story 42. This was `action.accentSubtle` —
             the lavender that means *selected* everywhere else — which said
             "picked", not "done", and made finished work the loudest thing on
             screen. Now a real success tint, with the state carried mostly by
             the card's contents rather than its fill. */
          style={
            isComplete
              ? { borderWidth: 1, borderColor: theme.status.success, backgroundColor: theme.status.successSubtle }
              : undefined
          }
        >
          {/* Story 42 — a finished exercise stops being a form while it is
              collapsed, and returns to the ordinary header the moment it is
              reopened, so completion stays reversible. */}
          {showCompletedCard ? (
            <CompletedExerciseCard
              name={exerciseLog.exercise.name}
              readout={completedReadout}
              setCountLabel={completedSetCountLabel(exerciseLog.sets)}
              onReopen={() => toggleActiveExercise(exerciseLog.id)}
              testID={`completed-exercise-${exerciseLog.id}`}
              expanded={isExpanded}
              /* Story 42A — a chevron in review mode, the overflow control
                 during an active workout. The ellipsis is dropped once the
                 workout is complete because every action behind it is gone;
                 an inert control is worse than no control. */
              /* Story 42.2 — the disclosure control is always present, on
                 every state of the card. It used to appear only once the
                 workout was finished; during an active workout a completed
                 exercise had no chevron at all and could only be reopened by
                 tapping the card, so "can this be opened?" depended on state
                 the user had to already know. The overflow menu sits beside
                 it while the workout is still active. */
              actions={
                <View style={styles.exerciseHeaderActions}>
                  {sessionComplete ? null : (
                    <IconButton
                      icon={MoreVertical}
                      variant="subtle"
                      accessibilityLabel={`${exerciseLog.exercise.name} actions`}
                      onPress={() => {
                        activateExercise(exerciseLog.id);
                        confirmRemoveExercise(exerciseLog.id, exerciseLog.exercise.name, loggedSetCount);
                      }}
                    />
                  )}
                  <IconButton
                    icon={isExpanded ? ChevronUp : ChevronDown}
                    variant="subtle"
                    expanded={isExpanded}
                    accessibilityLabel={isExpanded ? `Collapse ${exerciseLog.exercise.name}` : `Expand ${exerciseLog.exercise.name}`}
                    onPress={() => toggleActiveExercise(exerciseLog.id)}
                  />
                </View>
              }
            />
          ) : (
          <>
          <View style={styles.exerciseHeader}>
            <View style={styles.exerciseTitleRow}>
              {/* Story 42.2 — the one control that toggles detail, and the
                  only one. `expanded` is what VoiceOver announces; a chevron's
                  direction is not something a screen-reader user can see. */}
              <IconButton
                icon={isExpanded ? ChevronUp : ChevronDown}
                variant="subtle"
                expanded={isExpanded}
                accessibilityLabel={isExpanded ? `Collapse ${exerciseLog.exercise.name}` : `Expand ${exerciseLog.exercise.name}`}
                onPress={() => toggleActiveExercise(exerciseLog.id)}
              />
              <GripVertical size={18} color={theme.text.secondary} />
              <Text style={[styles.exerciseTitle, { color: theme.text.primary }]}>{exerciseLog.exercise.name}</Text>
            </View>
            <View style={styles.exerciseHeaderActions}>
              {/* Story 58: `Add set` has moved into Detailed Sets. It
                  customises the set list, so it belongs beside the sets
                  rather than competing with the quick path for the header.

                  Story 42A: gone entirely once the workout is complete — it
                  already did nothing in that state. */}
              {sessionComplete ? null : (
                <IconButton
                  icon={MoreVertical}
                  variant="subtle"
                  accessibilityLabel={`${exerciseLog.exercise.name} actions`}
                  onPress={() => {
                    activateExercise(exerciseLog.id);
                    confirmRemoveExercise(exerciseLog.id, exerciseLog.exercise.name, loggedSetCount);
                  }}
                />
              )}
            </View>
          </View>

          <Text style={[styles.prescription, { color: theme.text.secondary }]}>{summarizePrescription(exerciseLog.prescription)}</Text>

          {/* Story 38: completion is derived from every set's own
              required-field completeness (isExerciseComplete), never a UI flag
              toggled on collapse.

              Story 42 removed the `Complete` badge that sat here. This header
              now only renders while the exercise is being edited, where
              progress through the sets is the useful readout; the completed
              state is a card of its own. */}
          {exerciseLog.sets.length > 0 ? (
            <Text style={[styles.prescription, { color: theme.text.secondary }]}>
              {`${loggedSetCount} of ${exerciseLog.sets.length} sets complete`}
            </Text>
          ) : null}
          </>
          )}

          {/* Story 58/59 — Quick Log: the fast path for the normal case,
              where every planned set shares the same values. It persists; it
              does not merely populate the set inputs.

              None of these fields call `activateExercise` on focus any more.
              Doing so expanded the whole accordion the moment a quick-entry
              box was touched, which destroyed the lightweight path — the gym
              test's specific complaint. Detailed Sets open only through the
              explicit control. */}
          {quickLogTargets.length > 0 && supportsQuickLog(exerciseLog.prescription) ? (
          <View
            style={[styles.quickLogPanel, { borderColor: theme.border.subtle, backgroundColor: theme.surface.sunken }]}
            accessibilityLabel={`Quick log ${exerciseLog.exercise.name}`}
            testID={`quick-log-panel-${exerciseLog.id}`}
          >
            <Text style={[styles.quickLogHeading, { color: theme.text.secondary }]}>QUICK LOG</Text>
            <View style={styles.quickLogFields}>
            {quickLogFields(exerciseLog.prescription).map((field) => {
              /* The visible label is short — the panel above already says
                 "Quick log", so repeating it in every field reads as noise.
                 The *accessible* name keeps the prefix, because two
                 identically named inputs on one card are genuinely ambiguous
                 to a VoiceOver user navigating by label. */
              const label = getSessionFieldLabel(field, definition);
              const accessibleName = `Quick log: ${label}`;
              if (field === 'distance') {
                return (
                  <View key={field} style={styles.quickEntryDistanceRow}>
                    <View style={styles.quickEntryDistanceValue}>
                      <Input
                        label={label}
                        accessibilityLabel={accessibleName}
                        value={headerDraft.values.distance ?? ''}
                        onChangeText={(value) => updateHeader({ distance: value })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Select
                      label="Unit"
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
                  accessibilityLabel={accessibleName}
                  value={headerDraft.values[field] ?? ''}
                  onChangeText={(value) => updateHeader({ [field]: value })}
                  keyboardType={field === 'reps' ? 'number-pad' : 'decimal-pad'}
                  unit={field === 'weight' ? exerciseLog.sets[0]?.weightUnit ?? 'lb' : undefined}
                />
              );
            })}
            </View>
            <Button
              label={describeQuickLogAction(quickLogTargets.length, loggableSetCount)}
              testID={`quick-log-${exerciseLog.id}`}
              disabled={
                !quickLogReady ||
                quickLogPending[exerciseLog.id] === true ||
                sessionQuery.data.status === 'completed'
              }
              loading={quickLogPending[exerciseLog.id] === true}
              onPress={() =>
                quickLogMutation.mutate({
                  exerciseLogId: exerciseLog.id,
                  setIds: quickLogTargets.map((set) => set.id),
                  values: quickLogValues,
                })
              }
            />
          </View>
          ) : null}

          {isExpanded ? (
          <>
          {/* Story 58 — Detailed Sets. `Add set` lives here now. */}
          <View style={styles.detailedSetsHeader}>
            <Text style={[styles.prescription, { color: theme.text.secondary }]}>Detailed sets</Text>
            {/* Story 42B — adding a set to a finished workout was already
                blocked; the button is gone rather than greyed out. */}
            {sessionComplete ? null : (
            <Button
              label="Add set"
              variant="secondary"
              fullWidth={false}
              disabled={addSetMutation.isPending}
              /* Story 42.2 — no `activateExercise` here. Add set only exists
                 inside an already-open panel, so activating was at best a
                 no-op and at worst a second control quietly changing
                 disclosure state. Only the chevron does that now. */
              onPress={() =>
                addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: exerciseLog.sets.at(-1) })
              }
            />
            )}
          </View>

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
                  {/* Story 42C — the planned target as a pill, matching web:
                      accent purple, white text, the same in every state. It
                      never turns green on completion; it means *planned
                      target*, not *done*, and a plan that changes colour
                      would read as a second status signal competing with the
                      real one. */}
                  <View style={[styles.plannedPill, { backgroundColor: theme.action.primary }]}>
                    <Text style={[styles.plannedPillLabel, { color: theme.action.primaryText }]}>
                      Planned: {planned}
                    </Text>
                  </View>
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
                  onDuplicate={
                    sessionComplete
                      ? undefined
                      : () => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: set })
                  }
                  onRemove={
                    sessionComplete
                      ? undefined
                      : () =>
                          Alert.alert('Remove set', `Remove Set ${index + 1}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => deleteSetMutation.mutate(set.id) },
                          ])
                  }
                />
                {/* Story 42B, revised: corrections after completion are now
                    possible on native too, matching web and story 23. The row
                    appears only when there is an edit to save — no dead
                    control, no lost capability — and during an active workout
                    it stays put so it does not flicker while the user types
                    between sets. */}
                {sessionComplete && !setHasChanges(set, draft, visibleFields, definition) ? null : (
                <View style={styles.saveRow}>
                  <Text style={[styles.helperNote, { color: theme.text.secondary }]}>Log actual performance, then save to sync the session.</Text>
                  <Button
                    label="Save"
                    variant="secondary"
                    fullWidth={false}
                    // Only *this* set's own in-flight write shows progress or
                    // disables it — saving one set never blocks another.
                    loading={isSaving(syncMap, set.id)}
                    disabled={
                      Object.keys(fieldErrors).length > 0 ||
                      isSaving(syncMap, set.id)
                    }
                    onPress={() =>
                      saveSet({ setId: set.id, draft, set, visible: visibleFields, definition })
                    }
                  />
                </View>
                )}
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
  /* Story 58 — Quick Log reads as a compact action panel, not as a second
     copy of the set editor. The tint, border and heading are what say which
     question this region answers; without them it was just more inputs. */
  quickLogPanel: {
    gap: spacing[8],
    padding: spacing[12],
    borderRadius: radius.small,
    borderWidth: 1,
  },
  quickLogHeading: {
    fontSize: typeScale.label.fontSize,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  /* Fields side by side, never wrapping. The old `flexWrap` grid put weight
     and reps on one row at some widths and two at others, which is exactly
     the mobile misalignment the gym test reported. */
  quickLogFields: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  detailedSetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  plannedPill: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    // Shrinks rather than pushing the row wide: a representation-aware target
    // ("3 mi · 30 min") must not force horizontal overflow on a phone.
    flexShrink: 1,
  },
  plannedPillLabel: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
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
