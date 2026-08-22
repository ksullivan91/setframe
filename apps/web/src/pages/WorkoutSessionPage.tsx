import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  Exercise,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
  WorkoutSetPreviousPerformance,
} from '@setframe/schemas';
import { calculateVolume, detectRepPR, detectWeightPR, estimateOneRepMax } from '@setframe/domain';
import { radius, spacing } from '@setframe/design-tokens';
import { AsyncStatusIndicator, Button, Card, IconButton, Input, Modal, PRBadge, Select, Skeleton, SkeletonStack, useAsyncStatus, useToast } from '../components';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription } from '../lib/prescription';
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

const SelectExerciseRow = styled.div`
  display: grid;
  gap: ${spacing[12]}px;
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

function getDraft(set: WorkoutSet): DraftValues {
  return {
    setType: set.setType,
    weightValue: set.weightValue?.toString() ?? '',
    reps: set.reps?.toString() ?? '',
    durationSeconds: set.durationSeconds?.toString() ?? '',
    distanceValue: set.distanceValue?.toString() ?? '',
    distanceUnit: set.distanceUnit ?? 'mi',
    rpe: set.rpe?.toString() ?? '',
  };
}

function getPlannedValue(set: WorkoutSet, index: number, exerciseLog: WorkoutSessionExerciseDetail) {
  const planned = exerciseLog.sets[index];
  if (!planned) return null;
  const bits: string[] = [];
  if (planned.weightValue != null) bits.push(`${planned.weightValue}${planned.weightUnit ?? ''}`);
  if (planned.reps != null) bits.push(`${planned.reps} reps`);
  if (planned.durationSeconds != null) bits.push(`${planned.durationSeconds}s`);
  if (planned.distanceValue != null) bits.push(`${planned.distanceValue}${planned.distanceUnit ?? ''}`);
  if (!bits.length) return summarizePrescription(exerciseLog.prescription).replace(/^Planned:\s*/, '');
  return bits.join(' · ');
}

function getPreviousSet(previousSessionSet: WorkoutSetPreviousPerformance | undefined) {
  if (!previousSessionSet) return null;
  const bits: string[] = [];
  if (previousSessionSet.weightValue != null) bits.push(`${previousSessionSet.weightValue}${previousSessionSet.weightUnit ?? ''}`);
  if (previousSessionSet.reps != null) bits.push(`${previousSessionSet.reps} reps`);
  if (previousSessionSet.durationSeconds != null) bits.push(`${previousSessionSet.durationSeconds}s`);
  if (previousSessionSet.distanceValue != null) bits.push(`${previousSessionSet.distanceValue}${previousSessionSet.distanceUnit ?? ''}`);
  if (previousSessionSet.rpe != null) bits.push(`RPE ${previousSessionSet.rpe}`);
  return bits.join(' · ') || '—';
}

function buildPatch(existing: WorkoutSet, draft: DraftValues) {
  const weightValue = parseOptionalNumber(draft.weightValue);
  const reps = parseOptionalNumber(draft.reps);
  const durationSeconds = parseOptionalNumber(draft.durationSeconds);
  const distanceValue = parseOptionalNumber(draft.distanceValue);
  const rpe = parseOptionalNumber(draft.rpe);

  return {
    setType: draft.setType,
    weightValue,
    weightUnit: weightValue != null ? existing.weightUnit ?? 'lb' : undefined,
    reps,
    durationSeconds,
    distanceValue,
    distanceUnit: distanceValue != null ? draft.distanceUnit : undefined,
    rpe,
  };
}

function hasChanges(existing: WorkoutSet, draft: DraftValues) {
  const next = buildPatch(existing, draft);
  return (
    next.setType !== existing.setType ||
    (next.weightValue ?? null) !== existing.weightValue ||
    (next.reps ?? null) !== existing.reps ||
    (next.durationSeconds ?? null) !== existing.durationSeconds ||
    (next.distanceValue ?? null) !== existing.distanceValue ||
    (next.distanceUnit ?? null) !== existing.distanceUnit ||
    (next.rpe ?? null) !== existing.rpe
  );
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
  const [newExerciseId, setNewExerciseId] = useState('');
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

  const addExerciseMutation = useMutation({
    mutationFn: (exerciseId: string) => api.post(`/workout-sessions/${sessionId}/exercises`, { exerciseId }),
    onSuccess: async () => {
      await refreshSession();
      setAddExerciseOpen(false);
      setNewExerciseId('');
      toast.show({ variant: 'success', message: 'Exercise added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add exercise.' }),
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
  const exerciseIdsInSession = useMemo(() => new Set(orderedExercises.map((exerciseLog) => exerciseLog.exerciseId)), [orderedExercises]);
  const addableExercises = useMemo(
    () => (exercisesQuery.data ?? []).filter((exercise) => !exerciseIdsInSession.has(exercise.id)),
    [exerciseIdsInSession, exercisesQuery.data],
  );

  const totalSetsLogged = useMemo(
    () =>
      orderedExercises.reduce(
        (total, exerciseLog) =>
          total +
          exerciseLog.sets.filter(
            (set) => set.weightValue != null || set.reps != null || set.durationSeconds != null || set.distanceValue != null,
          ).length,
        0,
      ),
    [orderedExercises],
  );

  const totalVolume = useMemo(() => calculateVolume(orderedExercises.flatMap((exerciseLog) => exerciseLog.sets)), [orderedExercises]);

  const bestEstimated1rm = useMemo(() => {
    const estimates = orderedExercises
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
        {orderedExercises.map((exerciseLog) => (
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
                      <span>{getPreviousSet(previousSet)}</span>
                    </PreviousSessionRow>
                  ))}
                </PreviousSessionGrid>
              </PreviousSessionCard>
            ) : null}

            {exerciseLog.sets.length ? (
              <SetList>
                {exerciseLog.sets.map((set, index) => {
                  const draft = drafts[set.id] ?? getDraft(set);
                  const plannedValue = getPlannedValue(set, index, exerciseLog);
                  const previousValue = getPreviousSet(exerciseLog.previousSession?.sets[index]);
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
                        <Select
                          label="Type"
                          value={draft.setType}
                          options={setTypeOptions}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, setType: event.target.value as SetType } }))
                          }
                        />
                        <Input
                          label="Weight"
                          value={draft.weightValue}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, weightValue: event.target.value } }))}
                          inputMode="decimal"
                          unit={set.weightUnit ?? 'lb'}
                        />
                        <Input
                          label="Reps"
                          value={draft.reps}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, reps: event.target.value } }))}
                          inputMode="numeric"
                        />
                        <Input
                          label="RPE"
                          value={draft.rpe}
                          onChange={(event) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, rpe: event.target.value } }))}
                          inputMode="decimal"
                          labelHint="How hard the set felt, from 1 to 10."
                        />
                        <Input
                          label="Duration (sec)"
                          value={draft.durationSeconds}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, durationSeconds: event.target.value } }))
                          }
                          inputMode="numeric"
                        />
                        <Input
                          label="Distance"
                          value={draft.distanceValue}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, distanceValue: event.target.value } }))
                          }
                          inputMode="decimal"
                        />
                        <Select
                          label="Distance unit"
                          value={draft.distanceUnit}
                          options={distanceUnitOptions}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, distanceUnit: event.target.value as DraftValues['distanceUnit'] } }))
                          }
                        />
                      </SetGrid>

                      <SetFooter>
                        <SupportingText>
                          {plannedValue ? 'Planned beside actual for quick comparison.' : 'Log what you actually did.'}
                        </SupportingText>
                        <SetActions>
                          <Button
                            variant="secondary"
                            disabled={!hasChanges(set, draft) || saveSetMutation.isPending || query.data.status === 'completed'}
                            onClick={() => {
                              const action = () => saveSetMutation.mutateAsync({ setId: set.id, body: buildPatch(set, draft) });
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
        ))}
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

      <Modal
        open={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        title="Add exercise"
        description="Insert another exercise mid-session without losing any logged sets."
      >
        <SelectExerciseRow>
          <Select
            label="Exercise"
            value={newExerciseId}
            onChange={(event) => setNewExerciseId(event.target.value)}
            options={[
              { value: '', label: addableExercises.length ? 'Select exercise' : 'No more exercises available' },
              ...addableExercises.map((exercise) => ({
                value: exercise.id,
                label: exercise.isCustom ? `${exercise.name} (custom)` : exercise.name,
              })),
            ]}
          />
          <Actions>
            <Button variant="secondary" onClick={() => setAddExerciseOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => newExerciseId && addExerciseMutation.mutate(newExerciseId)}
              disabled={!newExerciseId || addExerciseMutation.isPending}
              status={addExerciseMutation.isPending ? 'loading' : 'idle'}
            >
              Add exercise
            </Button>
          </Actions>
        </SelectExerciseRow>
      </Modal>
    </Page>
  );
}
