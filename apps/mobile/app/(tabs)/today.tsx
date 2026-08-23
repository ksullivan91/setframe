import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  NotebookText,
  RefreshCw,
  Scale,
  Utensils,
  Watch,
} from 'lucide-react-native';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { MetricTile } from '../../src/components/MetricTile';
import { SyncStatusPill, type SyncStatus } from '../../src/components/SyncStatusPill';
import { Checkbox } from '../../src/components/Checkbox';
import { Toast } from '../../src/components/Toast';
import { countsTowardVolume, isSessionSetLogged } from '../../src/lib/prescription';
import { ApiError, useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { healthKit, type DailyHealthMetrics } from '../../src/healthkit/HealthKitAdapter';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing, typeScale } from '../../src/theme/getTheme';
import type { WorkoutSessionDetail } from '@setframe/schemas';

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
    systolicBp: number | null;
    diastolicBp: number | null;
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
    updatedAt?: string;
  } | null;
  restDay?: {
    id: string;
    localDate: string;
    timezone: string;
    note: string | null;
    createdAt: string;
  } | null;
}

interface DailyManualEntryPatch {
  morningWeightValue?: number | null;
  morningWeightUnit?: 'lb' | 'kg' | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  notes?: string | null;
  mood?: number | null;
  preWorkoutMealLogged?: boolean | null;
}

type TodayWorkoutState = 'no-program' | 'unscheduled' | 'scheduled' | 'in-progress' | 'completed' | 'rested';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DashboardSyncStatus = NonNullable<DashboardTodayResponse['syncState']>['status'];

const moodOptions = [
  { value: 1, label: 'Awful', emoji: '😫' },
  { value: 2, label: 'Low', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const;


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

function mapSyncStatus(status?: DashboardSyncStatus): SyncStatus {
  if (status === 'syncing') return 'syncing';
  if (status === 'error' || status === 'needs_attention' || status === 'never_synced') return 'needs_attention';
  return 'synced';
}

function saveStatusLabel(state: SaveState) {
  if (state === 'saving') return 'Saving…';
  if (state === 'saved') return 'Saved';
  if (state === 'error') return 'Could not save';
  return null;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false as const, value: null };
  }
  return { ok: true as const, value: parsed };
}

function parseOptionalInteger(value: string) {
  const parsed = parseOptionalNumber(value);
  if (!parsed.ok || parsed.value == null) return parsed;
  if (!Number.isInteger(parsed.value)) return { ok: false as const, value: null };
  return parsed;
}

function sumCompletedSets(session?: WorkoutSessionDetail | null) {
  if (!session) return 0;
  return session.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets.filter((set) => isSessionSetLogged(exercise.prescription, set)).length,
    0,
  );
}

function sumVolume(session?: WorkoutSessionDetail | null) {
  if (!session) return null;
  // Timed, distance and bodyweight work carries no weight, so it contributes
  // nothing to volume — including it only makes the total look authoritative.
  const total = session.exercises.reduce(
    (sum, exercise) =>
      sum +
      (countsTowardVolume(exercise.prescription)
        ? exercise.sets.reduce((setSum, set) => {
            if (set.weightValue == null || set.reps == null || set.weightUnit !== 'lb') return setSum;
            return setSum + set.weightValue * set.reps;
          }, 0)
        : 0),
    0,
  );
  return total > 0 ? Math.round(total) : null;
}

function StepStatusIcon({ done }: { done: boolean }) {
  const theme = useTheme();
  return done ? <CheckCircle2 size={20} color={theme.status.success} /> : <Circle size={20} color={theme.text.secondary} />;
}

