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
import { LogEntryRow } from '../../src/components/log/LogEntryRow';
import { DaySignals } from '../../src/components/log/DaySignals';
import { useCloseAbandonedSessions } from '../../src/lib/useCloseAbandonedSessions';
import { JournalSheet, NutritionSheet, WeightSheet } from '../../src/components/log/LogEditSheets';
import { releaseSplash, SPLASH_MAX_MS } from '../../src/lib/appReady';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
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
  sessionHeadlineStats,
  startOfWeek,
  visibleSessionExercises,
} from '@setframe/domain';
import { ApiError, useApiClient } from '../../src/lib/api-client';
import { useLocalDate } from '../../src/lib/useLocalDate';
import { useScreenTopPadding } from '../../src/lib/useScreenInsets';
import { useHealthConnection } from '../../src/healthkit/useHealthConnection';
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
    /* The endpoint returns the whole daily_activity_summary row — its
       response schema is `passthrough()` — and these were simply never
       declared here. Reading them from the device hook instead is what made
       every past day show today's steps and heart rate. */
    steps?: number | null;
    restingHeartRate?: string | null;
    sleepTotalMinutes?: string | null;
    hrvSdnnMs?: string | null;
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

function fmtCount(value: number | null): string {
  return value == null ? '—' : Math.round(value).toLocaleString('en-US');
}

