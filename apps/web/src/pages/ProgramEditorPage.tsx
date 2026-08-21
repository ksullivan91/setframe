import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { spacing, radius } from '@setline/design-tokens';
import type {
  CreatePlannedSetInput,
  DayType,
  DayTypeExercise,
  DayTypeExercisePlannedSet,
  Exercise,
  Prescription,
  ProgramScheduleSlot,
  TrainingProgram,
} from '@setline/schemas';
import { Button, Card, IconButton, Input, Menu, Modal as SharedModal, Select, Tabs, useToast } from '../components';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

interface EditState {
  dayTypeId: string;
  exerciseId: string;
  exerciseName: string;
  prescription: Prescription;
  notes: string;
}

const Layout = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
  grid-template-columns: 1fr;

  ${mq.desktop} {
    grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.3fr);
    align-items: start;
  }
`;

const ScheduleLayout = styled.div`
  display: grid;
  gap: ${spacing[24]}px;
  grid-template-columns: 1fr;

  ${mq.desktop} {
    max-width: 720px;
  }
`;

const EmptyDetail = styled(Card)<{ $hideOnMobile?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${spacing[12]}px;
  /* Match LibraryCard/StackCard's top padding (spacing[16], via Card's
     default) so the "Workouts" and "Choose a workout to edit" headings
     align on the same baseline (user-experience-iteration-two.md #7). */
  padding: ${spacing[16]}px ${spacing[24]}px;

  /* Per user-experience-iteration-two.md #19-20: with zero workouts,
     stacking this card underneath the (already actionable) creation
     state adds scrolling with no value on mobile. Desktop keeps it —
     it reinforces the master/detail model there. */
  ${(p) => (p.$hideOnMobile ? 'display: none;' : '')}

  ${mq.desktop} {
    display: flex;
  }
`;

const CreateWorkoutForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const CreateWorkoutActions = styled.div`
  display: flex;

  button {
    width: 100%;
  }

  ${mq.tablet} {
    button {
      width: auto;
    }
  }
`;

const InlineError = styled.p`
  margin: 0;
  color: ${(p) => p.theme.action.destructive};
  font-size: ${typeScale.caption.fontSize}px;
`;

const OnboardingBanner = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
  align-items: flex-start;
  /* Neutral surface with a subtle purple accent border — should read as
     a helpful nudge, not compete with the (more urgent/saturated)
     ActiveWorkoutBanner used elsewhere. Per
     user-experience-iteration.md #8. */
  border: 1px solid ${(p) => p.theme.action.primary}33;
  background: ${(p) => p.theme.surface.raised};
`;

const OnboardingEyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[8]}px;
  font-size: ${typeScale.caption.fontSize}px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${(p) => p.theme.action.primary};
`;

const SectionTitle = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const LibraryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const StackCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const LibraryItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
`;

const Small = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const Row = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: center;
  flex-wrap: wrap;
`;

const ExerciseRow = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: flex-start;
  padding: ${spacing[12]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;

const PrescriptionGrid = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => p.theme.border.default};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  resize: vertical;
`;

const DisclosureButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  background: none;
  border: none;
  padding: ${spacing[8]}px 0;
  color: ${(p) => p.theme.text.primary};
  font-weight: 600;
  font-size: ${typeScale.compactBody.fontSize}px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;

const PlannedSetRow = styled.div`
  display: grid;
  grid-template-columns: minmax(90px, 0.7fr) repeat(3, minmax(64px, 1fr)) auto auto auto;
  gap: ${spacing[8]}px;
  align-items: end;
  padding: ${spacing[8]}px 0;
  border-top: 1px solid ${(p) => p.theme.border.subtle};

  ${mq.tablet} {
    grid-template-columns: 1fr;
  }
`;

const DayGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: ${spacing[8]}px;

  ${mq.tablet} {
    gap: ${spacing[4]}px;
  }
`;

const DayCell = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  padding: ${spacing[8]}px ${spacing[4]}px;
  border-radius: ${radius.small}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.sunken)};
  cursor: pointer;
  min-height: 64px;
  text-align: left;
  font-size: ${typeScale.caption.fontSize}px;
