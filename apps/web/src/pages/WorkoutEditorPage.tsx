import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import type { DayType, DayTypeExercise, Exercise, Prescription } from '@setframe/schemas';
import { describeExercise, type PickableExercise } from '@setframe/domain';
import { training, workoutEditor } from '@setframe/design-tokens';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription } from '../lib/prescription';
import { EditorCard, WorkoutExerciseRow } from '../components/training-v2/WorkoutExerciseRow';
import { PrescriptionSheet } from '../components/training-v2/PrescriptionSheet';
import { EditorRowsSkeleton } from '../components/training-v2/TrainingSkeletons';
import { ExercisePickerV2 } from '../components/exercise-picker/ExercisePickerV2';

/**
 * The workout editor — **pushed**, not appended.
 *
 * Figma: `Explore/Mobile/Training 3 · Build a workout` (147:708).
 *
 * The page this replaces appended the editor below the workout list, so on a
 * phone you scrolled past the list you had just used to reach the thing you
 * selected. Master/detail on a phone is a push.
 *
 * Everything here edits **intent**. ADR 0005 keeps intent and fact separate:
 * a logged session snapshots its prescription at start, so nothing on this
 * screen can change how a past workout renders — and the hint line says so
 * where someone might doubt it, rather than in a doc they will not read.
 */

const SHELL_PADDING = 16;

