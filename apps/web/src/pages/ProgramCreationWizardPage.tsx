import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing, radius } from '@setframe/design-tokens';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Button, Card, Input, Menu, Modal, Select, Stepper, WeekScheduleEditor, useToast } from '../components';
import { AddExercisePicker } from '../components/AddExercisePicker';
import { ExerciseEditModal, type EditState } from '../components/ExerciseEditModal';
import { restoreExerciseOrder } from '@setframe/domain';
import { useApiClient } from '../lib/api-client';
import { mq } from '../theme/breakpoints';
import { typeScale } from '../theme/typeScale';

interface DayTypeDetail extends DayType {
  exercises: DayTypeExercise[];
}

interface WizardWorkoutDraft {
  tempId: string;
  dayTypeId: string;
  name: string;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_SCHEDULE_SLOTS: ProgramScheduleSlot[] = [];
const modeOptions = [
  { value: 'perpetual', label: 'Repeats weekly' },
  { value: 'block', label: 'Fixed block/cycle' },
];
const steps = [
  { key: 'program', title: 'Program', description: 'Your overall training plan over time.' },
  { key: 'workouts', title: 'Workouts', description: "Reusable training days inside your program." },
  { key: 'exercises', title: 'Exercises', description: 'What you perform inside the selected workout.' },
  { key: 'schedule', title: 'Schedule', description: 'Assign workouts to your week.' },
];

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[24]}px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const Eyebrow = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.label.fontSize}px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;

const Subtitle = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
`;

/**
 * A single, persistent example of containment (Program → Workout →
 * Exercise) — Story 17. Novice beta users conflated "workout" with
 * "today's exercise"; this shows the nesting once, compactly, rather than
 * repeating an explanation at every step.
 */
const HierarchyHint = styled.pre`
  margin: 0;
  padding: ${spacing[8]}px ${spacing[12]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.sunken};
  color: ${(p) => p.theme.text.secondary};
  font-family: inherit;
  font-size: ${typeScale.caption.fontSize}px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
`;

const Grid = styled.div`
  display: grid;
  gap: ${spacing[24]}px;

  ${mq.desktop} {
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    align-items: start;
  }
`;

const StepCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;

const AsideCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const CompactSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;

  ${mq.desktop} {
    display: none;
  }
`;

const FullSummary = styled.div`
  display: none;

  ${mq.desktop} {
    display: flex;
    flex-direction: column;
    gap: ${spacing[12]}px;
  }

  /* On mobile, only shown once the user expands the <details> below. */
  details[open] & {
    display: flex;
    flex-direction: column;
    gap: ${spacing[12]}px;
  }
`;

const MobileDetails = styled.details`
  ${mq.desktop} {
    display: contents;
  }
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;

const SectionBody = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;

const Row = styled.div`
  display: flex;
  gap: ${spacing[8]}px;
  flex-wrap: wrap;
  align-items: center;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
`;

const WorkoutCard = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
  padding: ${spacing[16]}px;
  border-radius: ${radius.large}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
`;

const WorkoutSelectButton = styled.button`
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
`;

const Small = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.caption.fontSize}px;
`;

const ExerciseCard = styled.div`
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.large}px;
  padding: ${spacing[12]}px;
  display: flex;
  align-items: center;
  gap: ${spacing[8]}px;
`;

const ExerciseSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  min-width: 0;
  flex: 1;
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  flex-wrap: wrap;
`;

const EmptyState = styled.div`
  border: 1px dashed ${(p) => p.theme.border.default};
  border-radius: ${radius.large}px;
  padding: ${spacing[16]}px;
  color: ${(p) => p.theme.text.secondary};
`;