`;

const DayName = styled.span`
  font-weight: 600;
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const DayLabel = styled.span`
  color: ${(p) => p.theme.text.secondary};
  overflow-wrap: break-word;
  line-height: 1.2;
`;

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const modeOptions = [
  { value: 'perpetual', label: 'Repeats weekly' },
  { value: 'block', label: 'Block' },
];
const prescriptionOptions = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];

const plannedSetTypeOptions = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'working', label: 'Working' },
  { value: 'top', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'drop', label: 'Drop set' },
  { value: 'failure', label: 'To failure' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'timed', label: 'Timed' },
  { value: 'distance', label: 'Distance' },
];

function newDraftPlannedSet(): CreatePlannedSetInput {
  return { setType: 'working', reps: 8 };
}

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

function summarizePrescription(p: Prescription) {
  switch (p.kind) {
    case 'sets_reps':
    case 'per_side':
    case 'bodyweight_reps':
      return `${p.sets} × ${p.repsMin}${p.repsMax ? `–${p.repsMax}` : ''}`;
    case 'top_set_backoff':
      return 'Top + backoff';
    case 'timed':
      return `${p.sets} × ${p.durationSeconds}s`;
    case 'distance':
      return `${p.sets} × ${p.distanceValue}${p.distanceUnit}`;
    case 'duration':
      return `${p.durationMinutes} min`;
    case 'distanceDuration':
      return `${p.distanceMiles} mi / ${p.durationMinutes} min`;
  }
}

function emptyPrescription(kind: string): Prescription {
  switch (kind) {
    case 'timed':
      return { kind: 'timed', sets: 3, durationSeconds: 60 };
    case 'duration':
      return { kind: 'duration', durationMinutes: 30 };
    case 'distanceDuration':
      return { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 };
    case 'distance':
      return { kind: 'distance', sets: 1, distanceValue: 5, distanceUnit: 'mi' };
    case 'bodyweight_reps':
      return { kind: 'bodyweight_reps', sets: 3, repsMin: 8 };
    default:
      return { kind: 'sets_reps', sets: 3, repsMin: 8 };
  }
}

