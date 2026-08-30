import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { DerivedExercise, PickableExercise, SessionField } from '@setframe/domain';
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
  visibleSessionExercises,
} from '@setframe/domain';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription } from '../lib/prescription';
import { ExerciseTableCard, CARD_WIDTH } from '../components/workout-v2/ExerciseTableCard';
import { SetRowV2, type SetRowStatus, type SetRowValues } from '../components/workout-v2/SetRowV2';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';
import { SaveAsWorkoutCard } from '../components/training-v2/SaveAsWorkoutCard';
import { ExerciseCardsSkeleton } from '../components/training-v2/TrainingSkeletons';
import { SetTypeSheet } from '../components/workout-v2/SetTypeSheet';
import { ExerciseActionsSheet } from '../components/workout-v2/ExerciseActionsSheet';

/**
 * Today's Workout, v2 — the table-format logger.
 *
 * Built alongside the v1 page rather than replacing it, so the two can be
 * compared on real data before v1 is retired. Route: /workout/v2/:sessionId.
 *
 * Design of record: docs/design/workout-logging-table.md (layout) and
 * workout-logging-interactions.md (behaviour). ADR 0011 has the why.
 *
 * The load-bearing behaviour is that a row writes itself when focus leaves it
 * and every field its prescription requires holds a value. There is no save
 * control anywhere on this page.
 */

/* AppShell's <Content> already applies the design's 16px screen padding, so
   this page must not add its own or a 358px card renders at 326. The sticky
   regions break back out of it with a negative inline margin to sit
   full-bleed, which is what the frames show. */
/**
 * What an exercise added mid-session is prescribed.
 *
 * `sets_reps` with a single set: the user is adding this because they are
 * about to do it, so one row to log into is the honest starting point — and
 * it pins the card to weight-and-reps columns instead of every column the
 * unprescribed fallback declares.
 */
const DEFAULT_ADDED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };

const SHELL_PADDING = 16;

/* Covers the shell, including its nav — the picker is a task surface, and
   leaving the tab bar tappable underneath invites losing a half-made
   selection to a stray tap. */
const PickerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: ${({ theme }) => theme.surface.canvas};
`;

const SavedNotice = styled.p`
  width: 358px;
  max-width: 100%;
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: ${({ theme }) => theme.surface.raised};
  font-size: 13px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Screen = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.surface.canvas};
`;

/* Fixed, because Finish has to be reachable at any scroll position — a
   workout is finished from wherever the user happens to be. */
const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-inline: -${SHELL_PADDING}px;
  padding: max(16px, env(safe-area-inset-top)) 16px 12px;
  background: ${({ theme }) => theme.surface.raised};
  border-bottom: 1px solid ${({ theme }) => theme.border.subtle};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`;

const BackButton = styled.button`
  width: 24px;
  height: 28px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.text.secondary};
  font-size: 22px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FinishButton = styled.button`
  flex: 0 0 auto;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.action.primary};
  color: ${({ theme }) => theme.action.primaryText};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const Meta = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.text.secondary};
  font-variant-numeric: tabular-nums;
`;

const Body = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
`;

const BottomBar = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin-inline: -${SHELL_PADDING}px;
  padding: 12px 16px max(20px, env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.surface.raised};
  border-top: 1px solid ${({ theme }) => theme.border.subtle};
`;

const AddExercise = styled.button`
  width: ${CARD_WIDTH}px;
  max-width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.action.primary};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
`;

const Banner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-inline: -${SHELL_PADDING}px;
  padding: 16px;
  background: ${({ theme }) =>
    'linear-gradient(115deg, ' + theme.status.success + '3D 0%, ' + theme.surface.raised + ' 100%)'};
  border-bottom: 1px solid ${({ theme }) => theme.status.success + '40'};
`;

const BannerTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const BannerMark = styled.h1`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};

  &::before {
    content: '✓';
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid ${({ theme }) => theme.status.success};
    background: ${({ theme }) => theme.surface.raised};
    color: ${({ theme }) => theme.status.success};
    font-size: 14px;
  }
`;

const BannerTotal = styled.p`
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;

  strong {
    font-size: 32px;
    font-weight: 600;
    color: ${({ theme }) => theme.text.primary};
  }

  span {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.text.secondary};
  }
`;

type RowSyncState = Record<string, 'pending' | 'error' | undefined>;

const EMPTY_VALUES: SetRowValues = { weight: '', reps: '', duration: '', distance: '', rpe: '' };

