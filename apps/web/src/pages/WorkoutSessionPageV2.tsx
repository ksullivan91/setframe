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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });

  const saveSet = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: Record<string, unknown> }) =>
      api.patch<WorkoutSet>('/workout-sets/' + setId, body),
    onMutate: ({ setId }) => setSync((prev) => ({ ...prev, [setId]: 'pending' })),
    onError: (_error, { setId }) => setSync((prev) => ({ ...prev, [setId]: 'error' })),
    onSuccess: async (_data, { setId }) => {
      setSync((prev) => ({ ...prev, [setId]: undefined }));
      await invalidate();
    },
  });

  const addSet = useMutation({
    mutationFn: (exerciseLogId: string) =>
      api.post<WorkoutSet>('/workout-exercise-logs/' + exerciseLogId + '/sets', {}),
    onSuccess: invalidate,
  });

  const saveAsWorkout = useMutation({
    mutationFn: (name: string) =>
      api.post<{ name: string }>(`/workout-sessions/${sessionId}/save-as-workout`, { name }),
    onSuccess: (created) => setSavedWorkoutName(created.name),
  });

  const finish = useMutation({
    mutationFn: () => api.post('/workout-sessions/' + sessionId + '/complete'),
    onSuccess: invalidate,
  });

  const { data: catalogue = [] } = useQuery({
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
        await api.post('/workout-sessions/' + sessionId + '/exercises', { exerciseId });
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

  if (query.isLoading || !session) {
    return (
      <Screen>
        <Header>
          <HeaderRow>
            <Title>Loading…</Title>
          </HeaderRow>
        </Header>
      </Screen>
    );
  }

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
          const fields = visibleFields(definition);
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
          />
        </PickerOverlay>
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