function moveItem(items: string[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (!item) return items;
  next.splice(to, 0, item);
  return next;
}

/**
 * Progressive-disclosure editor for individually-different planned sets
 * (user-experience-redesign.md §9, e.g. a top set followed by lighter
 * backoff sets). Collapsed by default so the common "N sets × reps"
 * case above stays the primary, uncluttered path.
 */
function PlannedSetsEditor({ dayTypeId, exerciseId }: { dayTypeId: string; exerciseId: string }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const queryKey = ['planned-sets', dayTypeId, exerciseId];
  const { data: plannedSets = [] } = useQuery({
    queryKey,
    queryFn: () => api.get<DayTypeExercisePlannedSet[]>(`/day-types/${dayTypeId}/exercises/${exerciseId}/planned-sets`),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const onError = () => toast.show({ variant: 'error', message: 'Something went wrong. Please try again.' });

  const addSet = useMutation({
    mutationFn: (body: CreatePlannedSetInput) => api.post(`/day-types/${dayTypeId}/exercises/${exerciseId}/planned-sets`, body),
    onSuccess: invalidate,
    onError,
  });

  const patchSet = useMutation({
    mutationFn: (args: { id: string; body: Partial<CreatePlannedSetInput> }) =>
      api.patch(`/day-types/${dayTypeId}/exercises/${exerciseId}/planned-sets/${args.id}`, args.body),
    onSuccess: invalidate,
    onError,
  });

  const removeSet = useMutation({
    mutationFn: (id: string) => api.del<void>(`/day-types/${dayTypeId}/exercises/${exerciseId}/planned-sets/${id}`),
    onSuccess: () => {
      invalidate();
      toast.show({ variant: 'success', message: 'Set removed.' });
    },
    onError,
  });

  return (
    <div>
      <DisclosureButton type="button" aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        Customize individual sets
      </DisclosureButton>
      {open ? (
        <div>
          <Small>
            Optional — specify each set individually (e.g. a heavier top set followed by lighter backoffs). Leave
            empty to use the summary prescription above for every set.
          </Small>
          {plannedSets.map((set, index) => (
            <PlannedSetRow key={set.id}>
              <Select
                label={`Set ${index + 1} type`}
                value={set.setType}
                options={plannedSetTypeOptions}
                onChange={(e) => patchSet.mutate({ id: set.id, body: { setType: e.target.value as CreatePlannedSetInput['setType'] } })}
              />
              <Input
                label="Reps"
                inputMode="numeric"
                value={set.reps ?? ''}
                onChange={(e) => patchSet.mutate({ id: set.id, body: { reps: parseOptionalNumber(e.target.value) } })}
              />
              <Input
                label="Load"
                inputMode="decimal"
                value={set.loadValue ?? ''}
                onChange={(e) => patchSet.mutate({ id: set.id, body: { loadValue: parseOptionalNumber(e.target.value), loadUnit: set.loadUnit ?? 'lb' } })}
              />
              <Input
                label="RPE"
                inputMode="decimal"
                value={set.rpe ?? ''}
                onChange={(e) => patchSet.mutate({ id: set.id, body: { rpe: parseOptionalNumber(e.target.value) } })}
              />
              <IconButton aria-label={`Move set ${index + 1} up`} disabled={index === 0} onClick={() => moveSet(plannedSets, index, -1)}>
                <ChevronUp size={16} />
              </IconButton>
              <IconButton aria-label={`Move set ${index + 1} down`} disabled={index === plannedSets.length - 1} onClick={() => moveSet(plannedSets, index, 1)}>
                <ChevronDown size={16} />
              </IconButton>
              <IconButton aria-label={`Remove set ${index + 1}`} onClick={() => removeSet.mutate(set.id)}>
                <Trash2 size={16} />
              </IconButton>
            </PlannedSetRow>
          ))}
          <Button variant="secondary" onClick={() => addSet.mutate(newDraftPlannedSet())} disabled={addSet.isPending}>
            <Plus size={16} />Add set
          </Button>
        </div>
      ) : null}
    </div>
  );

  function moveSet(sets: DayTypeExercisePlannedSet[], index: number, delta: number) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sets.length) return;
    const plannedSetIdsInOrder = moveItem(sets.map((s) => s.id), index, nextIndex);
    api
      .post(`/day-types/${dayTypeId}/exercises/${exerciseId}/planned-sets/reorder`, { plannedSetIdsInOrder })
      .then(invalidate)
      .catch(onError);
  }
}

/**
 * Add-exercise flow (user-experience-iteration.md #13-16). Replaces the
 * old always-visible Exercise/Prescription-type/Create-exercise/Add
 * cluster with progressive disclosure: search-and-pick an existing
 * exercise first; custom creation and prescription configuration are
 * separate steps reached only when needed.
 */
function AddExercisePicker({
  exercises,
  onClose,
  onCreateExercise,
  isCreatingExercise,
  onAddExercise,
  isAddingExercise,
}: {
  exercises: Exercise[];
  onClose: () => void;
  onCreateExercise: (name: string) => Promise<Exercise>;
  isCreatingExercise: boolean;
  onAddExercise: (exerciseId: string, prescription: Prescription) => void;
  isAddingExercise: boolean;
}) {
  const [step, setStep] = useState<'search' | 'create' | 'configure'>('search');
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');
  const [prescription, setPrescription] = useState<Prescription>(emptyPrescription('sets_reps'));

  const filtered = useMemo(
    () => exercises.filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase())),
    [exercises, query],
  );

  const chooseExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setPrescriptionKind('sets_reps');
    setPrescription(emptyPrescription('sets_reps'));
    setStep('configure');
  };

  const handlePrescriptionKindChange = (kind: string) => {
    setPrescriptionKind(kind);
    setPrescription(emptyPrescription(kind));
  };

  if (step === 'create') {
    return (
      <SharedModal open onClose={onClose} title="Create custom exercise" maxWidth={420}>
        <Column>
          <Input
            label="Exercise name"
            placeholder="e.g. Outdoor Cycle"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setStep('search')}>Cancel</Button>
            <Button
              disabled={!customName.trim() || isCreatingExercise}
              onClick={async () => {
                const created = await onCreateExercise(customName.trim());
                setCustomName('');
                chooseExercise(created);
              }}
            >
              Create &amp; add
            </Button>
          </Row>
        </Column>
      </SharedModal>
    );
  }

  if (step === 'configure' && selectedExercise) {
    return (
      <SharedModal open onClose={onClose} title={selectedExercise.name} maxWidth={480}>
        <Column>
          <Select label="Prescription" value={prescriptionKind} onChange={(e) => handlePrescriptionKindChange(e.target.value)} options={prescriptionOptions} />

          {(prescription.kind === 'sets_reps' || prescription.kind === 'per_side' || prescription.kind === 'bodyweight_reps') && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Reps"
                inputMode="numeric"
                value={String(prescription.repsMin)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, repsMin: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'timed' && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Seconds"
                inputMode="numeric"
                value={String(prescription.durationSeconds)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, durationSeconds: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'duration' && (
            <Input
              label="Minutes"
              inputMode="numeric"
              value={String(prescription.durationMinutes)}
              onChange={(e) => setPrescription((prev) => ({ ...prev, durationMinutes: Number(e.target.value) || 0 } as Prescription))}
            />
          )}

          {prescription.kind === 'distanceDuration' && (
            <PrescriptionGrid>
              <Input
                label="Distance (mi)"
                inputMode="decimal"
                value={String(prescription.distanceMiles)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, distanceMiles: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Minutes"
                inputMode="numeric"
                value={String(prescription.durationMinutes)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, durationMinutes: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          {prescription.kind === 'distance' && (
            <PrescriptionGrid>
              <Input
                label="Sets"
                inputMode="numeric"
                value={String(prescription.sets)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, sets: Number(e.target.value) || 0 } as Prescription))}
              />
              <Input
                label="Distance"
                inputMode="decimal"
                value={String(prescription.distanceValue)}
                onChange={(e) => setPrescription((prev) => ({ ...prev, distanceValue: Number(e.target.value) || 0 } as Prescription))}
              />
            </PrescriptionGrid>
          )}

          <Row style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setStep('search')}>Back</Button>
            <Button
              disabled={isAddingExercise}
              onClick={() => {
                onAddExercise(selectedExercise.id, prescription);
                onClose();
              }}
            >
              Add to workout
            </Button>
          </Row>
        </Column>
      </SharedModal>
    );
  }

  return (
    <SharedModal open onClose={onClose} title="Add exercise" maxWidth={480}>
      <Column>
        <Input label="Search exercises" placeholder="Barbell Back Squat…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <Column style={{ maxHeight: 320, overflowY: 'auto', gap: spacing[4] }}>
          {filtered.length === 0 ? (
            <Small>No exercises match &ldquo;{query}&rdquo;.</Small>
          ) : (
            filtered.map((exercise) => (
              <LibraryItem key={exercise.id} $active={false} onClick={() => chooseExercise(exercise)}>
                <strong>{exercise.isCustom ? `${exercise.name} (custom)` : exercise.name}</strong>
              </LibraryItem>
            ))
          )}
        </Column>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>Can&apos;t find it?</Small>
          <Button variant="tertiary" onClick={() => setStep('create')}>
            <Plus size={16} />Create custom exercise
          </Button>
        </Row>
      </Column>
    </SharedModal>
  );
}

/**
 * Single canonical workout-creation control (user-experience-iteration-two.md
 * #1-6, #22-23) — used by the Workout library only; the editor's empty
 * state no longer renders its own copy of this form.
 */
function WorkoutCreateForm({
  onCreate,
  isPending,
  existingNames,
  onCancel,
  autoFocus,
}: {
  onCreate: (name: string) => Promise<unknown>;
  isPending: boolean;
  existingNames: string[];
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const handleSubmit = async () => {
    if (!trimmed) return;
    if (existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A workout named "${trimmed}" already exists.`);
      return;
    }
    setError(null);
    try {
      await onCreate(trimmed);
      setName('');
    } catch {
      // Preserve the typed name on failure (doc #22) so the user doesn't retype it.
      setError("Couldn't create this workout. Try again.");
    }
  };

  return (
    <CreateWorkoutForm>
      <Input
        label="Workout name"
        placeholder="e.g. Lower C"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit();
          if (e.key === 'Escape') onCancel?.();
        }}
        autoFocus={autoFocus}
      />
      {error ? (
        <InlineError role="alert">{error}</InlineError>
      ) : (
        <Small>Enter a workout name to create it.</Small>
      )}
      <CreateWorkoutActions>
        <Button onClick={() => void handleSubmit()} disabled={!trimmed || isPending}>
          {isPending ? 'Creating…' : 'Create workout'}
        </Button>
        {onCancel ? (
          <Button variant="tertiary" onClick={onCancel} type="button">
            Cancel
          </Button>
        ) : null}
      </CreateWorkoutActions>
    </CreateWorkoutForm>
  );
}

function ExerciseEditModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: EditState;
  onClose: () => void;
  onSave: (next: EditState) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<EditState>(state);

  useEffect(() => setDraft(state), [state]);

  return (
    <SharedModal open onClose={onClose} title="Edit exercise" description={draft.exerciseName} maxWidth={560}>
      <Select label="Prescription type" value={draft.prescription.kind} options={prescriptionOptions} disabled onChange={() => undefined} />

        {(draft.prescription.kind === 'sets_reps' ||
          draft.prescription.kind === 'per_side' ||
          draft.prescription.kind === 'bodyweight_reps') && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Reps"
              value={String(draft.prescription.repsMin)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, repsMin: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input label="Weight" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Optional weight cue" />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'duration' && (
          <Input
            label="Minutes"
            value={String(draft.prescription.durationMinutes)}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                prescription: { ...prev.prescription, durationMinutes: Number(e.target.value) || 0 } as Prescription,
              }))
            }
            inputMode="numeric"
          />
        )}

        {draft.prescription.kind === 'distanceDuration' && (
          <PrescriptionGrid>
            <Input
              label="Distance"
              value={String(draft.prescription.distanceMiles)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceMiles: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="decimal"
            />
            <Input
              label="Duration"
              value={String(draft.prescription.durationMinutes)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationMinutes: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'timed' && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Seconds"
              value={String(draft.prescription.durationSeconds)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, durationSeconds: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
          </PrescriptionGrid>
        )}

        {draft.prescription.kind === 'distance' && (
          <PrescriptionGrid>
            <Input
              label="Sets"
              value={String(draft.prescription.sets)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, sets: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="numeric"
            />
            <Input
              label="Distance"
              value={String(draft.prescription.distanceValue)}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prescription: { ...prev.prescription, distanceValue: Number(e.target.value) || 0 } as Prescription,
                }))
              }
              inputMode="decimal"
            />
          </PrescriptionGrid>
        )}

        <TextArea value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Notes" />

        <PlannedSetsEditor dayTypeId={state.dayTypeId} exerciseId={state.exerciseId} />

        <Row style={{ justifyContent: 'space-between' }}>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
          <Row>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)}>Save</Button>
          </Row>
        </Row>
    </SharedModal>
  );
}

export function ProgramEditorPage() {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [mode, setMode] = useState<'perpetual' | 'block'>('perpetual');
  const [editState, setEditState] = useState<EditState | null>(null);
  const [activeTab, setActiveTab] = useState<'workouts' | 'schedule'>('workouts');
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: () => api.get<TrainingProgram[]>('/programs') });
  const { data: dayTypes = [] } = useQuery({ queryKey: ['day-types'], queryFn: () => api.get<DayType[]>('/day-types') });
  const { data: exercises = [] } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') });

  const activeProgram = useMemo(() => programs?.find((p) => p.isActive) ?? programs?.[0] ?? null, [programs]);

  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setSelectedProgramId(created.id);
    },
  });

  const createProgramTriggered = useRef(false);

  useEffect(() => {
    if (activeProgram && selectedProgramId !== activeProgram.id) {
      setSelectedProgramId(activeProgram.id);
      setMode(activeProgram.cycleLengthWeeks ? 'block' : 'perpetual');
    } else if (programs && programs.length === 0 && !createProgramTriggered.current) {
      createProgramTriggered.current = true;
    }
  }, [activeProgram, selectedProgramId, programs, createProgram]);

  useEffect(() => {
    if (dayTypes.length && !selectedDayTypeId) setSelectedDayTypeId(dayTypes[0]!.id);
  }, [dayTypes, selectedDayTypeId]);

  const { data: selectedDayType } = useQuery({
    queryKey: ['day-type', selectedDayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedDayTypeId}`),
    enabled: !!selectedDayTypeId,
  });

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['schedule-slots', selectedProgramId],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${selectedProgramId}/schedule-slots`),
    enabled: !!selectedProgramId,
  });

  const invalidateTraining = () => {
    queryClient.invalidateQueries({ queryKey: ['day-types'] });
    queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgramId] });
  };

  const createDayType = useMutation({
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', body),
    onSuccess: (row) => {
      invalidateTraining();
      setSelectedDayTypeId(row.id);
      setShowCreateForm(false);
    },
  });

  const deleteDayType = useMutation({
    mutationFn: (id: string) => api.del<void>(`/day-types/${id}`),
    onSuccess: () => {
      invalidateTraining();
      setSelectedDayTypeId(null);
    },
  });

  const addExercise = useMutation({
    mutationFn: (body: { exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${selectedDayTypeId}/exercises`, body),
    onSuccess: () => invalidateTraining(),
  });

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
  });

  const patchExercise = useMutation({
    mutationFn: (args: { exerciseId: string; body: { prescription?: Prescription; notes?: string | null } }) =>
      api.patch(`/day-types/${selectedDayTypeId}/exercises/${args.exerciseId}`, args.body),
    onSuccess: () => {
      invalidateTraining();
      setEditState(null);
      toast.show({ variant: 'success', message: 'Exercise updated.' });
    },
  });

  const removeExercise = useMutation({
    mutationFn: (id: string) => api.del<void>(`/day-types/${selectedDayTypeId}/exercises/${id}`),
    onSuccess: () => {
      invalidateTraining();
      setEditState(null);
      toast.show({ variant: 'success', message: 'Exercise removed.' });
    },
  });

  const reorderExercises = useMutation({
    mutationFn: (exerciseIdsInOrder: string[]) =>
      api.post(`/day-types/${selectedDayTypeId}/exercises/reorder`, { exerciseIdsInOrder }),
    onSuccess: () => invalidateTraining(),
  });

  const patchProgram = useMutation({
    mutationFn: (body: Partial<TrainingProgram>) => api.patch(`/programs/${selectedProgramId}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['programs'] }),
  });

  const upsertSlot = useMutation({
    mutationFn: (body: { id?: string; dayTypeId: string; weekNumber: number | null; dayIndex: number; sortOrder: number }) =>
      body.id
        ? api.patch(`/programs/${selectedProgramId}/schedule-slots/${body.id}`, body)
        : api.post(`/programs/${selectedProgramId}/schedule-slots`, body),
    onSuccess: () => invalidateTraining(),
  });

  const removeSlot = useMutation({
    mutationFn: (id: string) => api.del<void>(`/programs/${selectedProgramId}/schedule-slots/${id}`),
    onSuccess: () => invalidateTraining(),
  });

  const slotsByDay = useMemo(() => {
    const map = new Map<number, ProgramScheduleSlot>();
    scheduleSlots
      .filter((slot) => (mode === 'block' ? slot.weekNumber === 1 : slot.weekNumber === null))
      .forEach((slot) => map.set(slot.dayIndex, slot));
    return map;
  }, [scheduleSlots, mode]);

  const sortedExercises = useMemo(
    () => [...(selectedDayType?.exercises ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedDayType?.exercises],
  );

  const reorderByDelta = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sortedExercises.length) return;
    reorderExercises.mutate(moveItem(sortedExercises.map((item) => item.id), index, nextIndex));
  };

  return (
    <Column>
      <Row style={{ justifyContent: 'space-between' }}>
        <div>
          <SectionTitle>Training</SectionTitle>
          <Small>Manage the workouts and schedule in your program.</Small>
        </div>
        {/* Guided setup already has strong entry points (the onboarding
            banner below for new users); showing this header button too
            would duplicate the same CTA per user-experience-iteration.md
            #7. Only show it here once the user is already configured, as
            a lower-emphasis "create another program" affordance. */}
        {programs && programs.length > 0 ? (
          <a href="/training/new" style={{ textDecoration: 'none' }}><Button variant="secondary">Guided setup</Button></a>
        ) : null}
      </Row>

      {programs && programs.length === 0 ? (
        <OnboardingBanner>
          <OnboardingEyebrow>
            <Sparkles size={14} aria-hidden="true" />
            New to Setline?
          </OnboardingEyebrow>
          <h2 style={{ margin: 0 }}>Build your training program</h2>
          <Small>Create your workouts and weekly schedule in a few guided steps.</Small>
          <a href="/training/new" style={{ textDecoration: 'none' }}>
            <Button>
              Start guided setup <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </a>
        </OnboardingBanner>
      ) : null}

      <Tabs
        label="Training views"
        items={[
          { key: 'workouts', label: 'Workouts' },
          { key: 'schedule', label: 'Schedule' },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'workouts' | 'schedule')}
      />

      <div role="tabpanel" id="tabpanel-workouts" aria-labelledby="tab-workouts" hidden={activeTab !== 'workouts'}>
        <Layout>
          <Column>
            <LibraryCard>
              <strong>Workouts</strong>
              {dayTypes.length === 0 ? (
                <>
                  <Small>No workouts yet. Create reusable workouts like Lower C, Upper A, or Recovery.</Small>
                  <WorkoutCreateForm
                    onCreate={(name) => createDayType.mutateAsync({ name })}
                    isPending={createDayType.isPending}
                    existingNames={dayTypes.map((d) => d.name)}
                    autoFocus
                  />
                </>
              ) : (
                <>
                  {dayTypes.map((dayType) => (
                    <LibraryItem key={dayType.id} $active={selectedDayTypeId === dayType.id} onClick={() => setSelectedDayTypeId(dayType.id)}>
                      <strong>{dayType.name}</strong>
                      <Small>{dayType.estimatedDurationMinutes ? `~${dayType.estimatedDurationMinutes} min` : 'No duration yet'}</Small>
                    </LibraryItem>
                  ))}
                  {showCreateForm ? (
                    <WorkoutCreateForm
                      onCreate={(name) => createDayType.mutateAsync({ name })}
                      isPending={createDayType.isPending}
                      existingNames={dayTypes.map((d) => d.name)}
                      onCancel={() => setShowCreateForm(false)}
                      autoFocus
                    />
                  ) : (
                    <Button variant="secondary" onClick={() => setShowCreateForm(true)}>
                      <Plus size={16} />New workout
                    </Button>
                  )}
                </>
              )}
            </LibraryCard>
          </Column>

          {selectedDayType ? (
            <Column>
              <StackCard>
                <Row style={{ justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0' }}>{selectedDayType.name}</h2>
                    <Small>
                      {sortedExercises.length} exercise{sortedExercises.length === 1 ? '' : 's'}
                      {selectedDayType.estimatedDurationMinutes ? ` · approximately ${selectedDayType.estimatedDurationMinutes} min` : ''}
                    </Small>
                  </div>
                  <Button variant="destructive" onClick={() => deleteDayType.mutate(selectedDayType.id)}>Delete</Button>
                </Row>

                {sortedExercises.length === 0 ? (
                  <Small>No exercises yet.</Small>
                ) : (
                  sortedExercises.map((exercise, index) => (
                    <ExerciseRow key={exercise.id}>
                      <div style={{ flex: 1 }}>
                        <strong>{exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId}</strong>
                        <Small>
                          {summarizePrescription(exercise.prescription)}
                          {exercise.notes ? ` · ${exercise.notes}` : ''}
                        </Small>
                      </div>
                      <IconButton aria-label="Move exercise up" disabled={index === 0} onClick={() => reorderByDelta(index, -1)}><ChevronUp size={16} /></IconButton>
                      <IconButton aria-label="Move exercise down" disabled={index === sortedExercises.length - 1} onClick={() => reorderByDelta(index, 1)}><ChevronDown size={16} /></IconButton>
                      <Menu
                        label={`Actions for ${exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId}`}
                        items={[
                          {
                            label: 'Edit',
                            onClick: () =>
                              setEditState({
                                dayTypeId: exercise.dayTypeId,
                                exerciseId: exercise.id,
                                exerciseName: exercises.find((item) => item.id === exercise.exerciseId)?.name ?? exercise.exerciseId,
                                prescription: exercise.prescription,
                                notes: exercise.notes ?? '',
                              }),
                          },
                          { label: 'Delete', destructive: true, onClick: () => removeExercise.mutate(exercise.id) },
                        ]}
                      />
                    </ExerciseRow>
                  ))
                )}

                <Button onClick={() => setAddExerciseOpen(true)}><Plus size={16} />Add exercise</Button>
              </StackCard>
            </Column>
          ) : (
            <Column>
              <EmptyDetail $hideOnMobile={dayTypes.length === 0}>
                <h2 style={{ margin: 0 }}>Choose a workout to edit</h2>
                <Small>
                  {dayTypes.length === 0
                    ? 'Create your first workout in the Workout library.'
                    : 'Select a workout from the library to view its exercises and prescription.'}
                </Small>
              </EmptyDetail>
            </Column>
          )}
        </Layout>
      </div>

      <div role="tabpanel" id="tabpanel-schedule" aria-labelledby="tab-schedule" hidden={activeTab !== 'schedule'}>
        <ScheduleLayout>
          <StackCard>
            <h2 style={{ margin: '0 0 12px 0' }}>Program schedule</h2>
            {!selectedProgramId ? (
              <Small>Set up your training program to see it here.</Small>
            ) : (
              <>
                <Select label="Mode" value={mode} onChange={(e) => { const next = e.target.value as 'perpetual' | 'block'; setMode(next); patchProgram.mutate({ cycleLengthWeeks: next === 'block' ? 1 : null }); }} options={modeOptions} />
                <Small>Select a workout below, then click a day to assign it. Click an assigned day again to clear it.</Small>
                <Row style={{ flexWrap: 'wrap' }}>
                  {dayTypes.map((dayType) => (
                    <LibraryItem key={dayType.id} $active={selectedDayTypeId === dayType.id} onClick={() => setSelectedDayTypeId(dayType.id)} style={{ flex: '0 0 auto' }}>
                      <strong>{dayType.name}</strong>
                    </LibraryItem>
                  ))}
                </Row>
                <DayGrid>
                  {dayNames.map((day, dayIndex) => {
                    const slot = slotsByDay.get(dayIndex);
                    const label = dayTypes.find((type) => type.id === slot?.dayTypeId)?.name ?? 'Unassigned';
                    const handleClick = () => {
                      if (slot && slot.dayTypeId === selectedDayTypeId) {
                        // Clicking the already-assigned day type again clears it,
                        // instead of silently re-PATCHing to the same value.
                        removeSlot.mutate(slot.id);
                        return;
                      }
                      if (selectedDayTypeId) {
                        upsertSlot.mutate({ id: slot?.id, dayTypeId: selectedDayTypeId, weekNumber: mode === 'block' ? 1 : null, dayIndex, sortOrder: dayIndex });
                      }
                    };
                    return (
                      <DayCell key={day} $active={Boolean(slot)} onClick={handleClick}>
                        <DayName>{day}</DayName>
                        <DayLabel>{label}</DayLabel>
                      </DayCell>
                    );
                  })}
                </DayGrid>
              </>
            )}
          </StackCard>
        </ScheduleLayout>
      </div>

      {editState ? (
        <ExerciseEditModal
          state={editState}
          onClose={() => setEditState(null)}
          onSave={(next) => patchExercise.mutate({ exerciseId: next.exerciseId, body: { prescription: next.prescription, notes: next.notes || null } })}
          onDelete={() => removeExercise.mutate(editState.exerciseId)}
        />
      ) : null}

      {addExerciseOpen && selectedDayTypeId ? (
        <AddExercisePicker
          exercises={exercises}
          onClose={() => setAddExerciseOpen(false)}
          isCreatingExercise={createExercise.isPending}
          onCreateExercise={(name) => createExercise.mutateAsync({ name })}
          isAddingExercise={addExercise.isPending}
          onAddExercise={(exerciseId, prescription) => addExercise.mutate({ exerciseId, prescription })}
        />
      ) : null}
    </Column>
  );
}
