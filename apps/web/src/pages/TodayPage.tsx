import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Dumbbell,
  NotebookText,
  RefreshCw,
  Scale,
  SkipForward,
  Utensils,
  Watch,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing, radius } from '@setline/design-tokens';
import type { DayTypeExercise, Exercise, WorkoutSession, WorkoutSessionDetail } from '@setline/schemas';
import { typeScale } from '../theme/typeScale';
import { mq } from '../theme/breakpoints';
import {
  AsyncStatusIndicator,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Select,
  useAsyncStatus,
  useToast,
} from '../components';
import { useApiClient } from '../lib/api-client';
import { summarizePrescription } from '../lib/prescription';

interface DashboardSessionSummary {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  templateId: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

interface DashboardTodayResponse {
  localDate: string;
  sessions: DashboardSessionSummary[];
  manualEntry: {
    localDate: string;
    morningWeightValue: number | null;
    morningWeightUnit: 'lb' | 'kg' | null;
    notes: string | null;
    mood: number | null;
    preWorkoutMealLogged: boolean | null;
  } | null;
  activitySummary: {
    activeEnergyKcal?: string | null;
    exerciseMinutes?: number | null;
    appleMoveTimeMinutes?: number | null;
    syncedThrough?: string | null;
    updatedAt?: string | null;
  } | null;
  nutritionSnapshot: {
    caloriesKcal?: string | null;
    syncedThrough?: string | null;
    updatedAt?: string | null;
  } | null;
  syncState: {
    status?: 'ok' | 'syncing' | 'error' | 'needs_attention' | 'never_synced';
    lastSuccessfulSyncAt?: string | null;
    lastAttemptAt?: string | null;
    latestCompleteLocalDate?: string | null;
  } | null;
  weekLabel: string | null;
  dayLabel: string | null;
  dayTypeId: string | null;
  estimatedDurationMinutes: number | null;
  scheduleSource?: 'override' | 'program' | 'none';
  override?: {
    id: string;
    date: string;
    dayTypeId: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface DailyManualEntryPatch {
  morningWeightValue?: number | null;
  morningWeightUnit?: 'lb' | 'kg' | null;
  notes?: string | null;
  mood?: number | null;
  preWorkoutMealLogged?: boolean | null;
}

type TodayWorkoutState = 'no-program' | 'unscheduled' | 'scheduled' | 'in-progress';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing[24]}px;

  ${mq.desktop} {
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    align-items: start;
  }
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;
const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
`;
const Eyebrow = styled.span`
  font-size: ${typeScale.label.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${typeScale.pageTitle.fontSize}px;
`;
const Subtitle = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.body.fontSize}px;
`;
const RitualCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[16]}px;
`;
const WorkoutCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${spacing[12]}px;
  border-color: ${(p) => p.theme.action.primary};
  background: ${(p) => p.theme.action.accentSubtle};
`;
const WorkoutCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
`;
const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;
const StepRow = styled.div<{ $passive?: boolean }>`
  display: flex;
  gap: ${spacing[12]}px;
  align-items: flex-start;
  opacity: ${(p) => (p.$passive ? 0.9 : 1)};
`;
const StepContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing[8]}px;
`;
const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
  flex-wrap: wrap;
`;
const StepTitle = styled.h3`
  margin: 0;
  font-size: ${typeScale.sectionTitle.fontSize}px;
`;
const StepBody = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
`;
const Divider = styled.hr`
  margin: 0;
  border: none;
  border-top: 1px solid ${(p) => p.theme.border.subtle};
`;
const InlineRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
  align-items: center;
`;
const FieldRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 220px) auto;
  gap: ${spacing[8]}px;
  align-items: end;

`;
const NotesArea = styled.textarea`
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border: 1px solid ${(p) => p.theme.border.default};
  border-radius: ${radius.small}px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  padding: ${spacing[12]}px;
  font: inherit;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.action.primary};
    outline-offset: 2px;
  }
`;
const MoodRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing[8]}px;
`;
const MoodButton = styled.button<{ $selected: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: ${radius.full}px;
  border: 1px solid ${(p) => (p.$selected ? p.theme.action.primary : p.theme.border.default)};
  background: ${(p) => (p.$selected ? p.theme.action.accentSubtle : p.theme.surface.raised)};
  cursor: pointer;
  font-size: 20px;
`;
const PassiveChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${spacing[4]}px;
  border-radius: ${radius.full}px;
  background: ${(p) => p.theme.surface.sunken};
  padding: ${spacing[4]}px ${spacing[12]}px;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.caption.fontSize}px;