function formatSleep(minutes: unknown): string {
  const value = typeof minutes === 'number' ? minutes : Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `${Math.floor(value / 60)}h ${String(Math.round(value % 60)).padStart(2, '0')}m`;
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
  const [weightSheet, setWeightSheet] = useState(false);
  const [journalSheet, setJournalSheet] = useState(false);
  const [nutritionSheet, setNutritionSheet] = useState(false);
  /* A session left open past its day is closed on the next foreground and
     announced here, rather than making today offer to resume a workout that
     ended yesterday (ADR 0014). */
  const [closedSession, setClosedSession] = useState<{ loggedSetCount: number } | null>(null);
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
      /* Anchored to the week being shown, not to the server's idea of today.
         `/progress/overview` windows N weeks back from `localDate`, which
         defaults to the server's UTC date — so browsing to an older week
         returned a window that did not contain it, and the strip came back
         blank. Two weeks, because the window buckets by week and the
         selected one has to fall wholly inside it. */
      const [trained, rested] = await Promise.allSettled([
        api.get<{ training: { days: { localDate: string; completedCount: number }[] } }>(
          `/progress/overview?weeks=2&localDate=${weekEnd}`,
        ),
        api.get<{ localDate: string }[]>(`/rest-days?from=${weekStart}&to=${weekEnd}`),
      ]);
      /* Settled independently: with Promise.all, `/rest-days` 404ing on an
         API that had not deployed yet took the training marks down with it,
         so a week of finished workouts showed as empty. One source failing
         should cost only its own marks. */
      return {
        trainedDates:
          trained.status === 'fulfilled'
            ? trained.value.training.days.filter((d) => d.completedCount > 0).map((d) => d.localDate)
            : [],
        restDates: rested.status === 'fulfilled' ? rested.value.map((r) => r.localDate) : [],
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

  useCloseAbandonedSessions(api, today, (summary) =>
    setClosedSession({ loggedSetCount: summary.loggedSetCount }),
  );

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

  /**
   * The day's manual entry, saved optimistically.
   *
   * Same contract WorkoutSessionScreenV2 uses: write the value into the
   * cache, keep the previous copy, put it back if the request fails. The
   * value is on screen the moment the user commits — no spinner between
   * typing a number and seeing it.
   */
  const saveMutation = useMutation({
    mutationFn: (body: DailyManualEntryPatch) => api.patch('/me/daily-entries/' + localDate, body),
    onMutate: async (body) => {
      const key = ['today', localDate];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DashboardTodayResponse>(key);
      queryClient.setQueryData<DashboardTodayResponse>(key, (current) =>
        current
          ? {
              ...current,
              manualEntry: {
                localDate,
                morningWeightValue: null,
                morningWeightUnit: null,
                notes: null,
                mood: null,
                preWorkoutMealLogged: null,
                ...(current.manualEntry ?? {}),
                ...body,
              } as DashboardTodayResponse['manualEntry'],
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _body, context) => {
      /* Put back exactly what the server had. A failed save must not leave
         the optimistic value on screen as though it had been written. */
      if (context?.previous) queryClient.setQueryData(['today', localDate], context.previous);
    },
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
            ? "This day already has a workout, so it can’t be a rest day."
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
      /* The journal does not roll back. A set row can, because the number is
         still in the input beside it; a journal entry is prose the user
         typed, and discarding it to match the server destroys the only copy.
         The local `journal` state keeps the text and the row says it is
         unsent. */
      if (section === 'journal' && typeof body.notes === 'string') {
        setJournal(body.notes);
      }
    }
  }

  function saveWeight(raw?: string) {
    const parsed = parseOptionalNumber(raw ?? weight);
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

  /**
   * A past day that holds no session is a fact, not an offer.
   *
   * Every "nothing yet" state — no program, empty plan, unscheduled,
   * scheduled-but-not-started — reads as an invitation to start, and on a
   * past date that meant starting a blank workout on a day that has already
   * happened. There is one honest thing to say about such a day, and one
   * thing still worth changing about it: whether it counted as rest.
   */
  const isPastWithNothing = isPast && !activeSession && !completedSession && !restDay;

  const todayWorkoutState: TodayWorkoutState = isPastWithNothing
    ? 'past-empty'
    : activeSession
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
  /* What the session measured decides what it leads with — a treadmill walk
     has no volume to report and used to headline `0 lb`. */
  const completedStats: LogHeroProps['stats'] = completedReadoutValue
    ? sessionHeadlineStats(completedReadoutValue)
    : undefined;
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
      case 'past-empty':
        return {
          state: 'past-empty',
          eyebrow: 'NOTHING RECORDED',
          title: 'No training',
          body: 'Nothing was logged on this day. If it was a rest day, you can still say so.',
          secondary: {
            label: 'Mark as a rest day',
            testID: 'mark-rest-day',
            onPress: () => markRestDayMutation.mutate(),
          },
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
          /* The one thing a past day can still change (ADR 0013). Marking a
             day you forgot is the whole reason to travel back to it. */
          secondary: {
            label: 'Take a rest day',
            testID: 'mark-rest-day',
            onPress: () => markRestDayMutation.mutate(),
          },
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
          /* The one thing a past day can still change (ADR 0013). Marking a
             day you forgot is the whole reason to travel back to it. */
          secondary: {
            label: 'Take a rest day',
            testID: 'mark-rest-day',
            onPress: () => markRestDayMutation.mutate(),
          },
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
            : "Today’s workout";

  const workoutBody =
    todayWorkoutState === 'no-program'
      ? hasNoProgram
        ? 'Create your first training program to automatically schedule workouts here.'
        : "You have programs, but none is set active. Choose one to drive your schedule."
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

  /* The day's body signals, summarised — depth lives in Trends.
     Sleep and resting heart rate come from the device snapshot: the server's
     activity summary does not carry them yet. */
  /* A HealthKit weight for the same day, shown in the sheet so the user can
     see both. Manual and imported coexist under source precedence — neither
     overwrites the other. */
  const importedWeight = (() => {
    const kg = health.body?.weightKg;
    if (kg == null) return null;
    /* HealthKit stores kilograms; the sheet shows whichever unit the user's
       own entry is in, so convert when that is pounds. */
    const unit = manual?.morningWeightUnit ?? 'lb';
    const value = unit === 'kg' ? kg : kg * 2.20462;
    return String(Math.round(value * 10) / 10);
  })();

  /**
   * The day's body signals.
   *
   * Every value is read for the *selected* date from the server's snapshot.
   * The device hook only ever knows about today, so using it made a past day
   * show today's numbers — and made calories disappear whenever the server
   * had not reconciled yet while the device had the reading.
   *
   * On today the device wins where it has a value, which is architecture §4:
   * HealthKit is authoritative live, the snapshot is what a previous sync
   * stored. On any other date there is only the snapshot.
   */
  const summary = todayQuery.data?.activitySummary;
  const num = (value: unknown): number | null => {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const signal = (device: number | null, stored: unknown): number | null =>
    (isToday ? device ?? num(stored) : num(stored));

  const daySignals = [
    {
      label: 'steps',
      value: fmtCount(signal(health.metrics.steps, summary?.steps)),
    },
    {
      label: 'sleep',
      value: formatSleep(signal(health.recovery.sleepMinutes, summary?.sleepTotalMinutes)),
    },
    {
      label: 'cal',
      value: fmtCount(signal(health.metrics.activeEnergyKcal, summary?.activeEnergyKcal)),
    },
    {
      label: 'rest HR',
      value: fmtCount(signal(health.recovery.restingHeartRateBpm, summary?.restingHeartRate)),
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.surface.canvas }}
      contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
    >
      <LogHeader
        title={isToday ? 'Today' : formatShortDate(localDate)}
        dateLabel={dateLabel}
        onPressAccount={() => router.push('/settings')}
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

      {closedSession ? (
        <View style={[styles.closedNotice, { backgroundColor: theme.surface.raised }]}>
          <View style={styles.closedMeta}>
            <Text style={[styles.closedTitle, { color: theme.text.primary }]}>
              We closed your last workout
            </Text>
            <Text style={[styles.closedBody, { color: theme.text.secondary }]}>
              It was still open when you left. Everything you logged is saved —{' '}
              {closedSession.loggedSetCount}{' '}
              {closedSession.loggedSetCount === 1 ? 'set' : 'sets'}.
            </Text>
          </View>
          <Button
            label="Dismiss"
            variant="secondary"
            fullWidth={false}
            onPress={() => setClosedSession(null)}
          />
        </View>
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
      <DaySignals
        signals={daySignals}
        health={health}
        onOpenTrends={() => router.push('/(tabs)/trends')}
      />

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionLabel, { color: theme.text.secondary }]}>YOUR LOG</Text>
        </View>
        <LogEntryRow
          testID="row-weight"
          label="Morning weight"
          value={weightDone ? `${manual?.morningWeightValue} ${manual?.morningWeightUnit ?? 'lb'}` : null}
          emptyLabel="Not recorded"
          state={weightStatus === 'saving' ? 'pending' : weightStatus === 'error' ? 'error' : 'settled'}
          onPress={isPast ? undefined : () => setWeightSheet(true)}
          onRetry={() => saveWeight()}
        />
      {!showSkeleton ? (
        <TodayAdditionalActivitySection
          localDate={localDate}
          isToday={isToday}
          sessions={loggedSessions}
          attachedWatchExternalIds={todayQuery.data?.attachedWatchExternalIds ?? []}
        />
      ) : null}
        <LogEntryRow
          testID="row-journal"
          label="Journal"
          value={journal ? journal : null}
          emptyLabel="Write an entry"
          state={journalStatus === 'saving' ? 'pending' : journalStatus === 'error' ? 'error' : 'settled'}
          onPress={isPast ? undefined : () => setJournalSheet(true)}
          onRetry={() => void saveSection({ notes: journal || null, mood: selectedMood }, setJournalStatus, 'journal')}
        />
        <LogEntryRow
          /* The observed testID is load-bearing: it is how the screen says
             a tracker already wrote the day, so we neither ask again nor
             write the manual flag from an imported value (architecture §4
             rules that silent overwrite out). */
          testID={nutritionObserved ? 'nutrition-observed' : 'row-nutrition'}
          label="Nutrition check"
          value={mealDone ? 'Logged' : nutritionObserved ? 'Tracked in Apple Health' : null}
          emptyLabel="Not confirmed"
          state={mealStatus === 'saving' ? 'pending' : mealStatus === 'error' ? 'error' : 'settled'}
          onPress={isPast ? undefined : () => setNutritionSheet(true)}
        />
      </View>

      <WeightSheet
        visible={weightSheet}
        initialValue={weight}
        unit={(manual?.morningWeightUnit ?? 'lb') as 'lb' | 'kg'}
        importedValue={importedWeight}
        errorMessage={weightError}
        onCancel={() => setWeightSheet(false)}
        onSave={(value) => {
          setWeight(value);
          /* The sheet closes immediately: the row already shows the value,
             which is the whole point of saving optimistically. */
          setWeightSheet(false);
          saveWeight(value);
        }}
      />
      <JournalSheet
        visible={journalSheet}
        initialText={journal}
        initialMood={selectedMood}
        onCancel={() => setJournalSheet(false)}
        onSave={(text, mood) => {
          setJournal(text);
          setSelectedMood(mood);
          setJournalSheet(false);
          void saveSection({ notes: text || null, mood }, setJournalStatus, 'journal');
        }}
      />
      <NutritionSheet
        visible={nutritionSheet}
        logged={mealDone}
        observed={nutritionObserved}
        onClose={() => setNutritionSheet(false)}
        onToggle={(checked) => void saveSection({ preWorkoutMealLogged: checked }, setMealStatus, 'meal')}
      />

      {/* Replaces the old "Apple Health sync" card, which described a
          connection the user had no way to make: nothing in the app had
          ever called requestAuthorization(). See
          docs/design/health-connection-flow.md. */}
      {/* The Health metrics card is gone from Log. Nine tiles and a macro
          breakdown competed with the day's one decision while saying nothing
          the user had to act on — that pile is what "a bunch of random stuff
          thrown onto a screen" described. Its depth is the Trends tab and its
          connection states are on DaySignals above. */}
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
  closedNotice: { borderRadius: radius.small, padding: spacing[16], gap: spacing[12] },
  closedMeta: { gap: spacing[4] },
  closedTitle: { fontSize: typeScale.compactBody.fontSize, fontWeight: '600' },
  closedBody: { fontSize: typeScale.label.fontSize, lineHeight: 17 },
  section: { gap: spacing[8] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: typeScale.caption.fontSize, fontWeight: '500', letterSpacing: 0.6 },
  sectionLink: { fontSize: typeScale.label.fontSize, fontWeight: '500' },
  signals: { flexDirection: 'row', borderRadius: radius.small, padding: spacing[16] },
  signal: { flex: 1, gap: spacing[4] },
  signalValue: { fontSize: typeScale.sectionTitle.fontSize, fontWeight: '600' },
  signalLabel: { fontSize: typeScale.caption.fontSize },
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