const Screen = styled.div`
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  margin-inline: -${SHELL_PADDING}px;
  display: flex;
  flex-direction: column;
  gap: ${workoutEditor.header.gap}px;
  padding: ${workoutEditor.header.paddingTop}px ${workoutEditor.header.paddingX}px
    ${workoutEditor.header.paddingBottom}px 12px;
  background: ${({ theme }) => theme.surface.raised};
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

const Back = styled.button`
  width: 24px;
  border: none;
  background: none;
  padding: 0;
  font-size: ${workoutEditor.header.backSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.secondary};
  cursor: pointer;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${workoutEditor.header.titleSize}px;
  font-weight: 600;
  color: ${({ theme }) => theme.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.p`
  margin: 0;
  padding-left: 12px;
  font-size: ${workoutEditor.header.metaSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${training.cardGap}px;
  padding: ${SHELL_PADDING}px 0;
`;

const AddButton = styled.button`
  width: ${training.cardWidth}px;
  max-width: 100%;
  height: ${workoutEditor.addButton.height}px;
  border: none;
  border-radius: ${workoutEditor.addButton.radius}px;
  background: ${({ theme }) => theme.surface.sunken};
  color: ${({ theme }) => theme.action.primary};
  font-size: ${workoutEditor.addButton.labelSize}px;
  font-weight: 600;
  cursor: pointer;
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${workoutEditor.hintSize}px;
  color: ${({ theme }) => theme.text.secondary};
`;

const Empty = styled.p`
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: ${({ theme }) => theme.text.secondary};
`;

const PickerOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: ${({ theme }) => theme.surface.canvas};
`;

interface EditorExercise extends DayTypeExercise {
  exercise?: Exercise;
}

/**
 * What an exercise added through the picker is prescribed.
 *
 * `POST /day-types/:id/exercises` REQUIRES a prescription — posting
 * `{ exerciseId }` alone fails with
 * "body/prescription Invalid input: expected object, received undefined".
 * The single-select picker this replaced had a configure step that supplied
 * one; the multi-select picker deliberately does not ask, so it has to send
 * the default instead of nothing.
 *
 * Blank targets are legitimate (story 19), so this carries a set count and no
 * reps — enough for the session to instantiate a row to log into, without
 * inventing a rep target the user never chose.
 */
const DEFAULT_PICKED_PRESCRIPTION = { kind: 'sets_reps' as const, sets: 1 };

export default function WorkoutEditorPage() {
  const { dayTypeId } = useParams<{ dayTypeId: string }>();
  const api = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['day-type', dayTypeId] });

  const { data: dayType, isPending: dayTypePending } = useQuery({
    queryKey: ['day-type', dayTypeId],
    queryFn: () => api.get<DayType & { exercises?: EditorExercise[] }>(`/day-types/${dayTypeId}`),
    enabled: !!dayTypeId,
  });

  const { data: catalogue = [], isPending: cataloguePending } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<PickableExercise[]>('/exercises'),
  });

  const exercises = useMemo(() => dayType?.exercises ?? [], [dayType]);
  const byId = useMemo(() => new Map(catalogue.map((item) => [item.id, item])), [catalogue]);

  const addExercises = useMutation({
    mutationFn: async (exerciseIds: string[]) => {
      /* Sequential: sortOrder is assigned from insertion order, and the
         picker promises they are added in the order picked. */
      for (const exerciseId of exerciseIds) {
        await api.post(`/day-types/${dayTypeId}/exercises`, {
          exerciseId,
          prescription: DEFAULT_PICKED_PRESCRIPTION,
        });
      }
    },
    onSuccess: async () => {
      setPickerOpen(false);
      await invalidate();
    },
  });

  const savePrescription = useMutation({
    mutationFn: ({ id, prescription }: { id: string; prescription: Prescription }) =>
      api.patch(`/day-types/${dayTypeId}/exercises/${id}`, { prescription }),
    onSuccess: invalidate,
  });

  const removeExercise = useMutation({
    mutationFn: (id: string) => api.del(`/day-types/${dayTypeId}/exercises/${id}`),
    onSuccess: async () => {
      setSheetFor(null);
      await invalidate();
    },
  });

  const active = exercises.find((item) => item.id === sheetFor) ?? null;
  const activeExercise = active ? byId.get(active.exerciseId) : undefined;

  return (
    <Screen data-testid="workout-editor">
      <Header>
        <HeaderRow>
          <TitleGroup>
            <Back type="button" onClick={() => navigate('/training')} aria-label="Back to Training">
              ‹
            </Back>
            <Title>{dayType?.name ?? 'Workout'}</Title>
          </TitleGroup>
        </HeaderRow>
        <Meta>{formatEditorMeta(exercises.length, dayType?.estimatedDurationMinutes ?? null)}</Meta>
      </Header>

      <Body>
        <EditorCard data-testid="editor-list">
          {/* An empty state is a claim about the data. Rendering it while the
              query is still in flight told a user opening a workout for the
              first time that it had no exercises — which reads as data loss,
              not as loading. */}
          {dayTypePending ? (
            <EditorRowsSkeleton />
          ) : exercises.length === 0 ? (
            <Empty>Nothing in here yet. Add the first exercise to start building it.</Empty>
          ) : (
            exercises.map((item, index) => {
              const exercise = byId.get(item.exerciseId);
              return (
                <WorkoutExerciseRow
                  key={item.id}
                  exerciseId={item.id}
                  name={item.exercise?.name ?? exercise?.name ?? 'Exercise'}
                  meta={exercise ? describeExercise(exercise) : ''}
                  planLabel={planLabelOf(item.prescription)}
                  divided={index > 0}
                  onOpenActions={() => setSheetFor(item.id)}
                />
              );
            })
          )}
        </EditorCard>

        <AddButton type="button" onClick={() => setPickerOpen(true)} data-testid="editor-add">
          + Add exercise
        </AddButton>

        {/* ADR 0005's separation stated where someone might doubt it. */}
        <Hint>
          Editing this workout changes the plan, not any workout you have already logged.
        </Hint>
      </Body>

      {pickerOpen ? (
        <PickerOverlay role="dialog" aria-modal="true" aria-label="Add exercises">
          <ExercisePickerV2
            exercises={catalogue}
            title={`Add to ${dayType?.name ?? 'workout'}`}
            onCancel={() => setPickerOpen(false)}
            onAdd={(ids) => addExercises.mutate(ids)}
            busy={addExercises.isPending}
            loading={cataloguePending}
          />
        </PickerOverlay>
      ) : null}

      {active ? (
        <PrescriptionSheet
          exerciseName={active.exercise?.name ?? activeExercise?.name ?? 'Exercise'}
          workoutName={dayType?.name ?? 'this workout'}
          prescription={active.prescription ?? null}
          onClose={() => setSheetFor(null)}
          onSave={(prescription) => savePrescription.mutate({ id: active.id, prescription })}
          onReplace={() => {
            /* Replace keeps the prescription — it swaps which exercise the
               slot points at. Not built yet; opening the picker here would
               add rather than replace, which is the wrong operation. */
            setSheetFor(null);
          }}
          onRemove={() => removeExercise.mutate(active.id)}
        />
      ) : null}
    </Screen>
  );
}

function planLabelOf(prescription: Prescription | null | undefined): string | null {
  if (!prescription) return null;
  const summary = summarizePrescription(prescription);
  /* summarizePrescription renders "Planned: —" when nothing is set. A pill
     saying that is worse than no pill — blank targets are legitimate. */
  const stripped = summary.replace(/^Planned:\s*/, '').trim();
  return stripped && stripped !== '—' ? stripped : null;
}

function formatEditorMeta(count: number, minutes: number | null): string {
  const segments = [count === 1 ? '1 exercise' : `${count} exercises`];
  if (minutes) segments.push(`~${minutes} min`);
  return segments.join(' · ');
}
