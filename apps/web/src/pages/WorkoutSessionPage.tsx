import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  Exercise,
  Prescription,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
  WorkoutSetPreviousPerformance,
} from '@setframe/schemas';
import { calculateVolume, detectRepPR, detectWeightPR, estimateOneRepMax } from '@setframe/domain';
import { radius, spacing } from '@setframe/design-tokens';
import { AsyncStatusIndicator, Button, Card, IconButton, Input, Modal, PRBadge, Select, Skeleton, SkeletonStack, useAsyncStatus, useToast } from '../components';
import { AddExercisePicker } from '../components/AddExercisePicker';
import { useApiClient } from '../lib/api-client';
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
} from '../lib/prescription';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';

type SetType = WorkoutSet['setType'];

interface DraftValues {
  setType: SetType;
  weightValue: string;
  reps: string;
  durationSeconds: string;
  distanceValue: string;
  distanceUnit: 'm' | 'km' | 'mi';
  rpe: string;
}

interface RemovalCandidate {
  setId: string;
  exerciseLogId: string;
  label: string;
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  padding-bottom: calc(${spacing[24]}px + 72px + env(safe-area-inset-bottom));

  ${mq.desktop} {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    align-items: start;
    gap: ${spacing[24]}px;
    padding-bottom: ${spacing[24]}px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
  grid-column: 1 / -1;
`;

const HeaderMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
  align-items: center;
  justify-content: flex-end;
`;

const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;

  ${mq.desktop} {
    position: sticky;
    top: ${spacing[24]}px;
  }
`;

const SummaryTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const SummaryStat = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${spacing[8]}px;
`;

const SummaryLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const SummaryValue = styled.span`
  font-size: ${typeScale.numericMetric.fontSize}px;
  font-weight: ${typeScale.numericMetric.fontWeight};
  font-variant-numeric: tabular-nums;
`;

const ExerciseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
  grid-column: 1;
`;

const ExerciseCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const ExerciseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const ExerciseTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const SupportingText = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const PreviousSessionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  background: ${(p) => p.theme.surface.sunken};
`;

const PreviousSessionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
`;

const PreviousSessionRow = styled.div`
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: ${spacing[8]}px;
  align-items: baseline;
`;

const PreviousSessionLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const SetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const SetCard = styled.div`
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const SetCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const SetTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;

const SetTitle = styled.h3`
  margin: 0;
  font-size: ${typeScale.body.fontSize}px;
`;

const Chips = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  flex-wrap: wrap;
  align-items: center;
`;

const CuePill = styled.span`
  padding: ${spacing[4]}px ${spacing[8]}px;
  border-radius: 999px;
  background: ${(p) => p.theme.surface.sunken};
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.helper.fontSize}px;
`;

const SetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const SetFooter = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const SetActions = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  margin-left: auto;
`;

const AddSetButtonWrap = styled.div`
  width: 100%;

  ${mq.tablet} {
    width: auto;
  }
`;

const EmptyText = styled.p`
  color: ${(p) => p.theme.text.secondary};
  margin: 0;
`;

const setTypeOptions = [
  { value: 'warmup', label: 'Warmup' },
  { value: 'working', label: 'Working' },
  { value: 'top', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
];

const distanceUnitOptions = [
  { value: 'm', label: 'm' },
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'mi' },
];

function formatElapsed(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getDefaultSetType(sets: WorkoutSet[]): SetType {
  const lastType = sets.at(-1)?.setType;
  if (lastType === 'warmup') return 'working';
  return lastType ?? 'working';
}

/* Duration is always persisted in seconds. Continuous efforts (a 30 minute
   ride) are far more natural to type in minutes, so the draft holds the
   displayed unit and converts on the way in and out. */
function secondsToDisplay(seconds: number | null, definition: PrescriptionDefinition): string {
  if (seconds == null) return '';
  if (definition.units.duration !== 'minutes') return seconds.toString();
  const minutes = seconds / 60;
  return (Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(2))).toString();
}

function displayToSeconds(value: string, definition: PrescriptionDefinition): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return undefined;
  return definition.units.duration === 'minutes' ? Math.round(parsed * 60) : parsed;
}

function getDraft(set: WorkoutSet, definition: PrescriptionDefinition): DraftValues {
  return {
    setType: set.setType,
    weightValue: set.weightValue?.toString() ?? '',
    reps: set.reps?.toString() ?? '',
    durationSeconds: secondsToDisplay(set.durationSeconds, definition),
    distanceValue: set.distanceValue?.toString() ?? '',
    distanceUnit: set.distanceUnit ?? definition.units.distance,
    rpe: set.rpe?.toString() ?? '',
  };
}

