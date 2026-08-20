import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Copy, Minus, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { detectWeightPR, detectRepPR } from '@setline/domain';
import type { Exercise, WorkoutExerciseLog, WorkoutSession, WorkoutSet } from '@setline/schemas';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { Card, Checkbox, IconButton, Button, PRBadge } from '../components';
import { useApiClient } from '../lib/api-client';

/**
 * WorkoutLogger — the master spec's most emphasized screen. Implements
 * style guide §9 (SetRow/Editable: checkbox + weight + reps + duplicate/
 * remove) and §17 (ghost "prev X" last-session text + PR trophy badge,
 * computed optimistically client-side via packages/domain per master
 * spec §9's "safe to call identically from API and clients" note).
 *
 * Mobile-first: each SetRow wraps onto two lines on narrow viewports
 * (checkbox/label/PR badge on one line, weight/reps/actions below) to
 * avoid cramming 6 columns into a 390px-wide frame; from `tablet` up it
 * becomes the single-row grid.
 */
/** Local set row is the working UI state; `clientId` is what we send to
 * the API for idempotent creation (see createWorkoutSetSchema / docs/
 * api.md "Idempotency"). `serverId` is populated once the API has
 * persisted the row, at which point further edits use PATCH instead of
 * POST-with-clientId. */
interface SetRow {
  clientId: string;
  serverId: string | null;
  weightValue: number | null;
  reps: number | null;
  completed: boolean;
}

interface HistorySet {
  weightValue: number | null;
  reps: number | null;
}

/** GET /exercises/:id/history is currently a stub (apps/api/src/routes/
 * exercises.ts) that always returns `{ items: [], nextCursor: null }` —
 * ghost "prev X" text and history-based PR detection will show nothing
 * meaningful until that route is implemented server-side.
 * TODO: apps/api needs to implement GET /v1/exercises/:exerciseId/history
 * (currently returns empty items unconditionally).
 */
interface ExerciseHistoryResponse {
  items: HistorySet[];
  nextCursor: string | null;
}

function todaysLocalDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const ExerciseName = styled.h2`
  font-size: ${typeScale.sectionTitle.fontSize}px;
  margin: 0 0 ${spacing[8]}px;
`;

const Prescription = styled.p`
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: 0 0 ${spacing[16]}px;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};

  ${mq.tablet} {
    display: grid;
    grid-template-columns: auto auto 1fr 1fr auto auto;
  }
`;

const SetLabel = styled.span`
  font-size: ${typeScale.body.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  width: 48px;
`;

const GhostText = styled.span`
  display: block;
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.disabled};
`;

const NumericInput = styled.input`
  width: 100%;
  height: 40px;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  padding: 0 ${spacing[8]}px;
  font-size: ${typeScale.numericWorkoutSet.fontSize}px;
  font-variant-numeric: tabular-nums;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const InputGroup = styled.div`
  flex: 1 1 40%;

  ${mq.tablet} {
    flex: initial;
  }
`;

const RowActions = styled.div`
  display: flex;
  gap: ${spacing[4]}px;
  margin-left: auto;
`;

const AddExercise = styled.button`
  width: 100%;
  margin-top: ${spacing[16]}px;
  padding: ${spacing[12]}px;
  border: 1px dashed ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: transparent;
  color: ${(p) => p.theme.text.secondary};
  cursor: pointer;
