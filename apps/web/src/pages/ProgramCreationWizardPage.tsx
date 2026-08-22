import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing, radius } from '@setframe/design-tokens';
import type { DayType, DayTypeExercise, Exercise, Prescription, ProgramScheduleSlot, TrainingProgram } from '@setframe/schemas';
import { Button, Card, Input, Select, Stepper, useToast } from '../components';
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
const prescriptionOptions = [
  { value: 'sets_reps', label: 'Sets + reps' },
  { value: 'timed', label: 'Timed sets' },
  { value: 'duration', label: 'Duration' },
  { value: 'distanceDuration', label: 'Distance + duration' },
  { value: 'distance', label: 'Distance' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
];
const steps = [
  { key: 'program', title: 'Program', description: 'Name it and choose how it repeats.' },
  { key: 'workouts', title: 'Workouts', description: 'Create your first workout templates.' },
  { key: 'exercises', title: 'Exercises', description: 'Add the main exercises for each workout.' },
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

const WorkoutCard = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: ${spacing[16]}px;
  border-radius: ${radius.large}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
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
  flex-direction: column;
  gap: ${spacing[8]}px;
`;

const ScheduleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: ${spacing[8]}px;
`;

const DayCard = styled.div<{ $active: boolean }>`
  border-radius: ${radius.large}px;
  border: 1px solid ${(p) => (p.$active ? p.theme.action.primary : p.theme.border.subtle)};
  background: ${(p) => (p.$active ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  padding: ${spacing[12]}px;
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
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

function emptyPrescription(kind: string): Prescription {
  switch (kind) {
    case 'timed':
      return { kind: 'timed', sets: 3, durationSeconds: 60 };
    case 'duration':
      return { kind: 'duration', durationMinutes: 30 };
    case 'distanceDuration':
      return { kind: 'distanceDuration', distanceMiles: 3, durationMinutes: 30 };
    case 'distance':
      return { kind: 'distance', sets: 1, distanceValue: 1, distanceUnit: 'mi' };
    case 'bodyweight_reps':
      return { kind: 'bodyweight_reps', sets: 3, repsMin: 8 };
    default:
      return { kind: 'sets_reps', sets: 3, repsMin: 8 };
  }
}

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
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [prescriptionKind, setPrescriptionKind] = useState('sets_reps');
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, string | null>>({});

  const { data: programs } = useQuery({ queryKey: ['programs'], queryFn: () => api.get<TrainingProgram[]>('/programs') });
  const { data: exercises = [] } = useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/exercises') });
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

  const createExercise = useMutation({
    mutationFn: (body: { name: string }) => api.post<Exercise>('/exercises', body),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setSelectedExerciseId(created.id);
      setCustomExerciseName('');
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
      </Header>

      <Stepper steps={steps} currentStep={currentStep} />

      <Grid>
        <StepCard>
          {currentStep === 0 ? (
            <>
              <SectionTitle>1. Start with the program</SectionTitle>
              <SectionBody>Name the program and choose whether it repeats every week or runs as a simple block.</SectionBody>
              <Input label="Program name" value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Fall strength block" />
              <Select label="Program mode" value={mode} onChange={(e) => setMode(e.target.value as 'perpetual' | 'block')} options={modeOptions} />
            </>
          ) : null}

          {currentStep === 1 ? (
            <>
              <SectionTitle>2. Create your first workouts</SectionTitle>
              <SectionBody>Think of these as reusable workout templates like Upper A, Lower B, Walk, or Mobility.</SectionBody>
              <Row style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <Input label="Workout name" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Upper A" />
                </div>
                <Button onClick={() => workoutName.trim() && createDayType.mutate({ name: workoutName.trim() })} disabled={!workoutName.trim() || createDayType.isPending}>
                  <Plus size={16} /> Add workout
                </Button>
              </Row>
              <Stack>
                {workouts.length === 0 ? <EmptyState>No workouts yet. Add at least one to continue.</EmptyState> : null}
                {workouts.map((workout) => (
                  <WorkoutCard key={workout.tempId} type="button" $active={selectedWorkoutTempId === workout.tempId} onClick={() => setSelectedWorkoutTempId(workout.tempId)}>
                    <strong>{workout.name}</strong>
                    <div>
                      <Small>{selectedWorkoutTempId === workout.tempId ? 'Selected for the next step' : 'Ready for exercises'}</Small>
                    </div>
                  </WorkoutCard>
                ))}
              </Stack>
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <SectionTitle>3. Add exercises</SectionTitle>
              <SectionBody>Pick one workout at a time and add its core exercises with a simple prescription.</SectionBody>
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
                      <Row style={{ alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <Select
                            label="Exercise"
                            value={selectedExerciseId}
                            onChange={(e) => setSelectedExerciseId(e.target.value)}
                            options={[
                              { value: '', label: 'Select exercise' },
                              ...exercises.map((exercise) => ({
                                value: exercise.id,
                                label: exercise.isCustom ? `${exercise.name} (custom)` : exercise.name,
                              })),
                            ]}
                          />
                        </div>
                        <div style={{ minWidth: 180 }}>
                          <Select label="Prescription" value={prescriptionKind} onChange={(e) => setPrescriptionKind(e.target.value)} options={prescriptionOptions} />
                        </div>
                      </Row>
                      <Row style={{ alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <Input label="Need a custom exercise?" value={customExerciseName} onChange={(e) => setCustomExerciseName(e.target.value)} placeholder="Cable face pull" />
                        </div>
                        <Button variant="secondary" onClick={() => customExerciseName.trim() && createExercise.mutate({ name: customExerciseName.trim() })} disabled={!customExerciseName.trim() || createExercise.isPending}>
                          <Plus size={16} /> Create exercise
                        </Button>
                      </Row>
                      <Button
                        onClick={() =>
                          selectedExerciseId &&
                          addExercise.mutate({
                            dayTypeId: selectedWorkout.dayTypeId,
                            exerciseId: selectedExerciseId,
                            prescription: emptyPrescription(prescriptionKind),
                          })
                        }
                        disabled={!selectedExerciseId || addExercise.isPending}
                      >
                        <Plus size={16} /> Add to {selectedWorkout.name}
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
                                <strong>{exercises.find((item) => item.id === exercise.exerciseId)?.name ?? 'Exercise'}</strong>
                                <Small>{summarizePrescription(exercise.prescription)}</Small>
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
                <ScheduleGrid>
                  {dayNames.map((dayName, dayIndex) => {
                    const assignedDayTypeId = scheduleByDay[dayIndex] ?? '';
                    const assignedWorkout = workouts.find((workout) => workout.dayTypeId === assignedDayTypeId) ?? null;
                    const slot = scheduleSlots.find((item) => item.dayIndex === dayIndex && (item.weekNumber === null || item.weekNumber === 1));

                    return (
                      <DayCard key={dayName} $active={Boolean(assignedWorkout)}>
                        <strong>{dayName}</strong>
                        <Small>{assignedWorkout?.name ?? 'Rest / unassigned'}</Small>
                        <Select
                          label="Workout"
                          value={assignedDayTypeId}
                          onChange={(e) => {
                            const nextDayTypeId = e.target.value;
                            if (!nextDayTypeId) {
                              if (slot) removeSlot.mutate(slot.id);
                              setScheduleByDay((current) => ({ ...current, [dayIndex]: null }));
                              return;
                            }

                            setScheduleByDay((current) => ({ ...current, [dayIndex]: nextDayTypeId }));
                            upsertSlot.mutate({
                              id: slot?.id,
                              dayTypeId: nextDayTypeId,
                              weekNumber: mode === 'block' ? 1 : null,
                              dayIndex,
                              sortOrder: dayIndex,
                            });
                          }}
                          options={[{ value: '', label: 'Unassigned' }, ...workouts.map((workout) => ({ value: workout.dayTypeId, label: workout.name }))]}
                        />
                      </DayCard>
                    );
                  })}
                </ScheduleGrid>
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
    </Page>
  );
}