/**
 * A placeholder set, shown while the real one is being created.
 *
 * Its `id` is the `clientId`, so the row is stable across the swap: the
 * server echoes that same clientId back, and React keeps the same element
 * rather than unmounting and remounting the row under the user's finger.
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

/** A body value as the cached set stores it: a number, or null when cleared. */
function numeric(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'number' ? value : Number(value);
}

export default function WorkoutSessionPageV2() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const api = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sync, setSync] = useState<RowSyncState>({});

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>('/workout-sessions/' + sessionId),
    enabled: Boolean(sessionId),
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOfferDismissed, setSaveOfferDismissed] = useState(false);
  const [savedWorkoutName, setSavedWorkoutName] = useState<string | null>(null);
  const [setSheetFor, setSetSheetFor] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  /** Per-exercise, because RPE is relevant to one lift and not another. */
  const [rpeShownFor, setRpeShownFor] = useState<Record<string, boolean>>({});

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });

  const sessionKey = ['workout-session', sessionId];

  /**
   * Writes a change straight into the cached session.
   *
   * Every mutation on this page is optimistic. The screen is operated with a
   * barbell in hand, and a control that does nothing for the length of a
   * round trip reads as broken — the user taps it again, which is how a
   * duplicate set gets created.
   *
   * Returns the previous cache so `onError` can put it back.
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
      api.patch<WorkoutSet>('/workout-sets/' + setId, body),
    onMutate: ({ setId, body }) => {
      setSync((prev) => ({ ...prev, [setId]: 'pending' }));
      /* The values land in the cache immediately, so the row keeps showing
         what was typed instead of reverting to the server's older copy while
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
      /* Put back exactly what was there. Without this a failed save left the
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
       "+ Add set" fail with a 400 every single time. It is the idempotency
       key — generating it client-side is what makes a retried request
       converge instead of creating a duplicate set, so the fix is to send one
       rather than to let the server invent it. */
    mutationFn: ({ exerciseLogId, clientId }: { exerciseLogId: string; clientId: string }) =>
      api.post<WorkoutSet>('/workout-exercise-logs/' + exerciseLogId + '/sets', { clientId }),
    /* The row appears on tap. Waiting for the round trip made the button look
       dead, and a dead-looking button gets tapped again — which is exactly
       how someone ends up with four sets they did not ask for. The
       client-generated `clientId` is what makes that safe: the server
       dedupes on it, so even a genuine double-tap converges. */
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
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(sessionKey, context.previous);
    },
    onSuccess: invalidate,
  });

  const saveAsWorkout = useMutation({
    mutationFn: (name: string) =>
      api.post<{ name: string }>(`/workout-sessions/${sessionId}/save-as-workout`, { name }),
    onSuccess: (created) => setSavedWorkoutName(created.name),
  });

  const changeSetType = useMutation({
    mutationFn: ({ setId, setType }: { setId: string; setType: string }) =>
      api.patch<WorkoutSet>('/workout-sets/' + setId, { setType }),
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
    mutationFn: (setId: string) => api.del('/workout-sets/' + setId),
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
       never happened for trend purposes, while keeping the row so the
       decision is reversible. */
    mutationFn: (exerciseLogId: string) =>
      api.patch('/workout-exercise-logs/' + exerciseLogId, { skipped: true }),
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

  const finish = useMutation({
    mutationFn: () => api.post('/workout-sessions/' + sessionId + '/complete'),
    onSuccess: invalidate,
  });

  const { data: catalogue = [], isPending: cataloguePending } = useQuery({
    queryKey: ['exercises'],
    /* Only fetched once the picker is opened. The catalogue is large and the
       logger does not otherwise need it. */
    queryFn: () => api.get<PickableExercise[]>('/exercises'),
    enabled: pickerOpen,
  });

  const addExercises = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      /* Sequential, not Promise.all. sortOrder is derived from insertion
         order server-side, and the picker promises "they are added in the
         order you picked them" — parallel posts would race that promise. */
      for (const exerciseId of exerciseIds) {
        /* Without a prescription the log's snapshot is null, and the logger
           falls back to `unprescribedDefinition` — which declares EVERY field,
           so the card rendered SET / PREVIOUS / LB / REPS / TIME / DISTANCE.
           Mid-session additions get the ordinary strength default; the
           exploration's own wording is "each with the default prescription
           for its kind". */
        await api.post('/workout-sessions/' + sessionId + '/exercises', {
          exerciseId,
          prescription: DEFAULT_ADDED_PRESCRIPTION,
        });
      }
    },
    onSuccess: async () => {
      setPickerOpen(false);
      await invalidate();
    },
  });

  const session = query.data;
  const exercises = useMemo(
    () => (session ? visibleSessionExercises(session.exercises) : []),
    [session],
  );
  const sessionComplete = session?.status === 'completed';

  /* What "save as a workout" would copy, computed from the same performed
     sets the server will read — so the preview cannot promise something the
     endpoint would not produce. */
  const derivedWorkout = useMemo(() => {
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
    ).map((item: DerivedExercise) => ({
      ...item,
      name: names.get(item.exerciseId) ?? 'Exercise',
    }));
  }, [exercises]);

  if (!session) {
    /* Two things this fixes. The header is chrome, not data, so rendering it
       immediately means the screen does not visibly reflow when the session
       lands and there is a back affordance during a slow load — matching what
       mobile already did. And loading is distinguished from not-found: the
       previous branch was `isLoading || !session`, so a session that genuinely
       does not exist showed "Loading…" forever. */
    const failed = query.isError || (!query.isLoading && !query.isPending);
    return (
      /* Deliberately NOT `workout-v2` — that testid is how specs wait for the
         loaded screen, and reusing it here let them proceed while the
         skeleton was still up, looking for cards that had not arrived. */
      <Screen data-testid="workout-v2-loading">
        <Header>
          <HeaderRow>
            <TitleGroup>
              <BackButton type="button" onClick={() => navigate('/today')} aria-label="Back to Today">
                ‹
              </BackButton>
              <Title>Workout session</Title>
            </TitleGroup>
          </HeaderRow>
          <Meta>{failed ? "Couldn't load this workout." : 'Loading…'}</Meta>
        </Header>
        {failed ? null : (
          <Body>
            <ExerciseCardsSkeleton />
          </Body>
        )}
      </Screen>
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

  const sessionDate = new Date(session.localDate + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  /* One shared readout so the banner's figures cannot disagree with mobile's,
     or with the per-exercise pills they are summed from. */
  const sessionReadout = buildCompletedSessionReadout(exercises);
  const totalVolume = sessionReadout.totalVolume;
  const loggedSets = sessionReadout.loggedSetCount;
  const plannedSets = exercises.reduce((n, log) => n + log.sets.length, 0);
  const duration = formatSessionDuration(session.startedAt, session.completedAt);

  const commit = (log: WorkoutSessionExerciseDetail, set: WorkoutSet, values: SetRowValues) => {
    const definition = getPrescriptionDefinition(log.prescription);
    const body: Record<string, unknown> = {};
    for (const field of quickEntryFields(definition)) {
      // The wire name for weight is `weightValue`; every other field matches.
      const key = field === 'weight' ? 'weightValue' : field;
      body[key] = parseOptionalNumber(values[field]) ?? null;
    }
    /* Required fields missing is not an error — the row is simply not written.
       A half-filled row costs nothing and nags about nothing. */
    const wouldBeLogged = definition.requiredFields
      .filter((field) => field !== 'setType')
      .every((field) => body[field === 'weight' ? 'weightValue' : field] != null);
    if (!wouldBeLogged) return;
    saveSet.mutate({ setId: set.id, body });
  };

  return (
    <Screen data-testid="workout-v2">
      {sessionComplete ? (
        <Banner data-testid="completion-banner">
          <BannerTop>
            <BannerMark>Workout complete</BannerMark>
            <FinishButton type="button" onClick={() => navigate('/today')}>
              Done
            </FinishButton>
          </BannerTop>
          <Meta data-testid="banner-meta">
            {formatSessionMeta({
              title: sessionDate,
              duration,
              loggedSetCount: loggedSets,
              personalRecordCount: sessionReadout.personalRecordCount,
            })}
          </Meta>
          <BannerTotal>
            <strong>{totalVolume.toLocaleString('en-US')}</strong>
            <span data-testid="banner-total-suffix">
              {formatSessionTotalSuffix(sessionReadout)}
            </span>
          </BannerTotal>
        </Banner>
      ) : (
        <Header>
          <HeaderRow>
            <TitleGroup>
              <BackButton type="button" onClick={() => navigate('/today')} aria-label="Back to Today">
                ‹
              </BackButton>
              <Title>Workout session</Title>
            </TitleGroup>
            <FinishButton type="button" onClick={() => finish.mutate()}>
              Finish
            </FinishButton>
          </HeaderRow>
          <Meta data-testid="session-meta">
            {totalVolume.toLocaleString('en-US')} lb · {loggedSets} of {plannedSets} sets
          </Meta>
        </Header>
      )}

      <Body>
        {/* Under the banner, never over it: the workout is already recorded,
            so the offer must not block the acknowledgement of what was just
            done. */}
        {sessionComplete && !saveOfferDismissed ? (
          savedWorkoutName ? (
            <SavedNotice data-testid="saved-workout-notice">
              Saved as <strong>{savedWorkoutName}</strong>. You can start it from Training whenever
              you like.
            </SavedNotice>
          ) : (
            <SaveAsWorkoutCard
              derived={derivedWorkout}
              onSave={(name) => saveAsWorkout.mutate(name)}
              onDismiss={() => setSaveOfferDismissed(true)}
              busy={saveAsWorkout.isPending}
            />
          )
        ) : null}
        {exercises.map((log) => {
          const definition = getPrescriptionDefinition(log.prescription);
          /* RPE is off by default and toggled per exercise from its ⋯
             sheet, which is the only place the design offers it. */
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
          const volume = log.sets.reduce((s, set) => s + (set.weightValue ?? 0) * (set.reps ?? 0), 0);

          return (
            <ExerciseTableCard
              key={log.id}
              testId={'exercise-card-' + log.id}
              exerciseName={log.exercise.name}
              planLabel={summarizePrescription(log.prescription)}
              resultLabel={
                readout
                  ? volume.toLocaleString('en-US') +
                    ' lb' +
                    (readout.comparison ? ' · ' + readout.comparison.compactLabel : '')
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
              onAddSet={() => addSet.mutate({ exerciseLogId: log.id, clientId: crypto.randomUUID() })}
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
                      duration: set.durationSeconds?.toString() ?? '',
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
      </Body>

      {sessionComplete ? null : (
        <BottomBar>
          <AddExercise type="button" onClick={() => setPickerOpen(true)}>
            + Add exercise
          </AddExercise>
        </BottomBar>
      )}

      {/* A full-screen surface rather than a dialog: the picker has its own
          header, its own scroll region and its own footer, and on a phone it
          is the whole screen in the design. */}
      {pickerOpen ? (
        <PickerOverlay role="dialog" aria-modal="true" aria-label="Add exercises">
          <ExercisePickerV2
            exercises={catalogue}
            title="Add to this workout"
            onCancel={() => setPickerOpen(false)}
            onAdd={(ids) => addExercises.mutate(ids)}
            busy={addExercises.isPending}
            loading={cataloguePending}
          />
        </PickerOverlay>
      ) : null}
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
          onViewHistory={() => navigate(`/history/${activeActions.exerciseId}`)}
          onToggleRpe={() =>
            setRpeShownFor((prev) => ({ ...prev, [activeActions.id]: !prev[activeActions.id] }))
          }
          onRemove={() => removeExercise.mutate(activeActions.id)}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Which value columns this exercise shows.
 *
 * RPE is an optional extra column, off by default — the table cannot spare a
 * permanent column for a field most sets leave blank, and the design turns it
 * on per exercise from the actions sheet. Everything else the prescription
 * defines is shown. See docs/design/workout-logging-table.md §4.
 *
 * Note this governs the COLUMN only: `commit` still writes every field the
 * prescription supports, so an RPE captured before the column was hidden is
 * never silently dropped.
 */
function visibleFields(
  definition: ReturnType<typeof getPrescriptionDefinition>,
): Exclude<SessionField, 'setType'>[] {
  return quickEntryFields(definition).filter((field) => field !== 'rpe');
}

/**
 * Warm-ups take no number and do not advance the sequence, so the chip label
 * is positional over *counted* sets only. It is derived on render and is never
 * an identity — `workout_set.id` is.
 */
function workingIndex(sets: readonly WorkoutSet[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (sets[i]?.setType !== 'warmup') n += 1;
  }
  return n;
}

/**
 * Planned targets, shown in placeholder tone until the user types over them.
 *
 * The prescription describes the exercise, not individual sets, so every row
 * of an exercise gets the same target. Rep ranges collapse to their lower
 * bound: a placeholder is a starting point to overwrite, and "8-12" is not a
 * number anyone can type over.
 */
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