`;
const MetaList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${spacing[8]}px;
`;
const MetaTile = styled.div`
  border: 1px solid ${(p) => p.theme.border.subtle};
  border-radius: ${radius.small}px;
  padding: ${spacing[12]}px;
  background: ${(p) => p.theme.surface.sunken};
`;
const MetaLabel = styled.div`
  font-size: ${typeScale.caption.fontSize}px;
  color: ${(p) => p.theme.text.secondary};
`;
const MetaValue = styled.div`
  font-size: ${typeScale.body.fontSize}px;
  font-weight: 600;
`;
const PreviewExerciseRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]}px;
  padding: ${spacing[8]}px 0;
  border-bottom: 1px solid ${(p) => p.theme.border.subtle};

  &:last-child {
    border-bottom: none;
  }
`;
const PreviewExerciseName = styled.span`
  font-weight: 600;
`;
const PreviewPlan = styled.span`
  color: ${(p) => p.theme.text.secondary};
  font-size: ${typeScale.compactBody.fontSize}px;
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
const StatusBlock = styled.div<{ $tone?: 'default' | 'warning' }>`
  display: flex;
  gap: ${spacing[8]}px;
  align-items: flex-start;
  padding: ${spacing[12]}px;
  border-radius: ${radius.small}px;
  background: ${(p) => (p.$tone === 'warning' ? p.theme.surface.sunken : p.theme.action.accentSubtle)};
  border: 1px solid ${(p) => (p.$tone === 'warning' ? p.theme.border.default : `${p.theme.action.primary}33`)};
`;
const SummaryList = styled.div`
  display: grid;
  gap: ${spacing[8]}px;
`;
const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing[12]}px;
`;
const Muted = styled.span`
  color: ${(p) => p.theme.text.secondary};
`;
const statusCopy = {
  ok: 'Synced',
  syncing: 'Updating health data…',
  error: 'Health sync needs attention',
  needs_attention: 'Health sync needs attention',
  never_synced: 'Not synced yet',
} as const;
const moodOptions = [
  { value: 1, label: 'Awful', emoji: '😫' },
  { value: 2, label: 'Low', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const;

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}
function formatLongDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
function formatTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function formatDateTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
function fetchToday(api: ReturnType<typeof useApiClient>, localDate: string) {
  return api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDate}`);
}
function patchDaily(api: ReturnType<typeof useApiClient>, localDate: string, body: DailyManualEntryPatch) {
  return api.patch('/me/daily-entries/' + localDate, body);
}
function sumCompletedSets(session?: WorkoutSessionDetail | null) {
  if (!session) return 0;
  return session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.reps != null || set.weightValue != null || set.durationSeconds != null || set.distanceValue != null).length, 0);
}
function sumVolume(session?: WorkoutSessionDetail | null) {
  if (!session) return null;
  const total = session.exercises.reduce(
    (sum, exercise) =>
      sum +
      exercise.sets.reduce((setSum, set) => {
        if (set.weightValue == null || set.reps == null || set.weightUnit !== 'lb') return setSum;
        return setSum + set.weightValue * set.reps;
      }, 0),
    0,
  );
  return total > 0 ? Math.round(total) : null;
}