const SummaryList = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
`;


function summarizePrescription(prescription: Prescription) {
  switch (prescription.kind) {
    case 'sets_reps':
    case 'bodyweight_reps':
    case 'per_side':
      return `${prescription.sets} × ${prescription.repsMin}${prescription.repsMax ? `–${prescription.repsMax}` : ''}`;
    case 'timed':
      return `${prescription.sets} × ${prescription.durationSeconds}s`;
    case 'duration':
      return `${prescription.durationMinutes} min`;
    case 'distanceDuration':
      return `${prescription.distanceMiles} mi / ${prescription.durationMinutes} min`;
    case 'distance':
      return `${prescription.sets} × ${prescription.distanceValue} ${prescription.distanceUnit}`;
    case 'top_set_backoff':
      return 'Top + backoff';
  }
}

function nextTempId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ProgramCreationWizardPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [programName, setProgramName] = useState('My Training Program');
  const [mode, setMode] = useState<'perpetual' | 'block'>('perpetual');
  const [programId, setProgramId] = useState<string | null>(null);
  const [workoutName, setWorkoutName] = useState('');
  const [workouts, setWorkouts] = useState<WizardWorkoutDraft[]>([]);
  const [selectedWorkoutTempId, setSelectedWorkoutTempId] = useState<string | null>(null);
  const [workoutNameError, setWorkoutNameError] = useState<string | null>(null);
  const [renamingTempId, setRenamingTempId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<{ workout: WizardWorkoutDraft; exerciseCount: number } | null>(null);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, string | null>>({});

  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: () => api.get<TrainingProgram[]>('/programs') });
  const {
    data: exercises = [],
    isLoading: exercisesLoading,
    isError: exercisesError,
    refetch: refetchExercises,
  } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') });
  // `?? EMPTY_SCHEDULE_SLOTS` (not `= []`) so the fallback is a stable
  // reference — a fresh `[]` on every render here fed straight into a
  // useEffect dependency below and caused an infinite render loop while the
  // query was disabled/unresolved (i.e. before a program exists yet).
  const scheduleSlotsQuery = useQuery({
    queryKey: ['schedule-slots', programId],
    queryFn: () => api.get<ProgramScheduleSlot[]>(`/programs/${programId}/schedule-slots`),
    enabled: Boolean(programId),
  });
  const scheduleSlots = scheduleSlotsQuery.data ?? EMPTY_SCHEDULE_SLOTS;

  const existingProgramCount = programs?.length ?? 0;
  const activeProgram = useMemo(() => programs?.find((program) => program.id === programId) ?? null, [programId, programs]);
  const selectedWorkout = useMemo(() => workouts.find((workout) => workout.tempId === selectedWorkoutTempId) ?? null, [workouts, selectedWorkoutTempId]);

  const exerciseName = (item: DayTypeExercise) =>
    exercises.find((candidate) => candidate.id === item.exerciseId)?.name ?? 'Exercise';

  const selectedWorkoutDetail = useQuery({
    queryKey: ['day-type', selectedWorkout?.dayTypeId],
    queryFn: () => api.get<DayTypeDetail>(`/day-types/${selectedWorkout?.dayTypeId}`),
    enabled: Boolean(selectedWorkout?.dayTypeId),
  });

  useEffect(() => {
    if (!selectedWorkoutTempId && workouts.length > 0) {
      setSelectedWorkoutTempId(workouts[0]!.tempId);
    }
  }, [selectedWorkoutTempId, workouts]);

  useEffect(() => {
    const next: Record<number, string | null> = {};
    scheduleSlots.forEach((slot) => {
      if (slot.weekNumber === null || slot.weekNumber === 1) next[slot.dayIndex] = slot.dayTypeId;
    });
    setScheduleByDay(next);
  }, [scheduleSlots]);

  const createProgram = useMutation({
    mutationFn: (body: { name: string }) => api.post<TrainingProgram>('/programs', body),
    onSuccess: async (created) => {
      setProgramId(created.id);
      await queryClient.invalidateQueries({ queryKey: ['programs'] });
      if (mode === 'block') {
        await api.patch(`/programs/${created.id}`, { cycleLengthWeeks: 1 });
        await queryClient.invalidateQueries({ queryKey: ['programs'] });
      }
      setCurrentStep(1);
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not create program.' }),
  });

  const createDayType = useMutation({
    mutationFn: (body: { name: string }) => api.post<DayType>('/day-types', body),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['day-types'] });
      const nextWorkout = { tempId: nextTempId('workout'), dayTypeId: created.id, name: created.name };
      setWorkouts((current) => [...current, nextWorkout]);
      setSelectedWorkoutTempId(nextWorkout.tempId);
      setWorkoutName('');
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not create workout.' }),
  });

  const renameDayType = useMutation({
    mutationFn: ({ dayTypeId, name }: { dayTypeId: string; name: string }) => api.patch<DayType>(`/day-types/${dayTypeId}`, { name }),
    onSuccess: (updated, vars) => {
      setWorkouts((current) => current.map((w) => (w.dayTypeId === vars.dayTypeId ? { ...w, name: updated.name } : w)));
      setRenamingTempId(null);
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not rename workout.' }),
  });

  /**
   * Guided Setup writes workouts straight to the backend, so removal is a
   * real DELETE and undo has to re-create the day type and re-add every
   * exercise it held, in order — mirroring `removeExercise` below.
   *
   * Known gap, shared with `removeExercise`/`undoRemoveExercise`: undo
   * restores each exercise from its `prescription` only. Per-set overrides
   * in `dayTypeExercisePlannedSet` aren't in the `GET /day-types/:id`
   * response at all, so there's currently nothing to restore them from
   * without new backend surface — narrow in practice, since planned-set
   * overrides are a full-editor-only feature, not something Guided Setup
   * itself creates.
   */
  const removeWorkout = useMutation({
    mutationFn: async (workout: WizardWorkoutDraft) => {
      const detail = await api.get<DayTypeDetail>(`/day-types/${workout.dayTypeId}`).catch(() => null);
      const position = workouts.findIndex((w) => w.tempId === workout.tempId);
      await api.del(`/day-types/${workout.dayTypeId}`);
      return { workout, exercises: detail?.exercises ?? [], position };
    },
    onSuccess: async ({ workout, exercises, position }) => {
      setWorkouts((current) => current.filter((w) => w.tempId !== workout.tempId));
      setSelectedWorkoutTempId((current) => (current === workout.tempId ? null : current));
      // The API cascade-deletes this workout's programScheduleSlot rows
      // (day-types.ts) — without this, a day already assigned to the
      // removed workout keeps showing a ghost assignment the schedule step
      // can't clear (its slot id no longer exists server-side).
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
      toast.show({
        variant: 'success',
        message:
          exercises.length > 0
            ? `Workout removed, along with ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}.`
            : 'Workout removed.',
        actionLabel: 'Undo',
        onAction: () => undoRemoveWorkout.mutate({ name: workout.name, exercises, position }),
      });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove workout.' }),
  });

  const undoRemoveWorkout = useMutation({
    mutationFn: async ({ name, exercises, position }: { name: string; exercises: DayTypeExercise[]; position: number }) => {
      const created = await api.post<DayType>('/day-types', { name });
      for (const exercise of exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        await api.post(`/day-types/${created.id}/exercises`, {
          exerciseId: exercise.exerciseId,
          prescription: exercise.prescription,
          notes: exercise.notes ?? undefined,
        });
      }
      return { created, position };
    },
    onSuccess: ({ created, position }) => {
      const nextWorkout = { tempId: nextTempId('workout'), dayTypeId: created.id, name: created.name };
      setWorkouts((current) => {
        const next = current.slice();
        next.splice(Math.min(position, next.length), 0, nextWorkout);
        return next;
      });
      toast.show({ variant: 'success', message: 'Workout restored.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not restore the workout.' }),
  });

  async function requestRemoveWorkout(workout: WizardWorkoutDraft) {
    const detail = await api.get<DayTypeDetail>(`/day-types/${workout.dayTypeId}`).catch(() => null);
    const exerciseCount = detail?.exercises.length ?? 0;
    if (exerciseCount > 0) {
      setPendingRemoval({ workout, exerciseCount });
    } else {
      removeWorkout.mutate(workout);
    }
  }

  function handleAddWorkout() {
    const trimmed = workoutName.trim();
    if (!trimmed) return;
    if (workouts.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      setWorkoutNameError(`A workout named "${trimmed}" already exists.`);
      return;
    }
    setWorkoutNameError(null);
    createDayType.mutate({ name: trimmed });
  }

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not create exercise.' }),
  });

  const addExercise = useMutation({
    mutationFn: (body: { dayTypeId: string; exerciseId: string; prescription: Prescription }) =>
      api.post(`/day-types/${body.dayTypeId}/exercises`, { exerciseId: body.exerciseId, prescription: body.prescription }),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', vars.dayTypeId] });
      toast.show({ variant: 'success', message: 'Exercise added.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not add exercise.' }),
  });

  /**
   * Guided Setup writes workout exercises straight to the backend, so a
   * removal is a real DELETE and undo has to re-create the row. Capture
   * the position it held so undo can put it back where it was.
   */
  const removeExercise = useMutation({
    mutationFn: async (target: DayTypeExercise) => {
      const originalIndex = (selectedWorkoutDetail.data?.exercises ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .findIndex((item) => item.id === target.id);
      await api.del(`/day-types/${target.dayTypeId}/exercises/${target.id}`);
      return { target, originalIndex };
    },
    onSuccess: async ({ target, originalIndex }) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', target.dayTypeId] });
      toast.show({
        variant: 'success',
        message: 'Exercise removed.',
        actionLabel: 'Undo',
        onAction: () => undoRemoveExercise.mutate({ target, originalIndex }),
      });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not remove exercise.' }),
  });

  const undoRemoveExercise = useMutation({
    mutationFn: async ({ target, originalIndex }: { target: DayTypeExercise; originalIndex: number }) => {
      const restored = await api.post<DayTypeExercise>(`/day-types/${target.dayTypeId}/exercises`, {
        exerciseId: target.exerciseId,
        prescription: target.prescription,
        notes: target.notes ?? undefined,
      });
      // Re-read the live list rather than replaying a pre-delete snapshot:
      // the reorder endpoint rejects any payload whose id set differs from
      // the day type's current rows, which a stale snapshot would trip as
      // soon as anything else changed in between.
      const detail = await api.get<DayTypeDetail>(`/day-types/${target.dayTypeId}`);
      const currentIds = detail.exercises
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.id);
      await api.post(`/day-types/${target.dayTypeId}/exercises/reorder`, {
        exerciseIdsInOrder: restoreExerciseOrder({ currentIds, restoredId: restored.id, originalIndex }),
      });
      return target.dayTypeId;
    },
    onSuccess: async (dayTypeId) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', dayTypeId] });
      toast.show({ variant: 'success', message: 'Exercise restored.' });
    },
    onError: async (_error, { target }) => {
      // The re-create may already have landed; refresh so the user sees the
      // real list instead of re-adding and creating a duplicate.
      await queryClient.invalidateQueries({ queryKey: ['day-type', target.dayTypeId] });
      toast.show({ variant: 'error', message: 'Could not fully restore exercise. Check the list.' });
    },
  });

  const patchExercise = useMutation({
    mutationFn: (args: { dayTypeId: string; exerciseId: string; body: { prescription: Prescription; notes: string | null } }) =>
      api.patch(`/day-types/${args.dayTypeId}/exercises/${args.exerciseId}`, args.body),
    onSuccess: async (_, args) => {
      await queryClient.invalidateQueries({ queryKey: ['day-type', args.dayTypeId] });
      setEditState(null);
      toast.show({ variant: 'success', message: 'Exercise updated.' });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not update exercise.' }),
  });

  const patchProgram = useMutation({
    mutationFn: (body: Partial<TrainingProgram>) => api.patch(`/programs/${programId}`, body),
    onError: () => toast.show({ variant: 'error', message: 'Could not update program mode.' }),
  });

  const upsertSlot = useMutation({
    mutationFn: async (body: { id?: string; dayTypeId: string; weekNumber: number | null; dayIndex: number; sortOrder: number }) => {
      if (!programId) throw new Error('Missing program');
      return body.id
        ? api.patch(`/programs/${programId}/schedule-slots/${body.id}`, body)
        : api.post(`/programs/${programId}/schedule-slots`, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not update schedule.' }),
  });

  const removeSlot = useMutation({
    mutationFn: async (slotId: string) => {
      if (!programId) throw new Error('Missing program');
      return api.del(`/programs/${programId}/schedule-slots/${slotId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule-slots', programId] });
    },
    onError: () => toast.show({ variant: 'error', message: 'Could not clear day.' }),
  });

  const canContinueFromProgram = programName.trim().length > 0;
  const canContinueFromWorkouts = workouts.length > 0;
  const exerciseCounts = workouts.map((workout) => {
    const detail = queryClient.getQueryData<DayTypeDetail>(['day-type', workout.dayTypeId]);
    return { workout, count: detail?.exercises.length ?? 0 };
  });
  const canContinueFromExercises = workouts.length > 0 && exerciseCounts.every((item) => item.count > 0);
  const hasSchedule = Object.values(scheduleByDay).some(Boolean);

  const goToEditor = () => navigate('/training');

  const handleProgramNext = async () => {
    if (!canContinueFromProgram) return;
    if (programId) {
      if (activeProgram?.cycleLengthWeeks && mode === 'perpetual') {
        await patchProgram.mutateAsync({ cycleLengthWeeks: null });
      } else if (!activeProgram?.cycleLengthWeeks && mode === 'block') {
        await patchProgram.mutateAsync({ cycleLengthWeeks: 1 });
      }
      setCurrentStep(1);
      return;
    }
    createProgram.mutate({ name: programName.trim() });
  };

  return (
    <Page>
      <Header>
        <Eyebrow>{existingProgramCount === 0 ? 'New here?' : 'Create another program'}</Eyebrow>
        <Title>Guided program setup</Title>
        <Subtitle>Build the basics in four focused steps, then jump into the full editor anytime for advanced tweaks.</Subtitle>
        <HierarchyHint>{'4-Day Strength Plan\n└─ Upper A\n   ├─ Squat\n   └─ Bench Press'}</HierarchyHint>
      </Header>

      <Stepper steps={steps} currentStep={currentStep} />

      <Grid>
        <StepCard>
          {currentStep === 0 ? (
            <>
              <SectionTitle>1. Start with the program</SectionTitle>
              <SectionBody>Your overall training plan over time — e.g. "4-Day Strength Plan." Choose whether it repeats every week or runs as a simple block.</SectionBody>
              <Input label="Program name" value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Fall strength block" />
              <Select label="Program mode" value={mode} onChange={(e) => setMode(e.target.value as 'perpetual' | 'block')} options={modeOptions} />
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <SectionTitle>2. Create your first workouts</SectionTitle>
              <SectionBody>
                Workouts are reusable training days inside your program — like Upper A, Lower B, or Recovery. You'll add exercises inside each workout in the next step.
              </SectionBody>
              <Row style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Workout name"
                    value={workoutName}
                    onChange={(e) => {
                      setWorkoutName(e.target.value);
                      if (workoutNameError) setWorkoutNameError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWorkout()}
                    placeholder="Upper A"
                  />
                </div>
                <Button onClick={handleAddWorkout} disabled={!workoutName.trim() || createDayType.isPending}>
                  <Plus size={16} /> Add workout
                </Button>
              </Row>
              {workoutNameError ? <Small role="alert">{workoutNameError}</Small> : null}
              <Stack>
                {workouts.length === 0 ? <EmptyState>No workouts yet. Add at least one to continue.</EmptyState> : null}
                {workouts.map((workout) =>
                  renamingTempId === workout.tempId ? (
                    <WorkoutCard key={workout.tempId} $active={selectedWorkoutTempId === workout.tempId}>
                      <Row style={{ flex: 1 }}>
                        <Input
                          label="Rename workout"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameDraft.trim()) {
                              renameDayType.mutate({ dayTypeId: workout.dayTypeId, name: renameDraft.trim() });
                            }
                            if (e.key === 'Escape') setRenamingTempId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          disabled={!renameDraft.trim() || renameDayType.isPending}
                          onClick={() => renameDayType.mutate({ dayTypeId: workout.dayTypeId, name: renameDraft.trim() })}
                        >
                          Save
                        </Button>
                        <Button variant="secondary" onClick={() => setRenamingTempId(null)}>Cancel</Button>
                      </Row>
                    </WorkoutCard>
                  ) : (
                    <WorkoutCard key={workout.tempId} $active={selectedWorkoutTempId === workout.tempId}>
                      <WorkoutSelectButton type="button" onClick={() => setSelectedWorkoutTempId(workout.tempId)}>
                        <strong>{workout.name}</strong>
                        <div>
                          <Small>{selectedWorkoutTempId === workout.tempId ? 'Selected for the next step' : 'Ready for exercises'}</Small>
                        </div>
                      </WorkoutSelectButton>
                      <Menu
                        label={`Actions for ${workout.name}`}
                        items={[
                          {
                            label: 'Rename',
                            onClick: () => {
                              setRenamingTempId(workout.tempId);
                              setRenameDraft(workout.name);
                            },
                          },
                          { label: 'Remove', destructive: true, onClick: () => void requestRemoveWorkout(workout) },
                        ]}
                      />
                    </WorkoutCard>
                  ),
                )}
              </Stack>

              {pendingRemoval ? (
                <Modal
                  open
                  onClose={() => setPendingRemoval(null)}
                  title={`Remove ${pendingRemoval.workout.name}?`}
                  description={`This workout has ${pendingRemoval.exerciseCount} exercise${pendingRemoval.exerciseCount === 1 ? '' : 's'} — removing it removes those workout-specific entries too. You can undo right after.`}
                >
                  <Row style={{ justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setPendingRemoval(null)}>Cancel</Button>
                    <Button
                      status={removeWorkout.isPending ? 'loading' : 'idle'}
                      onClick={() => {
                        removeWorkout.mutate(pendingRemoval.workout);
                        setPendingRemoval(null);
                      }}
                    >
                      Remove workout
                    </Button>
                  </Row>
                </Modal>
              ) : null}
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <SectionTitle>3. Add exercises</SectionTitle>
              <SectionBody>
                Exercises are what you actually perform inside the selected workout — like Squat, RDL, or Bench Press. Pick one workout at a time and add its core exercises with a simple prescription.
              </SectionBody>
              {workouts.length === 0 ? (
                <EmptyState>Create a workout first.</EmptyState>
              ) : (
                <>
                  <Row>
                    {workouts.map((workout) => (
                      <Button key={workout.tempId} variant={selectedWorkoutTempId === workout.tempId ? 'primary' : 'secondary'} onClick={() => setSelectedWorkoutTempId(workout.tempId)}>
                        {workout.name}
                      </Button>
                    ))}
                  </Row>
                  {selectedWorkout ? (
                    <Stack>
                      <Button onClick={() => setAddExerciseOpen(true)}>
                        <Plus size={16} /> Add exercise to {selectedWorkout.name}
                      </Button>

                      <Stack>
                        {(selectedWorkoutDetail.data?.exercises ?? []).length === 0 ? (
                          <EmptyState>Add at least one exercise to {selectedWorkout.name}.</EmptyState>
                        ) : (
                          selectedWorkoutDetail.data?.exercises
                            .slice()
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((exercise) => (
                              <ExerciseCard key={exercise.id}>
                                <ExerciseSummary>
                                  <strong>{exerciseName(exercise)}</strong>
                                  <Small>{summarizePrescription(exercise.prescription)}</Small>
                                </ExerciseSummary>
                                <Menu
                                  label={`Actions for ${exerciseName(exercise)}`}
                                  items={[
                                    {
                                      label: 'Edit',
                                      onClick: () =>
                                        setEditState({
                                          dayTypeId: exercise.dayTypeId,
                                          exerciseId: exercise.id,
                                          exerciseName: exerciseName(exercise),
                                          prescription: exercise.prescription,
                                          notes: exercise.notes ?? '',
                                        }),
                                    },
                                    // Not styled destructive: removal only detaches the
                                    // exercise from this workout and is undoable.
                                    { label: 'Remove', onClick: () => removeExercise.mutate(exercise) },
                                  ]}
                                />
                              </ExerciseCard>
                            ))
                        )}
                      </Stack>
                    </Stack>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {currentStep === 3 ? (
            <>
              <SectionTitle>4. Put workouts on the calendar</SectionTitle>
              <SectionBody>Assign each workout to the days it should land on. Leave days empty for rest or flexibility.</SectionBody>
              {workouts.length === 0 ? (
                <EmptyState>Create workouts first.</EmptyState>
              ) : (
                <WeekScheduleEditor
                  workouts={workouts.map((workout) => ({ id: workout.dayTypeId, name: workout.name }))}
                  assignmentsByDay={scheduleByDay}
                  selectedWorkoutId={selectedWorkout?.dayTypeId ?? null}
                  onSelectWorkout={(workoutId) =>
                    setSelectedWorkoutTempId(workouts.find((workout) => workout.dayTypeId === workoutId)?.tempId ?? null)
                  }
                  isLoading={scheduleSlotsQuery.isLoading}
                  disabled={!programId}
                  onAssignDay={(dayIndex, dayTypeId) => {
                    const slot = scheduleSlots.find((item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1));
                    setScheduleByDay((current) => ({ ...current, [dayIndex]: dayTypeId }));
                    upsertSlot.mutate({
                      id: slot?.id,
                      dayTypeId,
                      weekNumber: mode === 'block' ? 1 : null,
                      dayIndex,
                      sortOrder: dayIndex,
                    });
                  }}
                  onClearDay={(dayIndex) => {
                    const slot = scheduleSlots.find((item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1));
                    if (slot) removeSlot.mutate(slot.id);
                    setScheduleByDay((current) => ({ ...current, [dayIndex]: null }));
                  }}
                />
              )}
            </>
          ) : null}

          <Footer>
            <Row>
              <Button variant="tertiary" onClick={goToEditor}>Switch to full editor</Button>
              {currentStep > 0 ? (
                <Button variant="secondary" onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}>
                  <ArrowLeft size={16} /> Back
                </Button>
              ) : null}
            </Row>
            <Row>
              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={() => {
                    if (currentStep === 0) {
                      void handleProgramNext();
                    } else if (currentStep === 1 && canContinueFromWorkouts) {
                      setCurrentStep(2);
                    } else if (currentStep === 2 && canContinueFromExercises) {
                      setCurrentStep(3);
                    }
                  }}
                  disabled={
                    (currentStep === 0 && (!canContinueFromProgram || createProgram.isPending || patchProgram.isPending)) ||
                    (currentStep === 1 && !canContinueFromWorkouts) ||
                    (currentStep === 2 && !canContinueFromExercises)
                  }
                >
                  Next <ArrowRight size={16} />
                </Button>
              ) : (
                <Button onClick={goToEditor} disabled={!programId || !hasSchedule}>
                  Finish in full editor <Sparkles size={16} />
                </Button>
              )}
            </Row>
          </Footer>
        </StepCard>

        <AsideCard>
          <SectionTitle>What you’ve built</SectionTitle>
          <CompactSummary>
            <Small>
              {[Boolean(programId), workouts.length > 0, canContinueFromExercises, hasSchedule].filter(Boolean).length} of 4 steps complete
            </Small>
          </CompactSummary>
          <MobileDetails>
            <summary style={{ cursor: 'pointer', display: 'block' }}>
              <Small style={{ display: 'inline' }}>Show details</Small>
            </summary>
            <FullSummary>
              <SummaryList>
                <div>
                  <strong>Program</strong>
                  <div><Small>{programId ? programName : 'Not created yet'}</Small></div>
                </div>
                <div>
                  <strong>Mode</strong>
                  <div><Small>{mode === 'perpetual' ? 'Repeats weekly' : 'Block / cycle'}</Small></div>
                </div>
                <div>
                  <strong>Workouts</strong>
                  <div><Small>{workouts.length === 0 ? 'None yet' : workouts.map((workout) => workout.name).join(', ')}</Small></div>
                </div>
                <div>
                  <strong>Exercises added</strong>
                  <div><Small>{exerciseCounts.map((item) => `${item.workout.name}: ${item.count}`).join(' · ') || 'None yet'}</Small></div>
                </div>
                <div>
                  <strong>Scheduled days</strong>
                  <div>
                    <Small>
                      {Object.entries(scheduleByDay)
                        .filter(([, value]) => Boolean(value))
                        .map(([dayIndex, dayTypeId]) => `${dayNames[Number(dayIndex)]}: ${workouts.find((workout) => workout.dayTypeId === dayTypeId)?.name}`)
                        .join(' · ') || 'No days assigned yet'}
                    </Small>
                  </div>
                </div>
              </SummaryList>
              <SectionBody>The wizard covers the common first-program path. Use the full editor for advanced notes, planned sets, reordering, and more complex schedules.</SectionBody>
            </FullSummary>
          </MobileDetails>
        </AsideCard>
      </Grid>

      {editState ? (
        <ExerciseEditModal
          state={editState}
          deleteLabel="Remove"
          onClose={() => setEditState(null)}
          onSave={(next) =>
            patchExercise.mutate({
              dayTypeId: next.dayTypeId,
              exerciseId: next.exerciseId,
              body: { prescription: next.prescription, notes: next.notes || null },
            })
          }
          onDelete={() => {
            const target = (selectedWorkoutDetail.data?.exercises ?? []).find((item) => item.id === editState.exerciseId);
            setEditState(null);
            if (target) removeExercise.mutate(target);
          }}
        />
      ) : null}

      {addExerciseOpen && selectedWorkout ? (
        <AddExercisePicker
          exercises={exercises}
          exercisesLoading={exercisesLoading}
          exercisesError={exercisesError}
          onRetryExercises={refetchExercises}
          onClose={() => setAddExerciseOpen(false)}
          isCreatingExercise={createExercise.isPending}
          onCreateExercise={(name) => createExercise.mutateAsync({ name })}
          isAddingExercise={addExercise.isPending}
          onAddExercise={(exerciseId, prescription) =>
            addExercise.mutate({ dayTypeId: selectedWorkout.dayTypeId, exerciseId, prescription })
          }
        />
      ) : null}
    </Page>
  );
}