`;

export function WorkoutLoggerPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exerciseLogId, setExerciseLogId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);

  const { data: exercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
  });

  // Default to the first available exercise once the list loads.
  useEffect(() => {
    if (!selectedExerciseId && exercises && exercises.length > 0) {
      setSelectedExerciseId(exercises[0]!.id);
    }
  }, [exercises, selectedExerciseId]);

  const selectedExercise = exercises?.find((e) => e.id === selectedExerciseId) ?? null;

  const { data: history } = useQuery({
    queryKey: ['exercise-history', selectedExerciseId],
    queryFn: () =>
      api.get<ExerciseHistoryResponse>(`/exercises/${selectedExerciseId}/history`),
    enabled: !!selectedExerciseId,
  });

  const startSessionMutation = useMutation({
    mutationFn: () =>
      api.post<WorkoutSession>('/workout-sessions', {
        localDate: todaysLocalDate(),
        timezone: localTimezone(),
      }),
    onSuccess: (session) => setSessionId(session.id),
  });

  const addExerciseLogMutation = useMutation({
    mutationFn: (params: { sessionId: string; exerciseId: string }) =>
      api.post<WorkoutExerciseLog>(`/workout-sessions/${params.sessionId}/exercises`, {
        exerciseId: params.exerciseId,
      }),
    onSuccess: (log) => setExerciseLogId(log.id),
  });

  const createSetMutation = useMutation({
    mutationFn: (params: { exerciseLogId: string; set: SetRow }) =>
      api.post<WorkoutSet>(`/workout-exercise-logs/${params.exerciseLogId}/sets`, {
        clientId: params.set.clientId,
        weightValue: params.set.weightValue ?? undefined,
        weightUnit: params.set.weightValue != null ? 'lb' : undefined,
        reps: params.set.reps ?? undefined,
      }),
  });

  const updateSetMutation = useMutation({
    mutationFn: (params: { setId: string; set: SetRow }) =>
      api.patch<WorkoutSet>(`/workout-sets/${params.setId}`, {
        weightValue: params.set.weightValue ?? undefined,
        weightUnit: params.set.weightValue != null ? 'lb' : undefined,
        reps: params.set.reps ?? undefined,
      }),
  });

  const completeSessionMutation = useMutation({
    mutationFn: (id: string) => api.post<WorkoutSession>(`/workout-sessions/${id}/complete`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today'] }),
  });

  // Ensure there's an in-progress session + exercise log to log sets
  // against as soon as an exercise is selected.
  useEffect(() => {
    if (!sessionId && !startSessionMutation.isPending) {
      startSessionMutation.mutate();
    }
  }, [sessionId, startSessionMutation]);

  useEffect(() => {
    if (sessionId && selectedExerciseId && !exerciseLogId && !addExerciseLogMutation.isPending) {
      addExerciseLogMutation.mutate({ sessionId, exerciseId: selectedExerciseId });
    }
  }, [sessionId, selectedExerciseId, exerciseLogId, addExerciseLogMutation]);

  const historySets: HistorySet[] = history?.items ?? [];

  function persistSet(set: SetRow) {
    if (!exerciseLogId) return;
    if (set.serverId) {
      updateSetMutation.mutate({ setId: set.serverId, set });
    } else {
      createSetMutation.mutate(
        { exerciseLogId, set },
        {
          onSuccess: (created) => {
            setSets((prev) =>
              prev.map((s) => (s.clientId === set.clientId ? { ...s, serverId: created.id } : s)),
            );
          },
        },
      );
    }
  }

  function updateSet(clientId: string, patch: Partial<SetRow>) {
    setSets((prev) => {
      const next = prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.clientId === clientId);
      if (updated) persistSet(updated);
      return next;
    });
  }

  function duplicateSet(clientId: string) {
    const source = sets.find((s) => s.clientId === clientId);
    if (!source) return;
    const duplicate: SetRow = {
      clientId: crypto.randomUUID(),
      serverId: null,
      weightValue: source.weightValue,
      reps: source.reps,
      completed: false,
    };
    setSets((prev) => [...prev, duplicate]);
  }

  function removeSet(clientId: string) {
    const set = sets.find((s) => s.clientId === clientId);
    setSets((prev) => prev.filter((s) => s.clientId !== clientId));
    if (set?.serverId) {
      api.del(`/workout-sets/${set.serverId}`).catch(() => {
        // Best-effort: local state already reflects the removal.
      });
    }
  }

  function addSet() {
    setSets((prev) => [
      ...prev,
      { clientId: crypto.randomUUID(), serverId: null, weightValue: null, reps: null, completed: false },
    ]);
  }

  return (
    <div>
      <h1>{selectedExercise?.name ?? 'Workout'}</h1>
      <Card>
        <ExerciseName>{selectedExercise?.name ?? 'Select an exercise'}</ExerciseName>
        <Prescription>Log sets below — they save automatically as you complete them.</Prescription>

        {sets.map((set, i) => {
          const candidate = { weightValue: set.weightValue, reps: set.reps };
          const isPr =
            set.completed &&
            (detectWeightPR(candidate, historySets) || detectRepPR(candidate, historySets));

          return (
            <Row key={set.clientId}>
              <Checkbox
                aria-label={`Mark set ${i + 1} complete`}
                checked={set.completed}
                onChange={(e) => updateSet(set.clientId, { completed: e.target.checked })}
              />
              <SetLabel>Set {i + 1}</SetLabel>
              <InputGroup>
                <NumericInput
                  type="number"
                  inputMode="decimal"
                  aria-label={`Set ${i + 1} weight`}
                  value={set.weightValue ?? ''}
                  onChange={(e) =>
                    updateSet(set.clientId, { weightValue: e.target.valueAsNumber || null })
                  }
                />
                {historySets[i] ? <GhostText>prev {historySets[i].weightValue ?? '—'}</GhostText> : null}
              </InputGroup>
              <InputGroup>
                <NumericInput
                  type="number"
                  inputMode="numeric"
                  aria-label={`Set ${i + 1} reps`}
                  value={set.reps ?? ''}
                  onChange={(e) => updateSet(set.clientId, { reps: e.target.valueAsNumber || null })}
                />
                {historySets[i] ? <GhostText>prev {historySets[i].reps ?? '—'}</GhostText> : null}
              </InputGroup>
              {isPr ? <PRBadge /> : <span />}
              <RowActions>
                <IconButton aria-label={`Duplicate set ${i + 1}`} onClick={() => duplicateSet(set.clientId)}>
                  <Copy size={16} />
                </IconButton>
                <IconButton aria-label={`Remove set ${i + 1}`} onClick={() => removeSet(set.clientId)}>
                  <Minus size={16} />
                </IconButton>
              </RowActions>
            </Row>
          );
        })}

        <AddExercise onClick={addSet}>
          <Plus size={16} style={{ marginRight: spacing[4] }} /> Add set
        </AddExercise>
      </Card>

      <Button
        variant="primary"
        style={{ marginTop: spacing[16] }}
        disabled={!sessionId || completeSessionMutation.isPending}
        onClick={() => sessionId && completeSessionMutation.mutate(sessionId)}
      >
        Finish Workout
      </Button>
    </div>
  );
}