export function TodayPage() {
  const api = useApiClient();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const localDate = todayLocalDate();
  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<{ id: string }[]>('/programs'),
  });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => fetchToday(api, localDate),
  });
  const manual = data?.manualEntry;
  const [weight, setWeight] = useState('');
  const [journal, setJournal] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionDayTypeId, setExceptionDayTypeId] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');
  const [skipOpen, setSkipOpen] = useState(false);
  const weightStatus = useAsyncStatus();
  const journalStatus = useAsyncStatus();
  const mealStatus = useAsyncStatus();

  // Previously this hard-redirected new/wiped accounts straight to the
  // wizard, which meant Today was unreachable until a program existed.
  // Instead, show Today as usual with an inline prompt below.
  const hasNoProgram = Boolean(programsQuery.data && programsQuery.data.length === 0);
  const showProgramSetupPrompt = hasNoProgram && !isError;

  useEffect(() => {
    setWeight(manual?.morningWeightValue?.toString() ?? '');
    setJournal(manual?.notes ?? '');
    setSelectedMood(manual?.mood ?? null);
  }, [manual?.morningWeightValue, manual?.notes, manual?.mood]);

  useEffect(() => {
    if (exceptionOpen) {
      setExceptionDayTypeId(data?.dayTypeId ?? '');
      setExceptionNote(data?.override?.note ?? '');
    }
  }, [exceptionOpen, data?.dayTypeId, data?.override?.note]);

  const saveMutation = useMutation({
    mutationFn: (body: DailyManualEntryPatch) => patchDaily(api, localDate, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
    },
  });

  const retrySave = (body: DailyManualEntryPatch, status: ReturnType<typeof useAsyncStatus>) =>
    status.run(async () => {
      await saveMutation.mutateAsync(body);
    });

  const activeSession = useMemo(
    () => data?.sessions.find((session) => session.status === 'in_progress') ?? null,
    [data?.sessions],
  );
  const completedSession = useMemo(
    () => data?.sessions
      .filter((session) => session.status === 'completed')
      .sort((a, b) => new Date(b.completedAt ?? b.updatedAt ?? 0).getTime() - new Date(a.completedAt ?? a.updatedAt ?? 0).getTime())[0] ?? null,
    [data?.sessions],
  );

  const postWorkoutReviewQuery = useQuery({
    queryKey: ['today-post-workout-review', completedSession?.id],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${completedSession?.id}`),
    enabled: Boolean(completedSession?.id && !activeSession),
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (activeSession?.id) return { id: activeSession.id } as Pick<WorkoutSession, 'id'>;
      return api.post<WorkoutSession>('/workout-sessions', {
        templateId: data?.dayTypeId ?? undefined,
        localDate,
        timezone: localTimezone(),
      });
    },
    onSuccess: (session) => navigate(`/workout/${session.id}`),
    onError: () => toast.show({ variant: 'error', message: 'Could not open workout.', actionLabel: 'Retry now' }),
  });

  const dayTypePreviewQuery = useQuery({
    queryKey: ['day-type-preview', data?.dayTypeId],
    queryFn: () => api.get<{ id: string; name: string; exercises: DayTypeExercise[] }>(`/day-types/${data?.dayTypeId}`),
    enabled: previewOpen && Boolean(data?.dayTypeId),
  });
  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api.get<Exercise[]>('/exercises'),
    enabled: previewOpen || Boolean(completedSession),
  });
  const exerciseNameById = new Map((exercisesQuery.data ?? []).map((e) => [e.id, e.name]));

  const dayTypesQuery = useQuery({
    queryKey: ['day-types'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/day-types'),
    enabled: exceptionOpen,
  });

  const setExceptionMutation = useMutation({
    mutationFn: (body: { dayTypeId: string; note: string | null }) => api.put(`/me/schedule/${localDate}/override`, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      toast.show({ variant: 'success', message: "Today's workout updated." });
      setExceptionOpen(false);
    },
    onError: () => toast.show({ variant: 'error', message: "Couldn't update today's workout.", actionLabel: 'Retry now' }),
  });

  const clearExceptionMutation = useMutation({
    mutationFn: () => api.del(`/me/schedule/${localDate}/override`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      toast.show({ variant: 'success', message: "Today's override cleared." });
      setExceptionOpen(false);
      setSkipOpen(false);
    },
    onError: () => toast.show({ variant: 'error', message: "Couldn't clear today's override." }),
  });

  const workoutDone = Boolean(completedSession);
  const mealDone = Boolean(manual?.preWorkoutMealLogged);
  const weightDone = manual?.morningWeightValue != null;
  const journalDone = Boolean((manual?.notes ?? '').trim()) || manual?.mood != null;
  const syncDone = Boolean(data?.activitySummary || data?.nutritionSnapshot || data?.syncState?.lastSuccessfulSyncAt);
  const syncStatus = data?.syncState?.status ?? 'never_synced';
  const completedSteps = [weightDone, journalDone, mealDone, Boolean(activeSession || workoutDone), syncDone].filter(Boolean).length;
  const postWorkoutSets = sumCompletedSets(postWorkoutReviewQuery.data);
  const postWorkoutVolume = sumVolume(postWorkoutReviewQuery.data);
  const todayWorkoutState: TodayWorkoutState = activeSession
    ? 'in-progress'
    : showProgramSetupPrompt
      ? 'no-program'
      : data?.dayTypeId
        ? 'scheduled'
        : 'unscheduled';
  const workoutCardTitle =
    todayWorkoutState === 'no-program'
      ? 'Set up your training'
      : todayWorkoutState === 'in-progress'
        ? 'Workout ready to resume'
        : "Today's workout";
  const workoutCardBody =
    todayWorkoutState === 'no-program'
      ? "Create your first training program to automatically schedule workouts here."
      : todayWorkoutState === 'in-progress'
        ? `You already started this session${formatTime(activeSession?.startedAt) ? ` at ${formatTime(activeSession?.startedAt)}` : ''}. Pick up where you left off.`
        : todayWorkoutState === 'scheduled'
          ? `${data?.weekLabel ?? 'Scheduled'} · ${data?.dayLabel}${data?.scheduleSource === 'override' ? ' · changed for today' : ''}`
          : 'No workout scheduled yet. Choose a workout for today or adjust today’s plan without changing your recurring schedule.';
  const showWorkoutDuration = todayWorkoutState !== 'no-program' && Boolean(data?.estimatedDurationMinutes);

  return (
    <>
      <Grid>
        <Stack>
          <Header>
            <Eyebrow>{data ? formatLongDate(data.localDate) : formatLongDate(localDate)}</Eyebrow>
            <Title>Today</Title>
            <Subtitle>Keep the morning quick, then move straight into today’s training.</Subtitle>
          </Header>

          {showProgramSetupPrompt || (!isLoading && !isError) ? (
            <WorkoutCard>
              <WorkoutCardHeader>
                <SectionTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Dumbbell size={18} />
                  {workoutCardTitle}
                </SectionTitle>
                {showWorkoutDuration ? <PassiveChip>~{data?.estimatedDurationMinutes} min</PassiveChip> : null}
              </WorkoutCardHeader>
              <StepBody>{workoutCardBody}</StepBody>
              {todayWorkoutState !== 'no-program' && data?.override?.note ? <PassiveChip>{data.override.note}</PassiveChip> : null}
              <InlineRow>
                {todayWorkoutState === 'no-program' ? (
                  <Button onClick={() => navigate('/training/new')}>Start guided setup</Button>
                ) : null}
                {todayWorkoutState === 'in-progress' ? (
                  <Button disabled={startWorkoutMutation.isPending} onClick={() => startWorkoutMutation.mutate()}>
                    Resume workout
                  </Button>
                ) : null}
                {todayWorkoutState === 'scheduled' ? (
                  <>
                    <Button disabled={startWorkoutMutation.isPending} onClick={() => startWorkoutMutation.mutate()}>
                      Start workout
                    </Button>
                    <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
                      Preview
                    </Button>
                    <Button variant="secondary" onClick={() => setExceptionOpen(true)}>
                      Change today&apos;s workout
                    </Button>
                    <Button variant="tertiary" onClick={() => setSkipOpen(true)}>
                      Skip today
                    </Button>
                  </>
                ) : null}
                {todayWorkoutState === 'unscheduled' ? (
                  <Button variant="secondary" onClick={() => setExceptionOpen(true)}>
                    Choose workout
                  </Button>
                ) : null}
              </InlineRow>
            </WorkoutCard>
          ) : null}

          <RitualCard>
            {isLoading ? (
              <span>Loading…</span>
            ) : isError ? (
              <StatusBlock $tone="warning">
                <AlertCircle size={18} />
                <StepBody>Couldn’t load Today. Refresh and try again.</StepBody>
              </StatusBlock>
            ) : (
              <>
                <StepRow>
                  {weightDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  <StepContent>
                    <StepHeader>
                      <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Scale size={18} /> Morning weight
                      </StepTitle>
                      {weightDone ? <PassiveChip>{manual?.morningWeightValue} {manual?.morningWeightUnit ?? 'lb'}</PassiveChip> : null}
                    </StepHeader>
                    <StepBody>One quick weigh-in to anchor the day.</StepBody>
                    <FieldRow>
                      <Input label="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" unit={manual?.morningWeightUnit ?? 'lb'} />
                      <Button
                        onClick={() => retrySave(
                          { morningWeightValue: weight ? Number(weight) : null, morningWeightUnit: manual?.morningWeightUnit ?? 'lb' },
                          weightStatus,
                        )}
                        disabled={saveMutation.isPending}
                      >
                        Save
                      </Button>
                    </FieldRow>
                    <AsyncStatusIndicator
                      status={weightStatus.status}
                      onRetry={() =>
                        retrySave(
                          { morningWeightValue: weight ? Number(weight) : null, morningWeightUnit: manual?.morningWeightUnit ?? 'lb' },
                          weightStatus,
                        )}
                    />
                  </StepContent>
                </StepRow>
                <Divider />
                <StepRow>
                  {journalDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  <StepContent>
                    <StepHeader>
                      <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <NotebookText size={18} /> Mood + journal
                      </StepTitle>
                      {selectedMood ? <PassiveChip>{moodOptions.find((m) => m.value === selectedMood)?.label}</PassiveChip> : null}
                    </StepHeader>
                    <StepBody>Just enough context for energy, soreness, sleep, or anything worth remembering later.</StepBody>
                    <MoodRow>
                      {moodOptions.map((m) => (
                        <MoodButton
                          key={m.value}
                          $selected={selectedMood === m.value}
                          aria-label={m.label}
                          aria-pressed={selectedMood === m.value}
                          onClick={() => setSelectedMood(selectedMood === m.value ? null : m.value)}
                        >
                          {m.emoji}
                        </MoodButton>
                      ))}
                    </MoodRow>
                    <NotesArea
                      value={journal}
                      onChange={(e) => setJournal(e.target.value)}
                      placeholder="Energy, soreness, sleep, stress, or anything to remember after the workout."
                    />
                    <InlineRow>
                      <Button
                        onClick={() => retrySave({ notes: journal || null, mood: selectedMood }, journalStatus)}
                        disabled={saveMutation.isPending}
                      >
                        Save journal
                      </Button>
                      <AsyncStatusIndicator
                        status={journalStatus.status}
                        onRetry={() => retrySave({ notes: journal || null, mood: selectedMood }, journalStatus)}
                      />
                    </InlineRow>
                  </StepContent>
                </StepRow>
                <Divider />
                <StepRow>
                  {mealDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  <StepContent>
                    <StepHeader>
                      <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Utensils size={18} /> Nutrition check
                      </StepTitle>
                      {mealDone ? <PassiveChip>Confirmed</PassiveChip> : null}
                    </StepHeader>
                    <StepBody>No macro entry here — just confirm the meal/logging step happened.</StepBody>
                    <InlineRow>
                      <Checkbox
                        checked={mealDone}
                        onChange={(e) => retrySave({ preWorkoutMealLogged: e.target.checked }, mealStatus)}
                        label="Done in MyFitnessPal"
                      />
                      <AsyncStatusIndicator
                        status={mealStatus.status}
                        onRetry={() => retrySave({ preWorkoutMealLogged: !mealDone }, mealStatus)}
                      />
                    </InlineRow>
                  </StepContent>
                </StepRow>
                <Divider />
                <StepRow $passive>
                  {syncDone ? <CheckCircle2 size={22} /> : <RefreshCw size={22} />}
                  <StepContent>
                    <StepHeader>
                      <StepTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Watch size={18} /> Apple Health sync
                      </StepTitle>
                      <PassiveChip>{statusCopy[syncStatus] ?? 'Synced'}</PassiveChip>
                    </StepHeader>
                    <StepBody>
                      {syncStatus === 'syncing'
                        ? 'Setline is currently reconciling your latest health data.'
                        : syncStatus === 'never_synced'
                          ? 'Connect and sync Apple Health after training so Today and Progress stay current.'
                          : 'Passive step — your watch fills this in after training.'}
                    </StepBody>
                    <MetaList>
                      <MetaTile>
                        <MetaLabel>Last successful sync</MetaLabel>
                        <MetaValue>{formatDateTime(data?.syncState?.lastSuccessfulSyncAt) ?? '—'}</MetaValue>
                      </MetaTile>
                      <MetaTile>
                        <MetaLabel>Activity minutes</MetaLabel>
                        <MetaValue>{data?.activitySummary?.exerciseMinutes ?? data?.activitySummary?.appleMoveTimeMinutes ?? '—'}</MetaValue>
                      </MetaTile>
                      <MetaTile>
                        <MetaLabel>Active kcal</MetaLabel>
                        <MetaValue>{data?.activitySummary?.activeEnergyKcal ? Math.round(Number(data.activitySummary.activeEnergyKcal)) : '—'}</MetaValue>
                      </MetaTile>
                      <MetaTile>
                        <MetaLabel>Nutrition kcal</MetaLabel>
                        <MetaValue>{data?.nutritionSnapshot?.caloriesKcal ? Math.round(Number(data.nutritionSnapshot.caloriesKcal)) : '—'}</MetaValue>
                      </MetaTile>
                    </MetaList>
                  </StepContent>
                </StepRow>
              </>
            )}
          </RitualCard>
        </Stack>

        <Stack>
          <Card>
            <SectionTitle style={{ marginBottom: 8 }}>Today summary</SectionTitle>
            <StepBody>{completedSteps} of 5 steps complete.</StepBody>
            <MetaList>
              <MetaTile>
                <MetaLabel>Weight</MetaLabel>
                <MetaValue>{manual?.morningWeightValue ?? '—'} {manual?.morningWeightUnit ?? ''}</MetaValue>
              </MetaTile>
              <MetaTile>
                <MetaLabel>Mood</MetaLabel>
                <MetaValue>{selectedMood ? moodOptions.find((m) => m.value === selectedMood)?.emoji : '—'}</MetaValue>
              </MetaTile>
              <MetaTile>
                <MetaLabel>Workout</MetaLabel>
                <MetaValue>{activeSession ? 'In progress' : data?.dayLabel ?? 'Rest / none'}</MetaValue>
              </MetaTile>
            </MetaList>
          </Card>

          {data?.scheduleSource === 'override' ? (
            <Card>
              <SectionTitle style={{ marginBottom: 8 }}>Today-only exception</SectionTitle>
              <SummaryList>
                <SummaryRow>
                  <span>{data.dayLabel ?? 'Workout changed'}</span>
                  <PassiveChip>Doesn’t change the program</PassiveChip>
                </SummaryRow>
                {data.override?.note ? <Muted>{data.override.note}</Muted> : null}
                <InlineRow>
                  <Button variant="secondary" onClick={() => setExceptionOpen(true)}>
                    Edit override
                  </Button>
                  <Button variant="secondary" onClick={() => clearExceptionMutation.mutate()} disabled={clearExceptionMutation.isPending}>
                    Restore scheduled workout
                  </Button>
                </InlineRow>
              </SummaryList>
            </Card>
          ) : null}

          {!activeSession && completedSession ? (
            <Card>
              <SectionTitle style={{ marginBottom: 8 }}>Post-workout review</SectionTitle>
              {postWorkoutReviewQuery.isLoading ? <StepBody>Loading workout summary…</StepBody> : null}
              {postWorkoutReviewQuery.data ? (
                <SummaryList>
                  <StepBody>
                    Workout complete{formatTime(completedSession.completedAt) ? ` at ${formatTime(completedSession.completedAt)}` : ''}.
                  </StepBody>
                  <MetaList>
                    <MetaTile>
                      <MetaLabel>Exercises</MetaLabel>
                      <MetaValue>{postWorkoutReviewQuery.data.exercises.length}</MetaValue>
                    </MetaTile>
                    <MetaTile>
                      <MetaLabel>Sets logged</MetaLabel>
                      <MetaValue>{postWorkoutSets}</MetaValue>
                    </MetaTile>
                    <MetaTile>
                      <MetaLabel>Total volume</MetaLabel>
                      <MetaValue>{postWorkoutVolume ? `${postWorkoutVolume} lb` : '—'}</MetaValue>
                    </MetaTile>
                  </MetaList>
                  <Button variant="secondary" onClick={() => navigate(`/workout/${completedSession.id}`)}>
                    Review completed workout
                  </Button>
                </SummaryList>
              ) : null}
            </Card>
          ) : null}
        </Stack>
      </Grid>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={dayTypePreviewQuery.data?.name ?? "Today's plan"}
        description="Planned exercises — nothing is logged until you start the workout."
      >
        {dayTypePreviewQuery.isLoading ? <StepBody>Loading plan…</StepBody> : null}
        {dayTypePreviewQuery.data?.exercises.length === 0 ? <StepBody>No exercises added to this workout yet.</StepBody> : null}
        {dayTypePreviewQuery.data?.exercises.map((ex) => (
          <PreviewExerciseRow key={ex.id}>
            <PreviewExerciseName>{exerciseNameById.get(ex.exerciseId) ?? 'Exercise'}</PreviewExerciseName>
            <PreviewPlan>{summarizePrescription(ex.prescription)}</PreviewPlan>
          </PreviewExerciseRow>
        ))}
        <Button onClick={() => setPreviewOpen(false)}>Close</Button>
      </Modal>

      <Modal
        open={exceptionOpen}
        onClose={() => setExceptionOpen(false)}
        title="Swap today's workout"
        description="This changes today only. Your recurring schedule stays untouched."
      >
        <Select
          label="Workout"
          value={exceptionDayTypeId}
          onChange={(e) => setExceptionDayTypeId(e.target.value)}
          options={[
            { value: '', label: 'Select a workout' },
            ...(dayTypesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
          ]}
        />
        <TextArea
          value={exceptionNote}
          onChange={(e) => setExceptionNote(e.target.value)}
          placeholder="Travel, fatigue, equipment change, extra conditioning…"
        />
        <InlineRow>
          <Button
            onClick={() =>
              exceptionDayTypeId &&
              setExceptionMutation.mutate({ dayTypeId: exceptionDayTypeId, note: exceptionNote || null })
            }
            disabled={!exceptionDayTypeId || setExceptionMutation.isPending}
          >
            Save today&apos;s swap
          </Button>
          {data?.override ? (
            <Button variant="secondary" onClick={() => clearExceptionMutation.mutate()} disabled={clearExceptionMutation.isPending}>
              Remove override
            </Button>
          ) : null}
        </InlineRow>
      </Modal>

      <Modal
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        title="Skip today’s workout"
        description="Keep the program intact and mark today as intentionally different."
      >
        <StepBody>
          If you’re resting, traveling, or just need a break, you can swap today to another workout now and come back tomorrow without rewriting the program.
        </StepBody>
        <InlineRow>
          <Button onClick={() => { setSkipOpen(false); setExceptionOpen(true); }}>
            Swap instead
          </Button>
          {data?.override ? (
            <Button variant="secondary" onClick={() => clearExceptionMutation.mutate()} disabled={clearExceptionMutation.isPending}>
              Restore schedule
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setSkipOpen(false)}>
              Got it
            </Button>
          )}
        </InlineRow>
        <StatusBlock $tone="warning">
          <SkipForward size={18} />
          <StepBody>There is not yet a dedicated “skip without replacement” API, so this flow keeps today lightweight without altering the recurring program.</StepBody>
        </StatusBlock>
      </Modal>
    </>
  );
}