function getPlannedValue(set: WorkoutSet, index: number, exerciseLog: WorkoutSessionExerciseDetail) {
  const planned = exerciseLog.sets[index];
  if (!planned) return null;
  const summary = formatSessionSet(exerciseLog.prescription, planned);
  if (!summary) return summarizePrescription(exerciseLog.prescription).replace(/^Planned:\s*/, '');
  return summary;
}

function getPreviousSet(
  previousSessionSet: WorkoutSetPreviousPerformance | undefined,
  exerciseLog: WorkoutSessionExerciseDetail,
) {
  if (!previousSessionSet) return null;
  return formatSessionSet(exerciseLog.prescription, previousSessionSet, { includeRpe: true }) || '—';
}

/* Only fields the user can actually see are submitted. A hidden field is
   omitted from the patch entirely rather than sent as null, so switching an
   exercise's prescription never silently wipes data the user cannot see. */
function buildPatch(existing: WorkoutSet, draft: DraftValues, visible: SessionField[], definition: PrescriptionDefinition) {
  const patch: Record<string, unknown> = {};

  if (visible.includes('setType')) patch.setType = draft.setType;
  if (visible.includes('weight')) {
    const weightValue = parseOptionalNumber(draft.weightValue);
    patch.weightValue = weightValue;
    patch.weightUnit = weightValue != null ? existing.weightUnit ?? 'lb' : undefined;
  }
  if (visible.includes('reps')) patch.reps = parseOptionalNumber(draft.reps);
  if (visible.includes('duration')) patch.durationSeconds = displayToSeconds(draft.durationSeconds, definition);
  if (visible.includes('distance')) {
    const distanceValue = parseOptionalNumber(draft.distanceValue);
    patch.distanceValue = distanceValue;
    patch.distanceUnit = distanceValue != null ? draft.distanceUnit : undefined;
  }
  if (visible.includes('rpe')) patch.rpe = parseOptionalNumber(draft.rpe);

  return patch;
}

const patchKeysByField: Record<SessionField, (keyof WorkoutSet)[]> = {
  setType: ['setType'],
  weight: ['weightValue'],
  reps: ['reps'],
  duration: ['durationSeconds'],
  distance: ['distanceValue', 'distanceUnit'],
  rpe: ['rpe'],
};

function hasChanges(existing: WorkoutSet, draft: DraftValues, visible: SessionField[], definition: PrescriptionDefinition) {
  const next = buildPatch(existing, draft, visible, definition) as Partial<Record<keyof WorkoutSet, unknown>>;
  return visible.some((field) =>
    patchKeysByField[field].some((key) => {
      if (!(key in next)) return false;
      return (next[key] ?? null) !== existing[key];
    }),
  );
}

function draftToValues(draft: DraftValues, definition: PrescriptionDefinition) {
  return {
    setType: draft.setType,
    weightValue: parseOptionalNumber(draft.weightValue) ?? null,
    reps: parseOptionalNumber(draft.reps) ?? null,
    durationSeconds: displayToSeconds(draft.durationSeconds, definition) ?? null,
    distanceValue: parseOptionalNumber(draft.distanceValue) ?? null,
    rpe: parseOptionalNumber(draft.rpe) ?? null,
  };
}

function isStrengthLikeSet(set: WorkoutSet | WorkoutSetPreviousPerformance) {
  return set.weightValue != null || set.reps != null;
}

