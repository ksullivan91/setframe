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
import { useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { healthKit, type DailyHealthMetrics } from '../../src/healthkit/HealthKitAdapter';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing, typeScale } from '../../src/theme/getTheme';

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

type TodayWorkoutState = 'no-program' | 'unscheduled' | 'scheduled' | 'in-progress';
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

  const todayWorkoutState: TodayWorkoutState = activeSession
    ? 'in-progress'
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
        : "Today's workout";

  const workoutBody =
    todayWorkoutState === 'no-program'
      ? 'Create your first training program to automatically schedule workouts here.'
      : todayWorkoutState === 'in-progress'
        ? `You already started this session${formatTime(activeSession?.startedAt) ? ` at ${formatTime(activeSession?.startedAt)}` : ''}. Pick up where you left off.`
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

      <Card style={[styles.workoutCard, { borderColor: theme.action.primary, backgroundColor: theme.action.accentSubtle }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Dumbbell size={18} color={theme.text.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>{workoutTitle}</Text>
          </View>
          {todayQuery.data?.estimatedDurationMinutes ? (
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
            <Text style={[styles.bodyText, { color: theme.text.secondary }]}>{workoutBody}</Text>
            {todayQuery.data?.override?.note ? (
              <View style={[styles.chip, { backgroundColor: theme.surface.sunken }]}>
                <Text style={[styles.chipLabel, { color: theme.text.secondary }]}>{todayQuery.data.override.note}</Text>
              </View>
            ) : null}
            <View style={styles.ctaStack}>
              {todayWorkoutState === 'no-program' ? <Button label="Start guided setup" onPress={() => router.push('/program-wizard')} /> : null}
              {todayWorkoutState === 'in-progress' ? <Button label="Resume workout" loading={startWorkoutMutation.isPending} onPress={() => startWorkoutMutation.mutate()} /> : null}
              {todayWorkoutState === 'scheduled' ? (
                <>
                  <Button label="Start workout" loading={startWorkoutMutation.isPending} onPress={() => startWorkoutMutation.mutate()} />
                  <Button label="Preview program" variant="secondary" onPress={() => router.push('/program-editor')} />
                </>
              ) : null}
              {todayWorkoutState === 'unscheduled' ? <Button label="Choose workout" variant="secondary" onPress={() => router.push('/program-editor')} /> : null}
            </View>
          </>
        )}
      </Card>

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

      {completedSession && !activeSession ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Workout complete</Text>
          <Text style={[styles.bodyText, { color: theme.text.secondary }]}>Workout complete{formatTime(completedSession.completedAt) ? ` at ${formatTime(completedSession.completedAt)}` : ''}.</Text>
        </Card>
      ) : null}
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
