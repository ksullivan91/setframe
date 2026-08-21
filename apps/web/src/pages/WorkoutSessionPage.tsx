import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { Exercise, Prescription, WorkoutExerciseLog, WorkoutSession, WorkoutSet } from '@setline/schemas';
import { spacing } from '@setline/design-tokens';
import { Button, Card, IconButton, Input, PRBadge, Select, useToast } from '../components';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription } from '../lib/prescription';
import { typeScale } from '../theme/typeScale';

interface WorkoutSessionExercise extends WorkoutExerciseLog {
  exercise: Exercise;
  prescription: Prescription | null;
  sets: WorkoutSet[];
}

interface WorkoutSessionDetail extends WorkoutSession {
  exercises: WorkoutSessionExercise[];
}

interface EditableSetDraft {
  setType: WorkoutSet['setType'];
  weightValue: string;
  reps: string;
  rpe: string;
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  flex-wrap: wrap;
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;
const Subtitle = styled.p`
  margin: ${spacing[4]}px 0 0;
  color: ${(p) => p.theme.text.secondary};
`;
const ExerciseCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
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
const PlannedText = styled.p`
  margin: ${spacing[4]}px 0 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;
const SetRow = styled.div`
  display: grid;
  grid-template-columns: minmax(110px, 140px) repeat(3, minmax(0, 1fr)) auto auto;
  gap: ${spacing[8]}px;
  align-items: end;
`;
const SetMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  min-height: 40px;
`;
const EmptyText = styled.span`
  color: ${(p) => p.theme.text.secondary};
`;
const setTypeOptions = [
  { value: 'warmup', label: 'Warmup' },
  { value: 'working', label: 'Working' },
  { value: 'top', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
];



function getDefaultSetType(sets: WorkoutSet[]): WorkoutSet['setType'] {
  const lastType = sets.at(-1)?.setType;
  if (lastType === 'warmup') return 'working';
  return lastType ?? 'working';
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function WorkoutSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, EditableSetDraft>>({});

  const query = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const addSetMutation = useMutation({
    mutationFn: ({ exerciseLogId, setType }: { exerciseLogId: string; setType: WorkoutSet['setType'] }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${exerciseLogId}/sets`, { clientId: crypto.randomUUID(), setType }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
      toast.show({ variant: 'success', message: 'Set added.' });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.exerciseLogId];
        return next;
      });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add set.', actionLabel: 'Retry now' }),
  });

  const saveSetMutation = useMutation({
    mutationFn: ({ setId, body }: { setId: string; body: Partial<WorkoutSet> }) => api.patch<WorkoutSet>(`/workout-sets/${setId}`, body),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
      toast.show({ variant: 'success', message: 'Set saved.' });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.setId];
        return next;
      });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not save set.', actionLabel: 'Retry now' }),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (setId: string) => api.del(`/workout-sets/${setId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] });
      toast.show({ variant: 'success', message: 'Set deleted.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not delete set.', actionLabel: 'Retry now' }),
  });

  const finishWorkoutMutation = useMutation({
    mutationFn: () => api.post<WorkoutSession>(`/workout-sessions/${sessionId}/complete`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['today'] }),
        queryClient.invalidateQueries({ queryKey: ['workout-session', sessionId] }),
      ]);
      toast.show({ variant: 'success', message: 'Workout finished.' });
      navigate('/today');
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not finish workout.', actionLabel: 'Retry now' }),
  });

  const draftForSet = (set: WorkoutSet): EditableSetDraft =>
    drafts[set.id] ?? {
      setType: set.setType,
      weightValue: set.weightValue?.toString() ?? '',
      reps: set.reps?.toString() ?? '',
      rpe: set.rpe?.toString() ?? '',
    };

  const hasChanges = (set: WorkoutSet, draft: EditableSetDraft) =>
    draft.setType !== set.setType ||
    draft.weightValue !== (set.weightValue?.toString() ?? '') ||
    draft.reps !== (set.reps?.toString() ?? '') ||
    draft.rpe !== (set.rpe?.toString() ?? '');

  const orderedExercises = useMemo(() => query.data?.exercises ?? [], [query.data]);

  if (query.isLoading) return <span>Loading…</span>;
  if (query.isError || !query.data) return <span>Couldn't load workout session.</span>;

  return (
    <Page>
      <Header>
        <div>
          <Title>{query.data.status === 'completed' ? 'Workout complete' : 'Workout session'}</Title>
          <Subtitle>{new Date(`${query.data.localDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Subtitle>
        </div>
        <Button onClick={() => finishWorkoutMutation.mutate()} disabled={finishWorkoutMutation.isPending || query.data.status === 'completed'}>
          Finish workout
        </Button>
      </Header>

      {orderedExercises.map((exerciseLog: WorkoutSessionExercise) => (
        <ExerciseCard key={exerciseLog.id}>
          <ExerciseHeader>
            <div>
              <ExerciseTitle>{exerciseLog.exercise.name}</ExerciseTitle>
              <PlannedText>{summarizePrescription(exerciseLog.prescription)}</PlannedText>
            </div>
            <Button
              variant="secondary"
              onClick={() => addSetMutation.mutate({ exerciseLogId: exerciseLog.id, setType: getDefaultSetType(exerciseLog.sets) })}
              disabled={addSetMutation.isPending}
            >
              Add set
            </Button>
          </ExerciseHeader>

          {exerciseLog.sets.length ? exerciseLog.sets.map((set: WorkoutSet, index: number) => {
            const draft = draftForSet(set);
            return (
              <SetRow key={set.id}>
                <Select
                  label={`Set ${index + 1} type`}
                  value={draft.setType}
                  options={setTypeOptions}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [set.id]: { ...draft, setType: event.target.value as WorkoutSet['setType'] } }))}
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
                />
                <SetMeta>
                  {set.isPrWeight ? <PRBadge label="Weight PR" /> : null}
                  {set.isPrReps ? <PRBadge label="Rep PR" /> : null}
                </SetMeta>
                <div style={{ display: 'flex', gap: spacing[8], alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    disabled={!hasChanges(set, draft) || saveSetMutation.isPending}
                    onClick={() =>
                      saveSetMutation.mutate({
                        setId: set.id,
                        body: {
                          setType: draft.setType,
                          weightValue: parseOptionalNumber(draft.weightValue),
                          weightUnit: parseOptionalNumber(draft.weightValue) != null ? (set.weightUnit ?? 'lb') : undefined,
                          reps: parseOptionalNumber(draft.reps),
                          rpe: parseOptionalNumber(draft.rpe),
                        },
                      })
                    }
                  >
                    Save
                  </Button>
                  <IconButton aria-label={`Delete set ${index + 1}`} onClick={() => deleteSetMutation.mutate(set.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </SetRow>
            );
          }) : <EmptyText>No sets logged yet.</EmptyText>}
        </ExerciseCard>
      ))}
    </Page>
  );
}