function SaveFeedback({ state, errorMessage }: { state: SaveState; errorMessage?: string | null }) {
  const theme = useTheme();
  const label = errorMessage ?? saveStatusLabel(state);
  if (!label) return null;
  return (
    <View style={styles.saveFeedbackRow}>
      {state === 'saving' ? <ActivityIndicator size="small" color={theme.text.secondary} /> : null}
      <Text
        style={[
          styles.helperText,
          { color: state === 'error' || errorMessage ? theme.status.error : state === 'saved' ? theme.status.success : theme.text.secondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const localDate = useLocalDate();
  const [weight, setWeight] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [journal, setJournal] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<DailyHealthMetrics | null>(null);
  const [weightStatus, setWeightStatus] = useState<SaveState>('idle');
  const [bpStatus, setBpStatus] = useState<SaveState>('idle');
  const [journalStatus, setJournalStatus] = useState<SaveState>('idle');
  const [mealStatus, setMealStatus] = useState<SaveState>('idle');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [bpError, setBpError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const initialHydratedRef = useRef(false);
  const hydratedLocalDateRef = useRef<string | null>(null);
  const lastSavedSectionRef = useRef<'weight' | 'bp' | 'journal' | 'meal' | null>(null);

  useEffect(() => {
    let cancelled = false;
    healthKit.getTodayMetrics().then((result) => {
      if (!cancelled) setHealthMetrics(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<{ id: string }[]>('/programs'),
  });

  const todayQuery = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDate}`),
  });

  const manual = todayQuery.data?.manualEntry;

  useEffect(() => {
    if (!manual) return;
    // Full re-hydration on first load AND whenever the local calendar date
    // changes (e.g. the app was left open/backgrounded across midnight) —
    // without this, a rolled-over day's empty state never overwrites the
    // previous day's still-displayed weight/BP/journal input values
    // (Story 07: stale local-date carryover).
    if (!initialHydratedRef.current || hydratedLocalDateRef.current !== localDate) {
      setWeight(manual.morningWeightValue?.toString() ?? '');
      setSystolic(manual.systolicBp?.toString() ?? '');
      setDiastolic(manual.diastolicBp?.toString() ?? '');
      setJournal(manual.notes ?? '');
      setSelectedMood(manual.mood ?? null);
      initialHydratedRef.current = true;
      hydratedLocalDateRef.current = localDate;
      return;
    }

    switch (lastSavedSectionRef.current) {
      case 'weight':
        setWeight(manual.morningWeightValue?.toString() ?? '');
        break;
      case 'bp':
        setSystolic(manual.systolicBp?.toString() ?? '');
        setDiastolic(manual.diastolicBp?.toString() ?? '');
        break;
      case 'journal':
        setJournal(manual.notes ?? '');
        setSelectedMood(manual.mood ?? null);
        break;
      default:
        break;
    }
    lastSavedSectionRef.current = null;
  }, [manual, localDate]);

  const saveMutation = useMutation({
    mutationFn: (body: DailyManualEntryPatch) => api.patch('/me/daily-entries/' + localDate, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
    },
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      const activeSession = todayQuery.data?.sessions.find((session) => session.status === 'in_progress');
      if (activeSession?.id) return { id: activeSession.id };
      return api.post<{ id: string }>('/workout-sessions', {
        templateId: todayQuery.data?.dayTypeId ?? undefined,
        localDate,
        timezone: localTimezone(),
      });
    },
    onSuccess: () => {
      router.push('/(tabs)/training');
    },
  });

  const markRestDayMutation = useMutation({
    mutationFn: () =>
      api.post('/rest-days', {
        localDate,
        timezone: localTimezone(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      setToast({ variant: 'success', message: 'Rest day logged. Recovery counts.' });
    },
    onError: (error) => {
      setToast({
        variant: 'error',
        message:
          error instanceof ApiError && error.status === 409
            ? "Today already has a workout, so it can't be a rest day."
            : "Couldn't log today as a rest day.",
      });
    },
  });

  const undoRestDayMutation = useMutation({
    mutationFn: () => api.del(`/rest-days/${localDate}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      setToast({ variant: 'success', message: 'Rest day removed.' });
    },
    onError: () => setToast({ variant: 'error', message: "Couldn't undo today's rest day." }),
  });

  async function saveSection(
    body: DailyManualEntryPatch,
    setStatus: (status: SaveState) => void,
    section: 'weight' | 'bp' | 'journal' | 'meal',
  ) {
    setStatus('saving');
    lastSavedSectionRef.current = section;
    try {
      await saveMutation.mutateAsync(body);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1600);
    } catch {
      lastSavedSectionRef.current = null;
      setStatus('error');
    }
  }

  function saveWeight() {
    const parsed = parseOptionalNumber(weight);
    if (!parsed.ok) {
      setWeightError('Enter a valid weight before saving.');
      setWeightStatus('error');
      return;
    }
    setWeightError(null);
    void saveSection(
      {
        morningWeightValue: parsed.value,
        morningWeightUnit: manual?.morningWeightUnit ?? 'lb',
      },
      setWeightStatus,
      'weight',
    );
  }

  function saveBloodPressure() {
    const systolicValue = parseOptionalInteger(systolic);
    const diastolicValue = parseOptionalInteger(diastolic);
    if (!systolicValue.ok || !diastolicValue.ok) {
      setBpError('Use whole numbers for blood pressure.');
      setBpStatus('error');
      return;
    }
    setBpError(null);
    void saveSection(
      {
        systolicBp: systolicValue.value,
        diastolicBp: diastolicValue.value,
      },
      setBpStatus,
      'bp',
    );
  }

  const hasNoProgram = Boolean(programsQuery.data && programsQuery.data.length === 0);
  const showProgramSetupPrompt = hasNoProgram && !programsQuery.isLoading;
  const activeSession = useMemo(
    () => todayQuery.data?.sessions.find((session) => session.status === 'in_progress') ?? null,
    [todayQuery.data?.sessions],
  );
  const completedSession = useMemo(
    () =>
      todayQuery.data?.sessions
        .filter((session) => session.status === 'completed')
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? b.updatedAt ?? 0).getTime() - new Date(a.completedAt ?? a.updatedAt ?? 0).getTime(),
        )[0] ?? null,
    [todayQuery.data?.sessions],
  );

  const completedSummaryQuery = useQuery({
    queryKey: ['today-post-workout-review', completedSession?.id],
    queryFn: () => api.get<WorkoutSessionDetail>(`/workout-sessions/${completedSession?.id}`),
    enabled: Boolean(completedSession?.id && !activeSession),
  });
  const completedSets = sumCompletedSets(completedSummaryQuery.data);
  const completedVolume = sumVolume(completedSummaryQuery.data);

  const restDay = todayQuery.data?.restDay ?? null;
  // A rest day closes out the day's training step: the user made a decision
  // and acted on it, which is the behaviour worth reinforcing.
  // A rest day closes the day out, but an active session supersedes it —
  // otherwise the card would read as done while still offering to resume.
  const workoutDone = Boolean(completedSession) || (Boolean(restDay) && !activeSession);

  const todayWorkoutState: TodayWorkoutState = activeSession
    ? 'in-progress'
    // A completed session for today must win over "not started yet" —
    // otherwise Today would offer Start/Resume for a workout that's
    // already done (Story 06). Mirrors the web fix.
    : completedSession
      ? 'completed'
      // A logged rest day closes the day out. It sits below a real session so
      // training always wins if both somehow exist, and above the schedule so
      // a rested day stops advertising a workout.
      : restDay
        ? 'rested'
        : showProgramSetupPrompt
          ? 'no-program'
          : todayQuery.data?.dayTypeId
            ? 'scheduled'
            : 'unscheduled';

  const workoutTitle =
    todayWorkoutState === 'no-program'
      ? 'Set up your training'
      : todayWorkoutState === 'in-progress'
        ? 'Workout ready to resume'
        : todayWorkoutState === 'completed'
          ? 'Workout complete!'
          : todayWorkoutState === 'rested'
            ? 'Rest day'
            : "Today's workout";

  const workoutBody =
    todayWorkoutState === 'no-program'
      ? 'Create your first training program to automatically schedule workouts here.'
      : todayWorkoutState === 'in-progress'
        ? `You already started this session${formatTime(activeSession?.startedAt) ? ` at ${formatTime(activeSession?.startedAt)}` : ''}. Pick up where you left off.`
        : todayWorkoutState === 'completed'
          ? `Nice work — that's today's training done${formatTime(completedSession?.completedAt) ? `, finished at ${formatTime(completedSession?.completedAt)}` : ''}.`
          : todayWorkoutState === 'rested'
            ? 'Today is a rest day. Recovery is when the work you have already done turns into progress — this will not count against your training.'
            : todayWorkoutState === 'scheduled'
              ? `${todayQuery.data?.weekLabel ?? 'Scheduled'} · ${todayQuery.data?.dayLabel}${todayQuery.data?.scheduleSource === 'override' ? ' · changed for today' : ''}`
              : 'No workout scheduled yet. Choose a workout for today or adjust today’s plan without changing your recurring schedule.';

  const weightDone = manual?.morningWeightValue != null;
  const bpDone = manual?.systolicBp != null || manual?.diastolicBp != null;
  const journalDone = Boolean((manual?.notes ?? '').trim()) || manual?.mood != null;
  const mealDone = Boolean(manual?.preWorkoutMealLogged);
  const syncPillStatus = todayQuery.isFetching ? 'syncing' : mapSyncStatus(todayQuery.data?.syncState?.status);
  const syncDone = Boolean(
    todayQuery.data?.activitySummary || todayQuery.data?.nutritionSnapshot || todayQuery.data?.syncState?.lastSuccessfulSyncAt,
  );

  const dateLabel = formatLongDate(todayQuery.data?.localDate ?? localDate);
  const activityMinutes = todayQuery.data?.activitySummary?.exerciseMinutes ?? todayQuery.data?.activitySummary?.appleMoveTimeMinutes;
  const activeCalories = todayQuery.data?.activitySummary?.activeEnergyKcal
    ? Math.round(Number(todayQuery.data.activitySummary.activeEnergyKcal))
    : healthMetrics?.activeEnergyKcal ?? null;
  const nutritionCalories = todayQuery.data?.nutritionSnapshot?.caloriesKcal
    ? Math.round(Number(todayQuery.data.nutritionSnapshot.caloriesKcal))
    : healthMetrics?.caloriesConsumedKcal ?? null;

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.eyebrow, { color: theme.text.secondary }]}>{dateLabel}</Text>
          <Text style={[styles.title, { color: theme.text.primary }]}>Today</Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Keep the morning quick, then move straight into today’s training.</Text>
        </View>
        <SyncStatusPill status={syncPillStatus} />
      </View>
      {todayQuery.dataUpdatedAt ? (
        <Text style={[styles.helperText, { color: theme.text.secondary }]}>Last updated {formatDateTime(new Date(todayQuery.dataUpdatedAt).toISOString())}</Text>
      ) : null}

      <Card
        testID={`workout-card-${todayWorkoutState}`}
        style={[
          styles.workoutCard,
          todayWorkoutState === 'completed'
            ? { borderColor: `${theme.status.success}66`, backgroundColor: `${theme.status.success}1F` }
            : todayWorkoutState === 'rested'
              ? { borderColor: `${theme.status.success}66`, backgroundColor: `${theme.status.success}14` }
              : { borderColor: theme.action.primary, backgroundColor: theme.action.accentSubtle },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            {todayWorkoutState === 'completed' ? (
              <View testID="workout-done-badge" style={[styles.completionBadge, { backgroundColor: theme.surface.raised }]}>
                <CheckCircle2 size={24} strokeWidth={2.5} color={theme.status.success} />
              </View>
            ) : todayWorkoutState === 'rested' ? (
              <View testID="workout-done-badge" style={[styles.completionBadge, { backgroundColor: theme.surface.raised }]}>
                <Moon size={22} strokeWidth={2.5} color={theme.status.success} />
              </View>
            ) : (
              <Dumbbell size={18} color={theme.text.primary} />
            )}
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{workoutTitle}</Text>
          </View>
          {todayQuery.data?.estimatedDurationMinutes &&
          todayWorkoutState !== 'completed' &&
          todayWorkoutState !== 'rested' ? (
            <View style={[styles.chip, { backgroundColor: theme.surface.sunken }]}>
              <Text style={[styles.chipLabel, { color: theme.text.secondary }]}>~{todayQuery.data.estimatedDurationMinutes} min</Text>
            </View>
          ) : null}
        </View>
        {todayQuery.isLoading || programsQuery.isLoading ? <ActivityIndicator color={theme.action.primary} /> : null}
        {todayQuery.isError ? (
          <View style={[styles.statusBlock, { backgroundColor: theme.surface.sunken, borderColor: theme.border.default }]}>
            <AlertTriangle size={18} color={theme.status.caution} />
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>Couldn’t load Today. Pull to refresh and try again.</Text>
          </View>
        ) : (
          <>
            <Text testID="workout-body" style={[styles.bodyText, { color: theme.text.secondary }]}>{workoutBody}</Text>
            {todayQuery.data?.override?.note &&
            todayWorkoutState !== 'completed' &&
            todayWorkoutState !== 'rested' ? (
              <View style={[styles.chip, { backgroundColor: theme.surface.sunken }]}>
                <Text style={[styles.chipLabel, { color: theme.text.secondary }]}>{todayQuery.data.override.note}</Text>
              </View>
            ) : null}
            {todayWorkoutState === 'completed' && completedSummaryQuery.data ? (
              <View style={styles.completedStatRow}>
                {[
                  { label: 'Exercises', value: String(completedSummaryQuery.data.exercises.length) },
                  { label: 'Sets logged', value: String(completedSets) },
                  { label: 'Total volume', value: completedVolume ? String(completedVolume) : '—', unit: completedVolume ? 'lb' : undefined },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={[
                      styles.completedStatTile,
                      { borderColor: `${theme.status.success}33`, backgroundColor: theme.surface.raised },
                    ]}
                  >
                    <Text style={[styles.chipLabel, { color: theme.text.secondary }]}>{stat.label}</Text>
                    <Text
                      style={[styles.completedStatValue, { color: theme.status.success }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {stat.value}
                      {stat.unit ? <Text style={styles.completedStatUnit}>{stat.unit}</Text> : null}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.ctaStack}>
              {todayWorkoutState === 'no-program' ? <Button label="Start guided setup" onPress={() => router.push('/program-wizard')} /> : null}
              {todayWorkoutState === 'in-progress' ? <Button label="Resume workout" loading={startWorkoutMutation.isPending} onPress={() => startWorkoutMutation.mutate()} /> : null}
              {todayWorkoutState === 'completed' && completedSession ? (
                <Button
                  label="Review workout"
                  onPress={() => router.push({ pathname: '/session-summary', params: { sessionId: completedSession.id } })}
                />
              ) : null}
              {todayWorkoutState === 'scheduled' ? (
                <>
                  <Button label="Start workout" loading={startWorkoutMutation.isPending} onPress={() => startWorkoutMutation.mutate()} />
                  <Button label="Preview program" variant="secondary" onPress={() => router.push('/program-editor')} />
                  <Button
                    label="Rest day"
                    variant="success"
                    testID="mark-rest-day"
                    loading={markRestDayMutation.isPending}
                    onPress={() => markRestDayMutation.mutate()}
                  />
                </>
              ) : null}
              {todayWorkoutState === 'unscheduled' ? (
                <>
                  <Button label="Choose workout" testID="choose-workout" onPress={() => router.push('/program-editor')} />
                  <Button
                    label="Mark as rest day"
                    variant="success"
                    testID="mark-rest-day"
                    loading={markRestDayMutation.isPending}
                    onPress={() => markRestDayMutation.mutate()}
                  />
                </>
              ) : null}
              {todayWorkoutState === 'rested' ? (
                <Button
                  label="Undo rest day"
                  variant="secondary"
                  testID="undo-rest-day"
                  loading={undoRestDayMutation.isPending}
                  onPress={() => undoRestDayMutation.mutate()}
                />
              ) : null}
            </View>
          </>
        )}
      </Card>

      {toast ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Today&apos;s check-in</Text>

        <View style={styles.stepRow}>
          <StepStatusIcon done={weightDone} />
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.titleWithIcon}>
                <Scale size={18} color={theme.text.primary} />
                <Text style={[styles.stepTitle, { color: theme.text.primary }]}>Morning weight</Text>
              </View>
              {weightDone ? (
                <View style={[styles.chip, { backgroundColor: theme.surface.sunken }]}>
                  <Text style={[styles.chipLabel, { color: theme.text.secondary }]}>
                    {manual?.morningWeightValue} {manual?.morningWeightUnit ?? 'lb'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>One quick weigh-in to anchor the day.</Text>
            <Input label="Weight" value={weight} onChangeText={(value) => { setWeight(value); setWeightError(null); if (weightStatus === 'error') setWeightStatus('idle'); }} numeric unit={manual?.morningWeightUnit ?? 'lb'} errorMessage={weightError ?? undefined} />
            <Button label="Save weight" variant="secondary" loading={weightStatus === 'saving'} onPress={saveWeight} />
            <SaveFeedback state={weightStatus} errorMessage={weightError} />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

        <View style={styles.stepRow}>
          <StepStatusIcon done={bpDone} />
          <View style={styles.stepContent}>
            <View style={styles.titleWithIcon}>
              <Watch size={18} color={theme.text.primary} />
              <Text style={[styles.stepTitle, { color: theme.text.primary }]}>Blood pressure</Text>
            </View>
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>Optional, but useful when recovery feels off.</Text>
            <View style={styles.bpRow}>
              <View style={styles.bpField}>
                <Input label="Systolic" value={systolic} onChangeText={(value) => { setSystolic(value); setBpError(null); if (bpStatus === 'error') setBpStatus('idle'); }} numeric errorMessage={bpError ?? undefined} />
              </View>
              <View style={styles.bpField}>
                <Input label="Diastolic" value={diastolic} onChangeText={(value) => { setDiastolic(value); setBpError(null); if (bpStatus === 'error') setBpStatus('idle'); }} numeric errorMessage={bpError ?? undefined} />
              </View>
            </View>
            <Button label="Save blood pressure" variant="secondary" loading={bpStatus === 'saving'} onPress={saveBloodPressure} />
            <SaveFeedback state={bpStatus} errorMessage={bpError} />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

        <View style={styles.stepRow}>
          <StepStatusIcon done={journalDone} />
          <View style={styles.stepContent}>
            <View style={styles.titleWithIcon}>
              <NotebookText size={18} color={theme.text.primary} />
              <Text style={[styles.stepTitle, { color: theme.text.primary }]}>Mood + journal</Text>
            </View>
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>Just enough context for energy, soreness, sleep, or anything worth remembering later.</Text>
            <View style={styles.moodRow}>
              {moodOptions.map((mood) => {
                const selected = selectedMood === mood.value;
                return (
                  <Pressable
                    key={mood.value}
                    accessibilityRole="button"
                    accessibilityLabel={mood.label}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMood(selected ? null : mood.value)}
                    style={[
                      styles.moodButton,
                      {
                        borderColor: selected ? theme.action.primary : theme.border.default,
                        backgroundColor: selected ? theme.action.accentSubtle : theme.surface.raised,
                      },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              multiline
              value={journal}
              onChangeText={setJournal}
              placeholder="Energy, soreness, sleep, stress, or anything to remember after the workout."
              placeholderTextColor={theme.text.disabled}
              style={[
                styles.notesArea,
                {
                  color: theme.text.primary,
                  borderColor: theme.border.default,
                  backgroundColor: theme.surface.raised,
                },
              ]}
            />
            <Button label="Save journal" variant="secondary" loading={journalStatus === 'saving'} onPress={() => void saveSection({ notes: journal || null, mood: selectedMood }, setJournalStatus, 'journal')} />
            <SaveFeedback state={journalStatus} />
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />

        <View style={styles.stepRow}>
          <StepStatusIcon done={mealDone} />
          <View style={styles.stepContent}>
            <View style={styles.titleWithIcon}>
              <Utensils size={18} color={theme.text.primary} />
              <Text style={[styles.stepTitle, { color: theme.text.primary }]}>Nutrition check</Text>
            </View>
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>No macro entry here — just confirm the meal/logging step happened.</Text>
            <View style={styles.checkboxRow}>
              <Checkbox checked={mealDone} onChange={(checked) => void saveSection({ preWorkoutMealLogged: checked }, setMealStatus, 'meal')} />
              <Text style={[styles.bodyText, { color: theme.text.primary }]}>Done in MyFitnessPal</Text>
            </View>
            <SaveFeedback state={mealStatus} />
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.stepRow}>
          {syncDone ? <CheckCircle2 size={20} color={theme.status.success} /> : <RefreshCw size={20} color={theme.text.secondary} />}
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.titleWithIcon}>
                <Watch size={18} color={theme.text.primary} />
                <Text style={[styles.stepTitle, { color: theme.text.primary }]}>Apple Health sync</Text>
              </View>
              <SyncStatusPill status={syncPillStatus} />
            </View>
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}> 
              {syncPillStatus === 'syncing'
                ? 'Setframe is currently reconciling your latest health data.'
                : syncPillStatus === 'needs_attention'
                  ? 'Connect and sync Apple Health after training so Today and Progress stay current.'
                  : 'Passive step — your watch fills this in after training.'}
            </Text>
            <View style={styles.metricGrid}>
              <MetricTile label="Steps" value={healthMetrics?.steps != null ? healthMetrics.steps.toLocaleString() : '—'} icon={Footprints} trend={null} />
              <MetricTile label="Active Calories" value={activeCalories != null ? `${activeCalories} kcal` : '—'} icon={Flame} trend={null} />
              <MetricTile label="Exercise Minutes" value={activityMinutes != null ? `${activityMinutes} min` : '—'} icon={Clock} trend={null} />
              <MetricTile label="Calories (MFP)" value={nutritionCalories != null ? `${nutritionCalories} kcal` : '—'} icon={Utensils} trend={null} />
            </View>
            <Text style={[styles.helperText, { color: theme.text.secondary }]}>Last successful sync: {formatDateTime(todayQuery.data?.syncState?.lastSuccessfulSyncAt) ?? '—'}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[12],
  },
  headerTextWrap: {
    flex: 1,
    gap: spacing[4],
  },
  eyebrow: {
    fontSize: typeScale.label.fontSize,
  },
  title: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typeScale.body.fontSize,
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  workoutCard: {
    gap: spacing[12],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing[8],
  },
  completionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedStatRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  completedStatTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.small,
    padding: spacing[12],
    gap: spacing[4],
  },
  completedStatValue: {
    fontSize: typeScale.pageTitle.fontSize,
    fontWeight: '700',
  },
  // Units ride along at label size so a four-digit volume still fits a
  // third-width tile on a narrow phone.
  completedStatUnit: {
    fontSize: typeScale.label.fontSize,
    fontWeight: '600',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    flexShrink: 1,
  },
  bodyText: {
    fontSize: typeScale.compactBody.fontSize,
  },
  ctaStack: {
    gap: spacing[8],
  },
  chip: {
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
    alignSelf: 'flex-start',
  },
  chipLabel: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: '600',
  },
  statusBlock: {
    borderWidth: 1,
    borderRadius: radius.small,
    padding: spacing[12],
    flexDirection: 'row',
    gap: spacing[8],
    alignItems: 'flex-start',
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing[12],
    alignItems: 'flex-start',
  },
  stepContent: {
    flex: 1,
    gap: spacing[8],
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[8],
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  bpRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  bpField: {
    flex: 1,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  moodButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 20,
  },
  notesArea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.small,
    padding: spacing[12],
    fontSize: typeScale.body.fontSize,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  saveFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  helperText: {
    fontSize: typeScale.caption.fontSize,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
});
