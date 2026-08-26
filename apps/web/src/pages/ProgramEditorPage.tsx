import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { spacing, radius } from '@setframe/design-tokens';
import type {
  CreatePlannedSetInput,
  DayType,
  DayTypeExercise,
  DayTypeExercisePlannedSet,
  Exercise,
  Prescription,
  ProgramScheduleSlot,
  TrainingProgram,
} from '@setframe/schemas';
import { Badge, Button, Card, FadeIn, IconButton, Input, Menu, Modal as SharedModal, Select, Skeleton, SkeletonStack, Tabs, WeekScheduleEditor, useToast } from '../components';
import { ExerciseEditModal, type EditState } from '../components/ExerciseEditModal';
import { AddExercisePicker, emptyPrescription } from '../components/AddExercisePicker';
import { UpcomingDaysSchedule } from '../components/UpcomingDaysSchedule';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription, parseOptionalNumber } from '../lib/prescription';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
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

/** Story 24 — Programs tab. `$selected` = currently being viewed/edited
 * here; independent of the program's own `isActive` (which drives Today).
 * Conflating the two was the exact bug this story fixes: a program card
 * tap must never activate anything on its own. */
const ProgramList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const ProgramCard = styled(Card)<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
  border-color: ${(p) => (p.$selected ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$selected ? p.theme.action.accentSubtle : p.theme.surface.raised)};
`;

const ProgramCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[8]}px;
`;

const ProgramCardTitleRow = styled.button`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
  flex: 1;
  min-width: 0;
`;

const ProgramCardActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  flex-wrap: wrap;
`;

/** Only shown once a user has more than one program — the Programs tab
 * already makes context clear for the common single-program case, so this
 * avoids adding chrome nobody needs (per the story's own guidance). */
const ContextLabel = styled.p`
  margin: 0 0 ${spacing[4]}px;
  font-size: ${typeScale.compactBody.fontSize}px;
  color: ${(p) => p.theme.text.secondary};

  strong {
    color: ${(p) => p.theme.text.primary};
    font-weight: 600;
  }
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

