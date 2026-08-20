import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { GripVertical, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { spacing, radius } from '@setline/design-tokens';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import type {
  Prescription,
  ProgressionRuleType,
  TrainingProgram,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '@setline/schemas';
import { Card, Select, Badge, Button } from '../components';
import { useApiClient } from '../lib/api-client';

/**
 * ProgramEditor — prescription-type-aware editor + plain-language
 * progression rule description (style guide §10, §18 Idea 3). Web is
 * richer than mobile per §13/§14 (mobile defers editing to web).
 * Mobile-first: the day list stacks single-column (matching the mobile
 * drill-in view); from `desktop` up it becomes a 2-column grid so the
 * weekly sequence reads more like a calendar, per the "web can be
 * richer" direction.
 */
const progressionRuleCopy: Record<ProgressionRuleType, string> = {
  double_progression:
    'Increase reps each session until you hit the top of the rep range, then add weight and reset to the bottom.',
  linear:
    'Add weight every session when you complete all prescribed reps. Best for beginners on compound lifts.',
  manual: 'Weight and reps are adjusted manually each session — no automatic progression rule applied.',
};

const progressionOptions = [
  { value: 'double_progression', label: 'Double progression' },
  { value: 'linear', label: 'Linear (+5lb per session)' },
  { value: 'manual', label: 'Manual' },
];

const Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[12]}px;
  margin-bottom: ${spacing[24]}px;
`;

const DayList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[8]}px;
  margin-bottom: ${spacing[24]}px;

  ${mq.desktop} {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const DayRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[12]}px;
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
`;

const ExerciseRowEl = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[8]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;

const Description = styled.p`
  font-size: ${typeScale.helper.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
  margin: ${spacing[4]}px 0 0;
`;

function summarizePrescription(p: Prescription): string {
  switch (p.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      return `${p.sets} × ${p.repsMin}${p.repsMax ? `–${p.repsMax}` : ''}`;
    case 'top_set_backoff':
      return `${p.topSets} × ${p.topRepsMin}–${p.topRepsMax} top, ${p.backoffSets} × ${p.backoffRepsMin}–${p.backoffRepsMax} backoff`;
    case 'timed':
      return `${p.sets} × ${p.durationSeconds}s`;
    case 'distance':
      return `${p.sets} × ${p.distanceValue}${p.distanceUnit}`;
    default:
      return '';
  }
}

export function ProgramEditorPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [rule, setRule] = useState<ProgressionRuleType>('double_progression');
  const [programId, setProgramId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });

  const activeProgram = programs?.find((p) => p.isActive) ?? programs?.[0] ?? null;

  useEffect(() => {
    if (activeProgram && programId !== activeProgram.id) {
      setProgramId(activeProgram.id);
    }
  }, [activeProgram, programId]);

  const { data: templates } = useQuery({
    queryKey: ['program-workouts', programId],
    queryFn: () => api.get<WorkoutTemplate[]>(`/programs/${programId}/workouts`),
    enabled: !!programId,
  });

  useEffect(() => {
    if (templates && templates.length > 0 && !templateId) {
      setTemplateId(templates[0]!.id);
    }
  }, [templates, templateId]);

  const activeTemplate = templates?.find((t) => t.id === templateId) ?? null;

  const { data: templateExercises } = useQuery({
    queryKey: ['template-exercises', templateId],
    // TODO: apps/api has no GET /v1/workout-templates/:templateId/exercises
    // list endpoint — only POST to add one exists (see
    // apps/api/src/routes/workout-templates.ts). Until that's added we
    // can't list a template's exercises, so this renders an empty state.
    queryFn: (): Promise<WorkoutTemplateExercise[]> => Promise.resolve([]),
    enabled: !!templateId,
  });

  const createProgramMutation = useMutation({
    mutationFn: () => api.post<TrainingProgram>('/programs', { name: 'New Program' }),
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setProgramId(program.id);
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (params: { programId: string; dayLabel: string }) =>
      api.post<WorkoutTemplate>(`/programs/${params.programId}/workouts`, {
        name: params.dayLabel,
        dayLabel: params.dayLabel,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['program-workouts', programId] }),
  });

  if (programsLoading) {
    return <div>Loading program…</div>;
  }

  if (!activeProgram) {
    return (
      <div>
        <h1>No program yet</h1>
        <Button
          variant="primary"
          onClick={() => createProgramMutation.mutate()}
          disabled={createProgramMutation.isPending}
        >
          Create a program
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Header>
        <h1 style={{ margin: 0 }}>{activeProgram.name}</h1>
        <Badge tone={activeProgram.isActive ? 'success' : 'neutral'}>
          {activeProgram.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Header>

      <DayList>
        {(templates ?? []).map((template) => (
          <DayRow key={template.id} onClick={() => setTemplateId(template.id)} style={{ cursor: 'pointer' }}>
            <GripVertical size={16} aria-hidden="true" />
            {template.dayLabel ?? template.name}
          </DayRow>
        ))}
      </DayList>

      <Card>
        <h2 style={{ marginTop: 0 }}>{activeTemplate?.dayLabel ?? activeTemplate?.name ?? 'Select a day'}</h2>
        {(templateExercises ?? []).length === 0 ? (
          <p>No exercises added to this day yet.</p>
        ) : (
          templateExercises!.map((ex) => (
            <ExerciseRowEl key={ex.id}>
              <GripVertical size={16} aria-hidden="true" />
              <div style={{ flex: 1 }}>
                <strong>{ex.exerciseId}</strong>
                <div style={{ fontSize: 13 }}>{summarizePrescription(ex.prescription)}</div>
              </div>
            </ExerciseRowEl>
          ))
        )}

        <div style={{ marginTop: spacing[16] }}>
          <Select
            label="Progression rule"
            options={progressionOptions}
            value={rule}
            onChange={(e) => setRule(e.target.value as ProgressionRuleType)}
          />
          <Description>{progressionRuleCopy[rule]}</Description>
        </div>

        <button
          type="button"
          onClick={() =>
            programId &&
            createTemplateMutation.mutate({
              programId,
              dayLabel: `Day ${(templates?.length ?? 0) + 1}`,
            })
          }
          style={{
            marginTop: spacing[16],
            width: '100%',
            padding: spacing[12],
            border: '1px dashed currentColor',
            borderRadius: radius.small,
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} style={{ marginRight: spacing[4] }} /> Add day
        </button>
      </Card>
    </div>
  );
}
