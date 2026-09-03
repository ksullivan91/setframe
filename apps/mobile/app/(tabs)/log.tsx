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
  Dumbbell,
  Moon,
  NotebookText,
  Scale,
  UserRound,
  Utensils,
} from 'lucide-react-native';
import { Card } from '../../src/components/Card';
import { LogHeader } from '../../src/components/log/LogHeader';
import { LogWeekStrip } from '../../src/components/log/LogWeekStrip';
import { LogHero, type LogHeroState, type LogHeroProps } from '../../src/components/log/LogHero';
import { releaseSplash, SPLASH_MAX_MS } from '../../src/lib/appReady';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { SyncStatusPill, type SyncStatus } from '../../src/components/SyncStatusPill';
import { Checkbox } from '../../src/components/Checkbox';
import { Skeleton, SkeletonStack } from '../../src/components/Skeleton';
import { Toast } from '../../src/components/Toast';
import {
  TodayAdditionalActivitySection,
  additionalActivitiesQuery,
} from '../../src/components/TodayAdditionalActivitySection';
import {
  addDays,
  buildCompletedSessionReadout,
  buildLogWeek,
  startOfWeek,
  visibleSessionExercises,
} from '@setframe/domain';
import { ApiError, useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { useHealthConnection } from '../../src/healthkit/useHealthConnection';
import { AppleHealthCard } from '../../src/components/AppleHealthCard';
import { useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing, typeScale } from '../../src/theme/getTheme';
import type { WorkoutSessionDetail } from '@setframe/schemas';
import { useActionFeedback } from '../../src/lib/useActionFeedback';

interface DashboardSessionSummary {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  templateId: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

interface DashboardTodayResponse {
  /** HealthKit ids already attached to one of the day's sessions, so the
   *  Additional Activity block never offers a workout that is already
   *  recorded against a workout. */
  attachedWatchExternalIds?: string[];
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
  notes?: string | null;
  mood?: number | null;
  preWorkoutMealLogged?: boolean | null;
}

type TodayWorkoutState = LogHeroState;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const moodOptions = [
  { value: 1, label: 'Awful', emoji: '😫' },
  { value: 2, label: 'Low', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const;


function formatShortDate(localDate: string) {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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

/**
 * Today's completed-workout numbers, from the shared readout.
 *
 * These were computed here in local copies, and the volume one diverged:
 * it required `weightUnit === 'lb'`, but the logger never sends a unit and
 * the API stores null, so every set was discarded and the card showed no
 * volume while Review Workout — which uses this readout — showed the real
 * figure. The session screen's own comment says these numbers "must not
 * differ by platform"; they were differing by *screen*.
 */
function completedReadout(session?: WorkoutSessionDetail | null) {
  if (!session) return null;
  return buildCompletedSessionReadout(visibleSessionExercises(session.exercises));
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
  const feedback = useActionFeedback();
  const theme = useTheme();
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const today = useLocalDate();
  /* The screen is about a date, not about today (ADR 0013). Today is only
     the default; everything below keys off `localDate` exactly as before,
     so a past date re-reads the whole screen rather than patching it. */
  const [localDate, setLocalDate] = useState(today);
  /* If the app is open across local midnight, the default must move with it
     — but only when the user has not navigated away from today themselves. */
  const previousTodayRef = useRef(today);
  useEffect(() => {
    if (previousTodayRef.current !== today) {
      setLocalDate((current) => (current === previousTodayRef.current ? today : current));
      previousTodayRef.current = today;
    }
  }, [today]);
  const isToday = localDate === today;
  const isPast = localDate < today;
  const topPadding = useScreenTopPadding();
  const [weight, setWeight] = useState('');
  const [journal, setJournal] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const health = useHealthConnection();
  const [weightStatus, setWeightStatus] = useState<SaveState>('idle');
  const [journalStatus, setJournalStatus] = useState<SaveState>('idle');
  const [mealStatus, setMealStatus] = useState<SaveState>('idle');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const initialHydratedRef = useRef(false);
  const hydratedLocalDateRef = useRef<string | null>(null);
  const lastSavedSectionRef = useRef<'weight' | 'journal' | 'meal' | null>(null);

  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: () => api.get<{ id: string; isActive: boolean }[]>('/programs'),
  });

  /* The strip needs seven days at once. `progress/overview` already returns a
     sparse per-day rollup, and `/v1/rest-days` takes a range as of story 76,
     so this is two requests rather than seven dashboard round trips. */
  const weekStart = startOfWeek(localDate);
  const weekEnd = addDays(weekStart, 6);
  const weekQuery = useQuery({
    queryKey: ['log-week', weekStart],
    queryFn: async () => {
      const [overview, rest] = await Promise.all([
        api.get<{ training: { days: { localDate: string; completedCount: number }[] } }>(
          '/progress/overview?weeks=8',
        ),
        api.get<{ localDate: string }[]>(`/rest-days?from=${weekStart}&to=${weekEnd}`),
      ]);
      return {
        trainedDates: overview.training.days.filter((d) => d.completedCount > 0).map((d) => d.localDate),
        restDates: rest.map((r) => r.localDate),
      };
    },
  });

  const weekDays = useMemo(
    () =>
      buildLogWeek({
        selectedDate: localDate,
        today,
        trainedDates: weekQuery.data?.trainedDates ?? [],
        restDates: weekQuery.data?.restDates ?? [],
      }),
    [localDate, today, weekQuery.data],
  );

  /* Only to distinguish "your plan is empty" from "nothing today". Cheap,
     cached, and the picker on Training reads the same key. */
  const dayTypesQuery = useQuery({
    queryKey: ['day-types'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/day-types'),
  });
  const hasNoWorkouts = Boolean(dayTypesQuery.data && dayTypesQuery.data.length === 0);

  const todayQuery = useQuery({
    queryKey: ['today', localDate],
    queryFn: () => api.get<DashboardTodayResponse>(`/dashboard/today?localDate=${localDate}`),
  });

  /* Subscribed here purely so "has Today finished loading?" can account for
     it. React Query dedupes on the key, so this shares the request the
     section below makes rather than issuing a second one. */
  const additionalActivities = useQuery(additionalActivitiesQuery(api, localDate));
  /* Every panel on this screen waits for this one flag. Previously each
     decided for itself, so Additional activity — which fetches separately —
     drew its finished card above a check-in card still full of blanks. */
  /* Declared before the queries it reads so the skeleton branch below can
     use it; the value is computed from them further down. */
  const isPageLoading = todayQuery.isLoading || additionalActivities.isLoading;

  const manual = todayQuery.data?.manualEntry;

  useEffect(() => {
    if (!manual) return;
    // Full re-hydration on first load AND whenever the local calendar date
    // changes (e.g. the app was left open/backgrounded across midnight) —
    // without this, a rolled-over day's empty state never overwrites the
    // previous day's still-displayed weight/journal input values
    // (Story 07: stale local-date carryover).
    if (!initialHydratedRef.current || hydratedLocalDateRef.current !== localDate) {
      setWeight(manual.morningWeightValue?.toString() ?? '');
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
    onSuccess: async (session) => {
      /* Refresh Today before navigating. This screen stays mounted behind
         the pushed logger, and its own dedup guard above reads
         `sessions.find(status === 'in_progress')` from this cache — so a
         stale copy means a second "Start workout" press does not see the
         session that was just created and POSTs another one, duplicating
         the workout and deleting that date's `rest_day`. Nothing else
         refreshes it: the app never wires react-query's focusManager. */
      await queryClient.invalidateQueries({ queryKey: ['today', localDate] });
      /* Hand the logger the session id explicitly rather than letting it
         re-derive one. A session-scoped screen working out its own subject
         is what produced both the duplicate-session bug (it guessed wrong
         and created another) and the dead end that followed (it guessed
         nothing and showed an empty state). The logger now requires this
         id and cannot create a session at all. */
      router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
    },
  
    onError: feedback.report('Could not start the workout. Try again.'),
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
    section: 'weight' | 'journal' | 'meal',
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

  // Story 24: must also catch "programs exist but none is active" (e.g.
  // after archiving the only active one), not just "zero programs" —
  // mirrors the same fix on web's TodayPage.
  const hasNoProgram = Boolean(programsQuery.data && programsQuery.data.length === 0);
  const hasNoActiveProgram = Boolean(programsQuery.data && !programsQuery.data.some((p) => p.isActive));
  const showProgramSetupPrompt = hasNoActiveProgram && !programsQuery.isLoading;
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
  const completedReadoutValue = completedReadout(completedSummaryQuery.data);
  const completedVolume = completedReadoutValue?.totalVolume ?? 0;
  const completedSets = completedReadoutValue?.loggedSetCount ?? 0;

  /* The card cannot render truthfully until the summary behind it has
     landed. `completedSummaryQuery` cannot even START until the dashboard
     names a completed session, so the two resolve in sequence — which is
     why the card was seen going "Review workout", then "Review workout"
     with its tiles a beat later. Waiting on the pair collapses that into
     one render. */
  const awaitingCompletedSummary =
    Boolean(completedSession?.id) && !activeSession && completedSummaryQuery.isPending;

  /* One gate for the whole screen. Everything the check-in card asserts —
     whether a workout happened, and what it came to — has to be known
     before any of it is drawn, or the card states a different thing on
     each pass. */
  const showSkeleton = isPageLoading || awaitingCompletedSummary;

  /* And the launch screen stays up until that is true, so the logo covers
     the resolution rather than the user watching it happen. Capped: a held
     splash and a hung app look identical from outside. */
  useEffect(() => {
    if (!showSkeleton) {
      releaseSplash();
      return;
    }
    const timer = setTimeout(releaseSplash, SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, [showSkeleton]);

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
            /* "No workouts at all" and "nothing on this date" are different
               problems with different fixes. Collapsed together, the screen
               offered "Choose workout" to someone with none to choose. */
            : hasNoWorkouts
              ? 'program-empty'
              : 'unscheduled';

  const completedDuration = formatTime(completedSession?.completedAt)
    ? `finished ${formatTime(completedSession?.completedAt)}`
    : null;
  const completedStats: LogHeroProps['stats'] = [
    { value: String(completedSets), label: 'sets' },
    { value: completedVolume ? completedVolume.toLocaleString('en-US') : '—', label: 'volume lb' },
    { value: String(completedReadoutValue?.personalRecordCount ?? 0), label: 'PRs', highlight: (completedReadoutValue?.personalRecordCount ?? 0) > 0 },
  ];
  /* The design shows "6 of 14 sets logged", but /dashboard/today returns no
     planned set count for a running session — only the logger knows it.
     Omitted rather than guessed; the hero renders without the bar. */
  const activeSetProgress = undefined;

  const restPrompt = (
    <View style={styles.restPrompt}>
      <Text style={[styles.restPromptTitle, { color: theme.inverse.text }]}>Need a day off?</Text>
      <Text style={[styles.restPromptBody, { color: theme.inverse.textMuted }]}>
        Logging a rest day keeps the record honest without changing your program or breaking your
        consistency.
      </Text>
    </View>
  );

  const heroProps: LogHeroProps = useMemo(() => {
    const dayName = todayQuery.data?.dayLabel ?? 'Training';
    /* The design splits the title across two lines, the second in the accent.
       "Upper Body — Push" is the shape day types take, so the em dash is the
       natural break; anything without one keeps a single line. */
    const [head, tail] = dayName.includes(' — ') ? dayName.split(' — ') : [dayName, undefined];
    /* The design shows the day's exercises as chips, but /dashboard/today
       returns only the day type's id, name and duration — the exercise list
       would need a join it does not do. Left out rather than faked; the hero
       renders without chips. */

    switch (todayWorkoutState) {
      case 'in-progress':
        return {
          state: 'in-progress',
          eyebrow: 'IN PROGRESS',
          title: head!,
          titleAccent: tail,
          primary: {
            label: 'Resume workout',
            testID: 'resume-workout',
            loading: startWorkoutMutation.isPending,
            onPress: () => startWorkoutMutation.mutate(),
          },
        };
      case 'completed':
        return {
          state: 'completed',
          eyebrow: isToday ? 'DONE TODAY' : 'WHAT YOU DID',
          chip: completedDuration ?? undefined,
          title: head!,
          titleAccent: tail,
          stats: completedStats,
          primary: completedSession
            ? {
                label: 'Review workout',
                onPress: () => router.push(`/workout/${completedSession.id}`),
              }
            : undefined,
        };
      case 'rested':
        return {
          state: 'rested',
          eyebrow: 'REST DAY',
          chip: 'Logged',
          /* A rested day is a closed training step, not an open one — the
             badge is what says so at a glance. */
          doneBadge: (
            <View testID="workout-done-badge" style={[styles.doneBadge, { backgroundColor: theme.inverse.raised }]}>
              <Moon size={16} strokeWidth={2.5} color={theme.inverse.success} />
            </View>
          ),
          title: 'Rest day',
          body: 'Recovery is training. A rest day will not count against your training — it keeps the record honest without breaking your consistency.',
          primary: isPast
            ? undefined
            : { label: 'Train anyway', onPress: () => startWorkoutMutation.mutate() },
          secondary: { label: 'Undo rest day', testID: 'undo-rest-day', onPress: () => undoRestDayMutation.mutate() },
        };
      case 'no-program':
        return {
          state: 'no-program',
          eyebrow: 'NO PLAN YET',
          title: 'Nothing scheduled',
          body: 'Set up a plan and Log will know what comes next. It takes about two minutes, and you can change all of it later.',
          primary: { label: 'Set up my training', testID: 'start-guided-setup', onPress: () => router.push('/guided-setup') },
          secondary: { label: 'Just start a workout', onPress: () => startWorkoutMutation.mutate() },
        };
      case 'program-empty':
        return {
          state: 'program-empty',
          eyebrow: 'YOUR PLAN',
          chip: 'No workouts',
          title: 'Your plan is empty',
          body: 'The plan exists but has no workouts in it yet. Add one and it can start landing on your week.',
          primary: { label: 'Add a workout', testID: 'add-a-workout', onPress: () => router.push('/(tabs)/training') },
          secondary: { label: 'Just start a workout', onPress: () => startWorkoutMutation.mutate() },
        };
      case 'unscheduled':
        return {
          state: 'unscheduled',
          eyebrow: 'NOTHING ON THE SCHEDULE',
          title: 'Your call today',
          body: 'This is not a training day in your plan. Pick a workout anyway, or take the day.',
          primary: { label: 'Choose a workout', testID: 'choose-workout', onPress: () => router.push('/(tabs)/training') },
          secondary: isPast
            ? undefined
            : { label: 'Take a rest day', testID: 'mark-rest-day', onPress: () => markRestDayMutation.mutate() },
          footer: isPast ? undefined : restPrompt,
        };
      case 'scheduled':
      default:
        return {
          state: 'scheduled',
          eyebrow: isToday ? 'TODAY’S TRAINING' : 'PLANNED',
          chip: todayQuery.data?.estimatedDurationMinutes ? `~${todayQuery.data.estimatedDurationMinutes} min` : undefined,
          title: head!,
          titleAccent: tail,
          primary: {
            label: 'Start workout',
            testID: 'start-workout',
            loading: startWorkoutMutation.isPending,
            onPress: () => startWorkoutMutation.mutate(),
          },
          secondary: isPast
            ? undefined
            : { label: 'Take a rest day', testID: 'mark-rest-day', onPress: () => markRestDayMutation.mutate() },
          footer: isPast ? undefined : restPrompt,
        };
    }
  }, [
    todayWorkoutState,
    todayQuery.data,
    isToday,
    isPast,
    completedSession,
    completedStats,
    completedDuration,
    startWorkoutMutation,
    markRestDayMutation,
    undoRestDayMutation,
    router,
    restPrompt,
    theme,
  ]);

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
      ? hasNoProgram
        ? 'Create your first training program to automatically schedule workouts here.'
        : "You have programs, but none is set active. Choose one to drive Today's schedule."
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
  const journalDone = Boolean((manual?.notes ?? '').trim()) || manual?.mood != null;
  /* Story 44 — the day's logged sessions, so a Watch recording of one is
     not offered back as "additional" activity. Abandoned sessions are
     excluded: nothing was really trained, so a workout over that window is
     a genuine separate activity. */
  const loggedSessions = useMemo(
    () =>
      (todayQuery.data?.sessions ?? [])
        .filter((session) => session.status !== 'abandoned')
        .map((session) => ({
          label: todayQuery.data?.dayLabel ?? 'workout',
          startedAt: session.startedAt ?? null,
          completedAt: session.completedAt ?? null,
        })),
    [todayQuery.data?.sessions, todayQuery.data?.dayLabel],
  );

  const syncedNutritionKcal = todayQuery.data?.nutritionSnapshot?.caloriesKcal
    ? Math.round(Number(todayQuery.data.nutritionSnapshot.caloriesKcal))
    : null;
  /* Nutrition is the one ritual step we can now observe rather than ask
     about. When a tracker has written food to Apple Health for today, the
     step is satisfied as a matter of fact, so the checkbox — which exists
     only to record what we could not otherwise know — steps aside.

     Derived, never written: copying an imported value into the manual
     `preWorkoutMealLogged` flag would be exactly the silent overwrite
     docs/architecture.md §4 rules out, and it would strand a value in our
     DB that no longer matches its source. */
  const nutritionKcal = health.metrics.caloriesConsumedKcal ?? syncedNutritionKcal;
  const nutritionObserved =
    nutritionKcal != null ||
    health.metrics.proteinG != null ||
    health.metrics.carbsG != null ||
    health.metrics.fatG != null;
  const mealDone = nutritionObserved || Boolean(manual?.preWorkoutMealLogged);
  /* The header pill must never make a health-access claim.
     It reads the SERVER's sync state, which stays "never synced" until the
     device posts a reconcile payload — and nothing does that yet. So it
     rendered "Health access needed" indefinitely, including while the card
     directly below it was happily showing Apple Health data.

     My first attempt suppressed it only when the card was ALSO warning,
     which got it exactly backwards: that is the one case where the two
     agreed. The pill stayed visible precisely when it was most wrong.

     Access is the card's story, because the card is the only thing that
     can do anything about it. This pill now says one of: refreshing,
     up to date, or nothing at all. */
  const headerPillStatus: SyncStatus | null = todayQuery.isFetching
    ? 'syncing'
    : health.state === 'connected'
      ? 'synced'
      : health.state === 'unavailable' && todayQuery.data?.syncState?.lastSuccessfulSyncAt
        ? 'synced'
        : null;

  const dateLabel = formatLongDate(todayQuery.data?.localDate ?? localDate);
  /* The server's reconciled snapshot for today. HealthKit wins where the
     device has a live reading (architecture §4 makes it authoritative), but
     this is what a previous sync — possibly from another device — already
     stored, and the card falls back to it per metric. There is no server
     step count today, so that one is device-only. */
  const syncedMetrics = {
    steps: null,
    activeEnergyKcal: todayQuery.data?.activitySummary?.activeEnergyKcal
      ? Math.round(Number(todayQuery.data.activitySummary.activeEnergyKcal))
      : null,
    exerciseMinutes:
      todayQuery.data?.activitySummary?.exerciseMinutes ??
      todayQuery.data?.activitySummary?.appleMoveTimeMinutes ??
      null,
    caloriesConsumedKcal: syncedNutritionKcal,
    // The server snapshot does not carry macros yet, so these are
    // device-only until the reconcile payload grows to include them.
    proteinG: null,
    carbsG: null,
    fatG: null,
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
    >
      <LogHeader
        title={isToday ? 'Today' : formatShortDate(localDate)}
        dateLabel={dateLabel}
        onPressAccount={() => router.push('/settings')}
        status={headerPillStatus ? <SyncStatusPill status={headerPillStatus} /> : null}
      />
      <LogWeekStrip
        days={weekDays}
        onSelect={(date) => {
          /* A future date holds nothing and can be given nothing, so the
             strip shows it but will not travel to it. */
          if (date <= today) setLocalDate(date);
        }}
      />
      {todayQuery.dataUpdatedAt ? (
        <Text style={[styles.helperText, { color: theme.text.secondary }]}>Last updated {formatDateTime(new Date(todayQuery.dataUpdatedAt).toISOString())}</Text>
      ) : null}

      {showSkeleton || programsQuery.isLoading ? (
        <View style={[styles.heroSkeleton, { backgroundColor: theme.surface.sunken }]}>
          <ActivityIndicator color={theme.action.primary} />
        </View>
      ) : todayQuery.isError ? (
        <View style={[styles.statusBlock, { backgroundColor: theme.surface.sunken, borderColor: theme.border.default }]}>
          <AlertTriangle size={18} color={theme.status.caution} />
          <Text style={[styles.bodyText, { color: theme.text.secondary }]}>Couldn’t load this day. Pull to refresh and try again.</Text>
        </View>
      ) : (
        <LogHero {...heroProps} />
      )}

      {/* Story 41 — available on training, recovery, rest, and no-program
          days alike; deliberately outside every todayWorkoutState branch
          above.

          Held back until the screen has loaded. It owns its own query, so it
          used to paint its finished card above content that had not arrived.
          Not gated on the dashboard's error state: its data is independent,
          so a failed Today should not take a working feature down with it. */}
      {!showSkeleton ? (
        <TodayAdditionalActivitySection
          localDate={localDate}
          sessions={loggedSessions}
          attachedWatchExternalIds={todayQuery.data?.attachedWatchExternalIds ?? []}
        />
      ) : null}

      {toast ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}

      {/* One loading state for the screen, matching web. Previously these
          cards rendered immediately with every value blank, which reads as
          "you have logged nothing today" rather than "this is still
          loading" — a meaningfully wrong message on a check-in screen. */}
      {showSkeleton ? (
        <Card>
          <SkeletonStack gap={16}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.stepRow}>
                <Skeleton rounded height={22} width={22} />
                <View style={styles.stepContent}>
                  <Skeleton width="40%" height={16} />
                  <Skeleton width="70%" height={13} />
                </View>
              </View>
            ))}
          </SkeletonStack>
        </Card>
      ) : (
      <>
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
            {isPast ? (
              <Text style={[styles.bodyText, { color: theme.text.secondary }]}>
                {weightDone ? 'Recorded on the day.' : 'Nothing was recorded.'}
              </Text>
            ) : (
              <>
                <Text style={[styles.bodyText, { color: theme.text.secondary }]}>One quick weigh-in to anchor the day.</Text>
                <Input label="Weight" value={weight} onChangeText={(value) => { setWeight(value); setWeightError(null); if (weightStatus === 'error') setWeightStatus('idle'); }} numeric unit={manual?.morningWeightUnit ?? 'lb'} errorMessage={weightError ?? undefined} />
                <Button label="Save weight" variant="secondary" loading={weightStatus === 'saving'} onPress={saveWeight} />
                <SaveFeedback state={weightStatus} errorMessage={weightError} />
              </>
            )}
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
                    disabled={isPast}
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
            {isPast ? (
              <Text style={[styles.bodyText, { color: theme.text.secondary }]}>
                {journal ? journal : 'Nothing was written.'}
              </Text>
            ) : (
              <>
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
              </>
            )}
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
            {nutritionObserved ? (
              <>
                <Text style={[styles.bodyText, { color: theme.text.secondary }]}>
                  Already logged — Apple Health has today&apos;s food.
                </Text>
                <Text testID="nutrition-observed" style={[styles.helperText, { color: theme.text.secondary }]}>
                  {[
                    nutritionKcal != null ? `${nutritionKcal.toLocaleString()} cal` : null,
                    health.metrics.proteinG != null ? `${health.metrics.proteinG} g protein` : null,
                    health.nutritionSource,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.bodyText, { color: theme.text.secondary }]}>No macro entry here — just confirm the meal/logging step happened.</Text>
                <View style={styles.checkboxRow}>
                  <Checkbox checked={mealDone} onChange={(checked) => void saveSection({ preWorkoutMealLogged: checked }, setMealStatus, 'meal')} />
                  <Text style={[styles.bodyText, { color: theme.text.primary }]}>Logged in my nutrition app</Text>
                </View>
                <SaveFeedback state={mealStatus} />
              </>
            )}
          </View>
        </View>
      </Card>

      {/* Replaces the old "Apple Health sync" card, which described a
          connection the user had no way to make: nothing in the app had
          ever called requestAuthorization(). See
          docs/design/health-connection-flow.md. */}
      <AppleHealthCard connection={health} fallback={syncedMetrics} />
      </>
      )}
      {feedback.node}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  /* 44 is the iOS minimum touch target; this is the only way to reach
     Settings now that it has left the tab bar. */
  subtitle: {
    fontSize: typeScale.body.fontSize,
  },
  sectionTitle: {
    fontSize: typeScale.sectionTitle.fontSize,
    fontWeight: '600',
  },
  doneBadge: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  restPrompt: { gap: 4 },
  restPromptTitle: { fontSize: 13, fontWeight: '600' },
  restPromptBody: { fontSize: 12, lineHeight: 17 },
  heroSkeleton: {
    borderRadius: 16,
    padding: 24,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Story 27 — Rest Day is a deliberate, explained recovery choice, not a
  // second primary CTA next to Start Workout — visually separated below a
  // divider rather than sharing the same button stack.
  restSection: {
    gap: spacing[8],
    marginTop: spacing[4],
    paddingTop: spacing[12],
    borderTopWidth: 1,
  },
  restSectionTitle: {
    fontSize: typeScale.compactBody.fontSize,
    fontWeight: '600',
  },
  restSectionBody: {
    fontSize: typeScale.caption.fontSize,
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