const modeOptions = [
  { value: 'perpetual', label: 'Repeats weekly' },
  { value: 'block', label: 'Block' },
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

// parseOptionalNumber and summarizePrescription are imported from
// ../lib/prescription (Story 19) — these used to be local, divergent
// copies that never learned about optional/absent target values.

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
        <Button onClick={() => void handleSubmit()} disabled={!trimmed || isPending} status={isPending ? 'loading' : 'idle'}>
          Create workout
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

/** Story 24 — inline program rename, matching the same pattern as workout
 * creation above: no separate dialog for a single-field edit. */
function ProgramRenameForm({
  initialName,
  isPending,
  onCancel,
  onSave,
}: {
  initialName: string;
  isPending: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <CreateWorkoutForm>
      <Input
        label="Program name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && trimmed) onSave(trimmed);
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
      />
      <CreateWorkoutActions>
        <Button onClick={() => trimmed && onSave(trimmed)} disabled={!trimmed || isPending} status={isPending ? 'loading' : 'idle'}>
          Save
        </Button>
        <Button variant="tertiary" onClick={onCancel} type="button">
          Cancel
        </Button>
      </CreateWorkoutActions>
    </CreateWorkoutForm>
  );
}

/**
 * Mirrors the real Training layout — header, tabs, workout library and the
 * detail pane — so the page keeps its shape while loading and the content
 * lands in place instead of shifting everything down.
 */
function TrainingSkeleton() {
  return (
    <Column aria-busy="true" aria-live="polite" data-testid="training-skeleton">
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Loading your training program…
      </span>
      <Row style={{ justifyContent: 'space-between' }}>
        <SkeletonStack $gap={8} style={{ flex: 1 }}>
          <Skeleton $width="180px" $height={30} />
          <Skeleton $width="60%" $height={14} />
        </SkeletonStack>
      </Row>

      <Skeleton $height={40} $width="220px" />

      <Layout>
        <Column>
          <LibraryCard>
            <Skeleton $width="90px" $height={16} />
            <Skeleton $height={56} />
            <Skeleton $height={56} />
            <Skeleton $height={56} />
          </LibraryCard>
        </Column>
        <Column>
          <StackCard>
            <SkeletonStack $gap={8}>
              <Skeleton $width="45%" $height={22} />
              <Skeleton $width="30%" $height={14} />
            </SkeletonStack>
            <Skeleton $height={64} />
            <Skeleton $height={64} />
            <Skeleton $height={64} />
          </StackCard>
        </Column>
      </Layout>
    </Column>
  );
}

export function ProgramEditorPage() {
  const api = useApiClient();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedDayTypeId, setSelectedDayTypeId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  /* Both workout actions destroy something, and neither confirmed — one
     click on "Delete permanently" removed a workout from *every* program
     that used it, with no undo anywhere on this screen. Mobile has always
     confirmed both; this is web catching up to it, not the reverse. */
  const [pendingWorkoutAction, setPendingWorkoutAction] = useState<
    { kind: 'removeFromProgram' | 'deletePermanently'; id: string; name: string } | null
  >(null);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'programs' | 'workouts' | 'schedule'>(
    requestedTab === 'programs' || requestedTab === 'schedule' ? requestedTab : 'workouts',
  );
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [renamingProgramId, setRenamingProgramId] = useState<string | null>(null);

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<TrainingProgram[]>('/programs'),
  });
  // Story 25 — scoped to the selected program (membership, not plain
  // ownership): a global "every workout this user has ever made" list
  // made program boundaries meaningless once more than one program exists.
  const { data: dayTypes = [], isLoading: dayTypesLoading } = useQuery({
    queryKey: ['program-day-types', selectedProgramId],
    queryFn: () => api.get<DayType[]>(`/programs/${selectedProgramId}/day-types`),
    enabled: !!selectedProgramId,
  });
  // Only fetched for the "add an existing workout" picker below — never
  // rendered as a list on its own.
  const { data: allDayTypes = [] } = useQuery({
    queryKey: ['day-types'],
    queryFn: () => api.get<DayType[]>('/day-types'),
  });
  const {
    data: exercises = [],
    isLoading: exercisesLoading,
    isError: exercisesError,
    refetch: refetchExercises,
  } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') });

  const activeProgram = useMemo(() => programs?.find((p) => p.isActive) ?? programs?.[0] ?? null, [programs]);
  const selectedProgram = useMemo(
    () => programs?.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId],
  );
  // Shared between the Workouts and Schedule tabpanels below — only shown
  // once there's an actual choice to make.
  const programContextLabel =
    programs && programs.length > 1 && selectedProgram ? (
      <ContextLabel>
        Editing <strong>{selectedProgram.name}</strong>
      </ContextLabel>
    ) : null;
  // Block mode vs. perpetual is a property of whichever program is
  // *selected*, not a piece of local UI state — deriving it keeps it from
  // going stale when the selection changes (Story 24). `optimisticMode`
  // is a short-lived override so the Select responds instantly on
  // change instead of visibly snapping back to the old value until the
  // PATCH round-trip resolves; cleared once the mutation settles (a
  // failure then correctly falls back to the real server value).
  const [optimisticMode, setOptimisticMode] = useState<'perpetual' | 'block' | null>(null);
  const mode: 'perpetual' | 'block' = optimisticMode ?? (selectedProgram?.cycleLengthWeeks ? 'block' : 'perpetual');

  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setSelectedProgramId(created.id);
    },
  });

  const activateProgram = useMutation({
    mutationFn: (programId: string) => api.post<TrainingProgram>(`/programs/${programId}/activate`),
    onSuccess: (activated) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.show({ variant: 'success', message: `${activated.name} is now your active program.` });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not switch your active program.' }),
  });

  const renameProgram = useMutation({
    mutationFn: ({ programId, name }: { programId: string; name: string }) =>
      api.patch<TrainingProgram>(`/programs/${programId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setRenamingProgramId(null);
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not rename that program.' }),
  });

  // Selecting a program (to view/edit) must never implicitly activate it
  // (Story 24) — this only ever picks a *default* selection once, on
  // first load or if the previous selection stopped existing (e.g. it was
  // archived elsewhere). A user's manual selection is never overwritten.
  useEffect(() => {
    if (!programs) return;
    const stillExists = programs.some((p) => p.id === selectedProgramId);
    if (!stillExists) setSelectedProgramId(activeProgram?.id ?? programs[0]?.id ?? null);
  }, [programs, selectedProgramId, activeProgram]);

  // Story 26 — a workout selected while viewing Program A's Workouts/
  // Schedule must not stay selected once the user switches to Program B;
  // it may not even exist there. Same reasoning for a pending Mode
  // override: it belongs to whichever program was selected when it was
  // set, not to whatever gets selected next.
  useEffect(() => {
    setSelectedDayTypeId(null);
    setOptimisticMode(null);
  }, [selectedProgramId]);

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
    queryClient.invalidateQueries({ queryKey: ['program-day-types', selectedProgramId] });
    queryClient.invalidateQueries({ queryKey: ['day-type', selectedDayTypeId] });
    queryClient.invalidateQueries({ queryKey: ['schedule-slots', selectedProgramId] });
  };

  const createDayType = useMutation({
    // `programId` must be omitted, not sent as `null`, when there's no
    // selected program — the API schema only accepts `string | undefined`.
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', { ...body, programId: selectedProgramId ?? undefined }),
    onSuccess: (row) => {
      invalidateTraining();
      setSelectedDayTypeId(row.id);
      setShowCreateForm(false);
    },
  });

  const addExistingToProgram = useMutation({
    mutationFn: (dayTypeId: string) => api.post<DayType>(`/programs/${selectedProgramId}/day-types`, { dayTypeId }),
    onSuccess: (row) => {
      invalidateTraining();
      setSelectedDayTypeId(row.id);
      setAddExistingOpen(false);
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add that workout to the program.' }),
  });

  // Membership only (Story 25) — the workout, its exercises, and its
  // presence in any other program are untouched. Distinct from the
  // permanent `deleteDayType` below.
  const removeFromProgram = useMutation({
    mutationFn: (dayTypeId: string) => api.del<void>(`/programs/${selectedProgramId}/day-types/${dayTypeId}`),
    onSuccess: () => {
      invalidateTraining();
      setSelectedDayTypeId(null);
      toast.show({ variant: 'success', message: 'Removed from this program.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove that workout from the program.' }),
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      setOptimisticMode(null);
    },
    // `mode` is now derived straight from the program row (not local state),
    // so a failed save has to be surfaced explicitly — otherwise it just
    // silently reverts on the next render with no explanation.
    onError: () => {
      setOptimisticMode(null);
      toast.show({ variant: 'error', message: 'Could not update the schedule mode.' });
    },
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

  // Workouts the user already has, not yet part of this program — the
  // pool "Add existing workout" picks from (Story 25).
  const addableDayTypes = useMemo(() => {
    const memberIds = new Set(dayTypes.map((d) => d.id));
    return allDayTypes.filter((d) => !memberIds.has(d.id));
  }, [allDayTypes, dayTypes]);

  const reorderByDelta = (index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= sortedExercises.length) return;
    reorderExercises.mutate(moveItem(sortedExercises.map((item) => item.id), index, nextIndex));
  };

  /* `dayTypes` defaults to an empty array while it loads, which used to
     render the "No workouts yet" empty state and the guided-setup banner to
     users who already have a program — a wrong answer, shown confidently,
     that then snapped to the real list. Hold the content-shaped skeleton
     until both queries that decide those branches have resolved.
     `dayTypes` (Story 25) is enabled only once `selectedProgramId` exists,
     so there's a one-tick window between programs resolving and the
     default-selection effect running where it would otherwise report
     "not loading" with stale/empty data — treat that window as loading too. */
  const stillResolvingSelectedProgram = Boolean(programs && programs.length > 0 && !selectedProgramId);
  if (programsLoading || stillResolvingSelectedProgram || dayTypesLoading) {
    return <TrainingSkeleton />;
  }

  return (
    // Fades the real content in over the skeleton it replaces, so the swap
    // reads as a transition rather than a pop.
    <FadeIn>
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
            New to Setframe?
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
          { key: 'programs', label: 'Programs' },
          { key: 'workouts', label: 'Workouts' },
          { key: 'schedule', label: 'Schedule' },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'programs' | 'workouts' | 'schedule')}
      />

      <div role="tabpanel" id="tabpanel-programs" aria-labelledby="tab-programs" hidden={activeTab !== 'programs'}>
        <ScheduleLayout>
          <StackCard>
            <h2 style={{ margin: '0 0 4px 0' }}>Your programs</h2>
            <Small style={{ margin: '0 0 8px 0' }}>
              Select a program to view or edit it. Only one program is active at a time — that&apos;s the one
              Today follows.
            </Small>
            <ProgramList>
              {(programs ?? []).map((program) => (
                <ProgramCard key={program.id} $selected={program.id === selectedProgramId}>
                  {renamingProgramId === program.id ? (
                    <ProgramRenameForm
                      initialName={program.name}
                      isPending={renameProgram.isPending}
                      onCancel={() => setRenamingProgramId(null)}
                      onSave={(name) => renameProgram.mutate({ programId: program.id, name })}
                    />
                  ) : (
                    <ProgramCardHeader>
                      <ProgramCardTitleRow
                        onClick={() => setSelectedProgramId(program.id)}
                        aria-pressed={program.id === selectedProgramId}
                      >
                        <strong>{program.name}</strong>
                        {program.isActive ? <Badge tone="success">Active</Badge> : null}
                      </ProgramCardTitleRow>
                      <Menu
                        label={`Actions for ${program.name}`}
                        items={[{ label: 'Rename', onClick: () => setRenamingProgramId(program.id) }]}
                      />
                    </ProgramCardHeader>
                  )}
                  <ProgramCardActions>
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedProgramId(program.id)}
                      disabled={program.id === selectedProgramId}
                    >
                      {program.id === selectedProgramId ? 'Viewing' : 'View'}
                    </Button>
                    <Button
                      variant={program.isActive ? 'secondary' : 'primary'}
                      disabled={program.isActive || activateProgram.isPending}
                      onClick={() => activateProgram.mutate(program.id)}
                    >
                      {program.isActive ? (
                        <>
                          <Check size={16} aria-hidden="true" />
                          Active
                        </>
                      ) : activateProgram.isPending && activateProgram.variables === program.id ? (
                        'Setting active…'
                      ) : (
                        'Set as active'
                      )}
                    </Button>
                  </ProgramCardActions>
                </ProgramCard>
              ))}
            </ProgramList>
          </StackCard>
        </ScheduleLayout>
      </div>

      <div role="tabpanel" id="tabpanel-workouts" aria-labelledby="tab-workouts" hidden={activeTab !== 'workouts'}>
        <Layout>
          <Column>
            {programContextLabel}
            <LibraryCard>
              <strong>Workouts</strong>
              {!selectedProgramId ? (
                // No program exists/selected — creating a workout here has
                // nothing to associate it with (the API requires a real
                // programId, not null). Point at guided setup instead of
                // rendering a form that can only fail.
                <Small>Create a program first, then add workouts to it here.</Small>
              ) : dayTypes.length === 0 ? (
                <>
                  <Small>No workouts yet. Create reusable workouts like Lower C, Upper A, or Recovery.</Small>
                  <WorkoutCreateForm
                    onCreate={(name) => createDayType.mutateAsync({ name })}
                    isPending={createDayType.isPending}
                    existingNames={dayTypes.map((d) => d.name)}
                    autoFocus
                  />
                  {addableDayTypes.length > 0 ? (
                    <Button variant="secondary" onClick={() => setAddExistingOpen(true)}>
                      Add an existing workout
                    </Button>
                  ) : null}
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
                    <CreateWorkoutActions>
                      <Button variant="secondary" onClick={() => setShowCreateForm(true)}>
                        <Plus size={16} />New workout
                      </Button>
                      {addableDayTypes.length > 0 ? (
                        <Button variant="tertiary" onClick={() => setAddExistingOpen(true)}>
                          Add existing
                        </Button>
                      ) : null}
                    </CreateWorkoutActions>
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
                  <Menu
                    label={`Actions for ${selectedDayType.name}`}
                    items={[
                      {
                        label: 'Remove from this program',
                        destructive: true,
                        onClick: () =>
                          setPendingWorkoutAction({
                            kind: 'removeFromProgram',
                            id: selectedDayType.id,
                            name: selectedDayType.name,
                          }),
                      },
                      {
                        label: 'Delete permanently',
                        destructive: true,
                        onClick: () =>
                          setPendingWorkoutAction({
                            kind: 'deletePermanently',
                            id: selectedDayType.id,
                            name: selectedDayType.name,
                          }),
                      },
                    ]}
                  />
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
            <h2 style={{ margin: '0 0 4px 0' }}>Program schedule</h2>
            {programContextLabel}
            {!selectedProgramId ? (
              <Small>Set up your training program to see it here.</Small>
            ) : dayTypes.length === 0 ? (
              // Story 26 — Schedule only ever offers this program's own
              // workouts; with none yet, there's nothing to build with.
              <Small>Add a workout to this program before building its schedule.</Small>
            ) : (
              <>
                <Select label="Mode" value={mode} onChange={(e) => { const next = e.target.value as 'perpetual' | 'block'; setOptimisticMode(next); patchProgram.mutate({ cycleLengthWeeks: next === 'block' ? 1 : null }); }} options={modeOptions} />
                <WeekScheduleEditor
                  workouts={dayTypes.map((dayType) => ({ id: dayType.id, name: dayType.name }))}
                  assignmentsByDay={Object.fromEntries([...slotsByDay].map(([dayIndex, slot]) => [dayIndex, slot.dayTypeId]))}
                  selectedWorkoutId={selectedDayTypeId}
                  onSelectWorkout={setSelectedDayTypeId}
                  onAssignDay={(dayIndex, dayTypeId) =>
                    upsertSlot.mutate({
                      id: slotsByDay.get(dayIndex)?.id,
                      dayTypeId,
                      weekNumber: mode === 'block' ? 1 : null,
                      dayIndex,
                      sortOrder: dayIndex,
                    })
                  }
                  onClearDay={(dayIndex) => {
                    const slot = slotsByDay.get(dayIndex);
                    if (slot) removeSlot.mutate(slot.id);
                  }}
                />
              </>
            )}
          </StackCard>

          {activeTab === 'schedule' ? (
            <StackCard>
              <h2 style={{ margin: '0 0 4px 0' }}>Rest &amp; corrections</h2>
              <Small style={{ margin: '0 0 8px 0' }}>
                Plan a rest day ahead, or correct a day you forgot to mark. Training always wins — a logged
                workout supersedes a rest day.
              </Small>
              {/* Mounted only while this tab is active, not just CSS-hidden —
                  it fans out into 14 parallel GET /dashboard/today calls
                  (one per visible date), each several DB queries server-side;
                  no reason to pay that on every page load regardless of tab
                  (code-review follow-up). */}
              <UpcomingDaysSchedule />
            </StackCard>
          ) : null}
        </ScheduleLayout>
      </div>

      <SharedModal
        presentation="compact"
        open={pendingWorkoutAction != null}
        onClose={() => setPendingWorkoutAction(null)}
        title={
          pendingWorkoutAction?.kind === 'deletePermanently'
            ? `Delete ${pendingWorkoutAction.name}?`
            : `Remove ${pendingWorkoutAction?.name ?? 'workout'} from this program?`
        }
        /* The two options sit next to each other in one menu and the
           difference between them is the whole point, so the destructive one
           says plainly that it is not scoped to this program. Same copy as
           mobile's confirmation. */
        description={
          pendingWorkoutAction?.kind === 'deletePermanently'
            ? 'This deletes the workout for every program that uses it, along with its exercises. Workouts you have already logged are not affected.'
            : 'The workout itself is kept, along with any other program using it. Its scheduled days in this program are cleared.'
        }
      >
        <Row style={{ justifyContent: 'flex-end', gap: spacing[8] }}>
          <Button variant="secondary" onClick={() => setPendingWorkoutAction(null)}>
            Cancel
          </Button>
          <Button
            data-testid="confirm-workout-action"
            disabled={removeFromProgram.isPending || deleteDayType.isPending}
            onClick={() => {
              if (!pendingWorkoutAction) return;
              if (pendingWorkoutAction.kind === 'deletePermanently') {
                deleteDayType.mutate(pendingWorkoutAction.id);
              } else {
                removeFromProgram.mutate(pendingWorkoutAction.id);
              }
              setPendingWorkoutAction(null);
            }}
          >
            {pendingWorkoutAction?.kind === 'deletePermanently' ? 'Delete' : 'Remove'}
          </Button>
        </Row>
      </SharedModal>

      {editState ? (
        <ExerciseEditModal
          state={editState}
          onClose={() => setEditState(null)}
          onSave={(next) => patchExercise.mutate({ exerciseId: next.exerciseId, body: { prescription: next.prescription, notes: next.notes || null } })}
          onDelete={() => removeExercise.mutate(editState.exerciseId)}
          advancedSlot={<PlannedSetsEditor dayTypeId={editState.dayTypeId} exerciseId={editState.exerciseId} />}
        />
      ) : null}

      {addExerciseOpen && selectedDayTypeId ? (
        <AddExercisePicker
          exercises={exercises}
          exercisesLoading={exercisesLoading}
          exercisesError={exercisesError}
          onRetryExercises={refetchExercises}
          onClose={() => setAddExerciseOpen(false)}
          isCreatingExercise={createExercise.isPending}
          onCreateExercise={(name) => createExercise.mutateAsync({ name })}
          isAddingExercise={addExercise.isPending}
          onAddExercise={(exerciseId, prescription) => addExercise.mutate({ exerciseId, prescription })}
        />
      ) : null}

      {addExistingOpen ? (
        <SharedModal
          open
          onClose={() => setAddExistingOpen(false)}
          presentation="task"
          title="Add an existing workout"
        >
          <Column>
            {addableDayTypes.length === 0 ? (
              <Small>Every workout you have is already part of this program.</Small>
            ) : (
              addableDayTypes.map((dayType) => (
                <Row key={dayType.id} style={{ justifyContent: 'space-between' }}>
                  <strong>{dayType.name}</strong>
                  <Button
                    variant="secondary"
                    disabled={addExistingToProgram.isPending}
                    onClick={() => addExistingToProgram.mutate(dayType.id)}
                  >
                    Add
                  </Button>
                </Row>
              ))
            )}
          </Column>
        </SharedModal>
      ) : null}
    </Column>
    </FadeIn>
  );
}