export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [elapsedTick, setElapsedTick] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<RemovalCandidate | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const lastMutationRef = useRef<(() => Promise<unknown>) | null>(null);
  const inlineStatus = useAsyncStatus();

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  useEffect(() => {
    if (query.data?.status === 'completed') return;
    const interval = setInterval(() => setElapsedTick((tick) => tick + 1), 60_000);
    return () => clearInterval(interval);
  }, [query.data?.status]);

  void elapsedTick;

  const refreshSession = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['today'] }),
    ]);
  };

  const addSetMutation = useMutation({
    mutationFn: ({ exerciseLogId, sourceSet }: { exerciseLogId: string; sourceSet?: WorkoutSet }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, {
        clientId: crypto.randomUUID(),
        setType: sourceSet?.setType ?? 'working',
        weightValue: sourceSet?.weightValue ?? undefined,
        weightUnit: sourceSet?.weightValue != null ? sourceSet.weightUnit ?? 'lb' : undefined,
        reps: sourceSet?.reps ?? undefined,
        durationSeconds: sourceSet?.durationSeconds ?? undefined,
        distanceValue: sourceSet?.distanceValue ?? undefined,
        distanceUnit: sourceSet?.distanceValue != null ? sourceSet.distanceUnit ?? 'mi' : undefined,
        rpe: sourceSet?.rpe ?? undefined,
      }),
    onSuccess: async () => {
      await refreshSession();
      toast.show({ variant: 'success', message: 'Set added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add set.' }),
  });

  const saveSetMutation = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: ReturnType<typeof buildPatch> }) => api.patch<WorkoutSet>(`/workout-sets/${setId}`, body),
    onSuccess: async (_, variables) => {
      await refreshSession();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.setId];
        return next;
      });
    },
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onSuccess: async () => {
      await refreshSession();
      setPendingRemoval(null);
      toast.show({ variant: 'success', message: 'Set removed.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove set.' }),
  });

  /* Story 08: the session carries its own prescription snapshot because an
     exercise added mid-session has no day-type row to inherit one from. */
  const addExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, prescription }: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/workout-sessions/${sessionId}/exercises`, { exerciseId, prescription }),
    onSuccess: async () => {
      await refreshSession();
      setAddExerciseOpen(false);
      toast.show({ variant: 'success', message: 'Exercise added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add exercise.' }),
  });

  const createExerciseMutation = useMutation({
    mutationFn: (name: string) => api.post<Exercise>('/exercises', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: () => api.post(`/workout-sessions/${sessionId}/complete`),
    onSuccess: async () => {
      await refreshSession();
      toast.show({ variant: 'success', message: 'Workout finished.' });
      navigate('/today');
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not finish workout.' }),
  });

  const orderedExercises = useMemo(() => query.data?.exercises ?? [], [query.data]);
  const totalSetsLogged = useMemo(
    () =>
      orderedExercises.reduce(
        (total, exerciseLog) =>
          total +
          exerciseLog.sets.filter((set) => isSessionSetLogged(exerciseLog.prescription, set)).length,
        0,
      ),
    [orderedExercises],
  );

  // Timed, distance and bodyweight work carries no weight, so including it
  // would contribute nothing while making the total look authoritative.
  const totalVolume = useMemo(
    () =>
      calculateVolume(
        orderedExercises
          .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
          .flatMap((exerciseLog) => exerciseLog.sets),
      ),
    [orderedExercises],
  );

  const bestEstimated1rm = useMemo(() => {
    const estimates = orderedExercises
      .filter((exerciseLog) => countsTowardVolume(exerciseLog.prescription))
      .flatMap((exerciseLog) => exerciseLog.sets)
      .filter((set) => set.weightValue != null && set.reps != null)
      .map((set) => estimateOneRepMax(set.weightValue!, set.reps!));
    if (!estimates.length) return null;
    return Math.round(Math.max(...estimates));
  }, [orderedExercises]);

  if (query.isLoading) {
    return (
      <Page>
        <SkeletonStack $gap={16}>
          <Skeleton $width="50%" $height={26} />
          <Skeleton $width="30%" $height={16} />
        </SkeletonStack>
        <SkeletonStack $gap={16}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <SkeletonStack>
                <Skeleton $width="45%" $height={18} />
                <Skeleton $height={40} />
                <Skeleton $height={40} />
              </SkeletonStack>
            </Card>
          ))}
        </SkeletonStack>
      </Page>
    );
  }
  if (query.isError || !query.data) return <span>Couldn't load workout session.</span>;

  return (
    <Page>
      <Header>
        <HeaderMeta>
          <Title>{query.data.status === 'completed' ? 'Workout complete' : 'Workout session'}</Title>
          <Subtitle>
            {new Date(`${query.data.localDate}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Subtitle>
        </HeaderMeta>
        <Actions>
          <AsyncStatusIndicator
            status={inlineStatus.status}
            onRetry={lastMutationRef.current ? () => void inlineStatus.run(lastMutationRef.current!) : undefined}
          />
          <Button variant="secondary" onClick={() => setAddExerciseOpen(true)} disabled={query.data.status === 'completed'}>
            Add exercise
          </Button>
          <Button
            onClick={() => finishWorkoutMutation.mutate()}
            disabled={finishWorkoutMutation.isPending || query.data.status === 'completed'}
            status={finishWorkoutMutation.isPending ? 'loading' : 'idle'}
          >
            Finish workout
          </Button>
        </Actions>
      </Header>

      <SummaryCard aria-label="Session summary">
        <SummaryTitle>Session summary</SummaryTitle>
        <SummaryStat>
          <SummaryLabel>Elapsed</SummaryLabel>
          <SummaryValue>{formatElapsed(query.data.startedAt, query.data.completedAt)}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Sets logged</SummaryLabel>
          <SummaryValue>{totalSetsLogged}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Volume</SummaryLabel>
          <SummaryValue>{totalVolume ? `${totalVolume.toLocaleString()} lb` : '—'}</SummaryValue>
        </SummaryStat>
        <SummaryStat>
          <SummaryLabel>Best est. 1RM</SummaryLabel>
          <SummaryValue>{bestEstimated1rm ? `${bestEstimated1rm} lb` : '—'}</SummaryValue>
        </SummaryStat>
      </SummaryCard>

      <ExerciseList>
        {orderedExercises.map((exerciseLog) => {
          const definition = getPrescriptionDefinition(exerciseLog.prescription);
          return (
          <ExerciseCard key={exerciseLog.id}>
            <ExerciseHeader>
              <div>
                <ExerciseTitle>{exerciseLog.exercise.name}</ExerciseTitle>
                <SupportingText>{summarizePrescription(exerciseLog.prescription)}</SupportingText>
              </div>
              <AddSetButtonWrap>
                <Button
                  variant="secondary"
                  onClick={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: exerciseLog.sets.at(-1) })}
                  disabled={addSetMutation.isPending || query.data.status === 'completed'}
                >
                  <Plus size={16} /> Add set
                </Button>
              </AddSetButtonWrap>
            </ExerciseHeader>

            {exerciseLog.previousSession ? (
              <PreviousSessionCard>
                <SupportingText>
                  Previous session · {new Date(`${exerciseLog.previousSession.localDate}T12:00:00`).toLocaleDateString()}
                </SupportingText>
                <PreviousSessionGrid>
                  {exerciseLog.previousSession.sets.map((previousSet, index) => (
                    <PreviousSessionRow key={`${exerciseLog.previousSession!.sessionId}-${index}`}>
                      <PreviousSessionLabel>Set {index + 1}</PreviousSessionLabel>
                      <span>{getPreviousSet(previousSet, exerciseLog)}</span>
                    </PreviousSessionRow>
                  ))}
                </PreviousSessionGrid>
              </PreviousSessionCard>
            ) : null}

            {exerciseLog.sets.length ? (
              <SetList>
                {exerciseLog.sets.map((set, index) => {
                  const draft = drafts[set.id] ?? getDraft(set, definition);
                  const draftValues = draftToValues(draft, definition);
                  // Union of the prescription's fields and anything this set
                  // already stores, so legacy values stay editable.
                  const visibleFields = resolveSessionFields(exerciseLog.prescription, {
                    ...set,
                    ...draftValues,
                  });
                  const fieldErrors = validateSessionSet(exerciseLog.prescription, draftValues);
                  const plannedValue = getPlannedValue(set, index, exerciseLog);
                  const previousValue = getPreviousSet(exerciseLog.previousSession?.sets[index], exerciseLog);
                  const candidate = {
                    weightValue: parseOptionalNumber(draft.weightValue) ?? null,
                    reps: parseOptionalNumber(draft.reps) ?? null,
                  };
                  const priorStrengthHistory = (exerciseLog.previousSession?.sets ?? []).filter(isStrengthLikeSet);
                  const optimisticWeightPr = detectWeightPR(candidate, priorStrengthHistory);
                  const optimisticRepPr = detectRepPR(candidate, priorStrengthHistory);

                  return (
                    <SetCard key={set.id}>
                      <SetCardHeader>
                        <SetTitleGroup>
                          <SetTitle>Set {index + 1}</SetTitle>
                          <SupportingText>{set.setType === 'working' ? 'Working set' : `${setTypeOptions.find((option) => option.value === set.setType)?.label ?? set.setType}`}</SupportingText>
                        </SetTitleGroup>
                        <Chips>
                          {plannedValue ? <CuePill>Planned: {plannedValue}</CuePill> : null}
                          {previousValue ? <CuePill>Prev: {previousValue}</CuePill> : null}
                          {set.isPrWeight || optimisticWeightPr ? <PRBadge label="Weight PR" /> : null}
                          {set.isPrReps || optimisticRepPr ? <PRBadge label="Rep PR" /> : null}
                        </Chips>
                      </SetCardHeader>

                      <SetGrid>
                        {visibleFields.map((field) => {
                          const update = (patch: Partial<DraftValues>) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, ...patch } }));
                          const label = getSessionFieldLabel(field, definition);
                          const error = fieldErrors[field];

                          switch (field) {
                            case 'setType':
                              return (
                                <Select
                                  key={field}
                                  label="Type"
                                  value={draft.setType}
                                  options={setTypeOptions}
                                  onChange={(event) => update({ setType: event.target.value as SetType })}
                                />
                              );
                            case 'weight':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.weightValue}
                                  onChange={(event) => update({ weightValue: event.target.value })}
                                  inputMode="decimal"
                                  unit={set.weightUnit ?? 'lb'}
                                  error={error}
                                />
                              );
                            case 'reps':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.reps}
                                  onChange={(event) => update({ reps: event.target.value })}
                                  inputMode="numeric"
                                  error={error}
                                />
                              );
                            case 'duration':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.durationSeconds}
                                  onChange={(event) => update({ durationSeconds: event.target.value })}
                                  inputMode="decimal"
                                  error={error}
                                />
                              );
                            case 'distance':
                              return (
                                <Fragment key={field}>
                                  <Input
                                    label={label}
                                    value={draft.distanceValue}
                                    onChange={(event) => update({ distanceValue: event.target.value })}
                                    inputMode="decimal"
                                    error={error}
                                  />
                                  <Select
                                    label="Distance unit"
                                    value={draft.distanceUnit}
                                    options={distanceUnitOptions}
                                    onChange={(event) =>
                                      update({ distanceUnit: event.target.value as DraftValues['distanceUnit'] })
                                    }
                                  />
                                </Fragment>
                              );
                            case 'rpe':
                              return (
                                <Input
                                  key={field}
                                  label={label}
                                  value={draft.rpe}
                                  onChange={(event) => update({ rpe: event.target.value })}
                                  inputMode="decimal"
                                  labelHint="How hard the set felt, from 1 to 10."
                                  error={error}
                                />
                              );
                            default:
                              return null;
                          }
                        })}
                      </SetGrid>

                      <SetFooter>
                        <SupportingText>
                          {plannedValue ? 'Planned beside actual for quick comparison.' : 'Log what you actually did.'}
                        </SupportingText>
                        <SetActions>
                          <Button
                            variant="secondary"
                            disabled={
                              !hasChanges(set, draft, visibleFields, definition) ||
                              Object.keys(fieldErrors).length > 0 ||
                              saveSetMutation.isPending ||
                              query.data.status === 'completed'
                            }
                            onClick={() => {
                              const action = () =>
                                saveSetMutation.mutateAsync({ setId: set.id, body: buildPatch(set, draft, visibleFields, definition) });
                              lastMutationRef.current = action;
                              void inlineStatus.run(action);
                            }}
                          >
                            Save
                          </Button>
                          <IconButton
                            aria-label={`Duplicate set ${index + 1}`}
                            onClick={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, sourceSet: set })}
                            disabled={query.data.status === 'completed'}
                          >
                            <Copy size={16} />
                          </IconButton>
                          <IconButton
                            aria-label={`Delete set ${index + 1}`}
                            onClick={() => setPendingRemoval({ setId: set.id, exerciseLogId: exerciseLog.id, label: `Set ${index + 1}` })}
                            disabled={query.data.status === 'completed'}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </SetActions>
                      </SetFooter>
                    </SetCard>
                  );
                })}
              </SetList>
            ) : (
              <EmptyText>No sets logged yet — add the first set to start recording actual performance.</EmptyText>
            )}
          </ExerciseCard>
          );
        })}
      </ExerciseList>

      <Modal
        open={pendingRemoval != null}
        onClose={() => setPendingRemoval(null)}
        title="Remove set?"
        description="This deletes the set from the workout session. Use duplicate/add if you meant to adjust order instead."
      >
        <SupportingText>{pendingRemoval?.label}</SupportingText>
        <Actions>
          <Button variant="secondary" onClick={() => setPendingRemoval(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => pendingRemoval && deleteSetMutation.mutate(pendingRemoval.setId)}
            disabled={deleteSetMutation.isPending}
          >
            Remove set
          </Button>
        </Actions>
      </Modal>

      {addExerciseOpen ? (
        <AddExercisePicker
          exercises={exercisesQuery.data ?? []}
          exercisesLoading={exercisesQuery.isLoading}
          exercisesError={exercisesQuery.isError}
          onRetryExercises={() => void exercisesQuery.refetch()}
          onClose={() => setAddExerciseOpen(false)}
          onCreateExercise={(name) => createExerciseMutation.mutateAsync(name)}
          isCreatingExercise={createExerciseMutation.isPending}
          onAddExercise={(exerciseId, prescription) => addExerciseMutation.mutateAsync({ exerciseId, prescription })}
          isAddingExercise={addExerciseMutation.isPending}
        />
      ) : null}

    </Page>
  );
}
