/**
 * MSW request handlers backing `npm run dev:mock` (VITE_USE_MOCKS=true).
 *
 * These return realistic representative sample data shaped to match the
 * *actual* apps/api Zod response schemas (see apps/api/src/routes/*.ts and
 * packages/schemas/src/*.ts), reusing the mock data that used to live
 * directly in apps/web/src/pages/*.tsx before those pages were wired up
 * to the real API. Use this mode for design/feature iteration without a
 * running backend:
 *
 *   npm run dev          -> real API (apps/api), requires a running server + DB
 *   npm run dev:mock      -> MSW-mocked responses, no backend required
 *
 * All paths below are relative to env.apiBaseUrl (which already includes
 * the `/v1` prefix), so handlers match on `*\/v1/...` to work regardless
 * of the configured base origin.
 */
import { http, HttpResponse } from 'msw';

import { completedSessionsToday, currentPersona, hasProgram } from './persona-state';
import { mockControl } from './mock-control';

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const mockUserId = '00000000-0000-0000-0000-000000000001';

const mockExercises = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Barbell Bench Press',
    isCustom: false,
    ownerUserId: null,
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    name: 'Overhead Press',
    isCustom: false,
    ownerUserId: null,
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    name: 'Triceps Pushdown',
    isCustom: false,
    ownerUserId: null,
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  },
];

const mockHistoryItems = [
  { weightValue: 195, reps: 6, sessionLocalDate: 'Aug 18, 2026', isPrWeight: true, isPrReps: false },
  { weightValue: 185, reps: 8, sessionLocalDate: 'Aug 18, 2026', isPrWeight: false, isPrReps: false },
  { weightValue: 185, reps: 8, sessionLocalDate: 'Aug 18, 2026', isPrWeight: false, isPrReps: false },
  { weightValue: 185, reps: 8, sessionLocalDate: 'Aug 11, 2026', isPrWeight: false, isPrReps: false },
  { weightValue: 185, reps: 8, sessionLocalDate: 'Aug 11, 2026', isPrWeight: false, isPrReps: false },
  { weightValue: 175, reps: 9, sessionLocalDate: 'Aug 11, 2026', isPrWeight: false, isPrReps: false },
];

const mockPrograms = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    userId: mockUserId,
    name: '5-Day Upper/Lower Split',
    description: null,
    isActive: true,
    startDate: null,
    cycleLengthWeeks: 5,
    archivedAt: null,
    createdAt: now(),
    updatedAt: now(),
  },
];

/* Exercises for a day type, and a weekly schedule assigning those day
   types to days — both needed for Training to render under `dev:mock`. */
/* `exerciseId` must be an id `/v1/exercises` actually returns.
   These referenced a `20000000-…` namespace that exists nowhere else, so
   Training's name lookup — `exercises.find(item => item.id === exerciseId)` —
   missed every time and fell back to rendering the raw UUID. Playwright's
   planner agent found it while exploring and reported it as a product defect;
   it is a fixture bug, and the distinction matters because the two have
   completely different fixes.

   The rows also carried an `exercise: { id, name }` object, which
   `dayTypeExerciseSchema` does not define and the API does not return
   (`toDayTypeExerciseResponse` maps the row with no join). A mock that invents
   fields the contract lacks teaches every reader — human or agent — a shape
   that does not exist; the agent duly proposed "just use the embedded name",
   which would work here and break in production. Removed. */
const mockDayTypeExercises = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    dayTypeId: '30000000-0000-0000-0000-000000000001',
    exerciseId: '10000000-0000-0000-0000-000000000001',
    sortOrder: 0,
    prescription: { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 },
    progressionRuleId: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    dayTypeId: '30000000-0000-0000-0000-000000000001',
    exerciseId: '10000000-0000-0000-0000-000000000002',
    sortOrder: 1,
    prescription: { kind: 'sets_reps', sets: 3, repsMin: 6, repsMax: null },
    progressionRuleId: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
];

const mockScheduleSlots = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    programVersionId: '40000000-0000-0000-0000-000000000001',
    dayTypeId: '30000000-0000-0000-0000-000000000001',
    weekIndex: 0,
    dayOfWeek: 1,
    createdAt: now(),
    updatedAt: now(),
  },
];

const mockTemplates = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    programVersionId: '40000000-0000-0000-0000-000000000001',
    name: 'Day 1 — Push',
    dayLabel: 'Day 1 — Push',
    sortOrder: 0,
    description: null,
    estimatedDurationMinutes: 50,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    programVersionId: '40000000-0000-0000-0000-000000000001',
    name: 'Day 2 — Pull',
    dayLabel: 'Day 2 — Pull',
    sortOrder: 1,
    description: null,
    estimatedDurationMinutes: 45,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    programVersionId: '40000000-0000-0000-0000-000000000001',
    name: 'Day 3 — Legs',
    dayLabel: 'Day 3 — Legs',
    sortOrder: 2,
    description: null,
    estimatedDurationMinutes: 55,
    createdAt: now(),
    updatedAt: now(),
  },
];

let mockSets: Record<string, unknown>[] = [];
let mockSessionCounter = 0;
let mockExerciseLogCounter = 0;

export const handlers = [
  http.get('*/v1/health', () => HttpResponse.json({ status: 'ok' })),

  /* Persona-aware (UX review, phase 2). A novice has no program at all —
     without that, "create your first program" cannot be reviewed, because the
     account already has one. The analyst has already trained today, so the
     completed-review surface is what they land on. */
  http.get('*/v1/dashboard/today', () =>
    HttpResponse.json({
      localDate: today(),
      sessions: completedSessionsToday()
        ? [
            {
              id: 'session-analyst-1',
              status: 'completed',
              templateId: '30000000-0000-0000-0000-000000000003',
              startedAt: now(),
              completedAt: now(),
              updatedAt: now(),
            },
          ]
        : [],
      manualEntry: null,
      activitySummary: {
        steps: 8412,
        walkingRunningDistanceM: null,
        activeEnergyKcal: '410',
        exerciseMinutes: 32,
      },
      nutritionSnapshot: { caloriesKcal: '2180' },
      syncState: { status: 'ok', lastSuccessfulSyncAt: now(), lastAttemptAt: now(), latestCompleteLocalDate: today() },
      weekLabel: hasProgram() ? 'Week 2' : null,
      dayLabel: hasProgram() ? 'Day 3' : null,
      dayTypeId: hasProgram() ? '30000000-0000-0000-0000-000000000003' : null,
      estimatedDurationMinutes: hasProgram() ? 50 : null,
      scheduleSource: hasProgram() ? 'program' : 'none',
      override: null,
    }),
  ),

  http.get('*/v1/exercises', () => HttpResponse.json(mockExercises)),

  http.get('*/v1/exercises/:exerciseId/history', () =>
    HttpResponse.json({
      items: mockHistoryItems.map((item, index) => ({
        sessionId: index < 2 ? 'session-a' : 'session-b',
        sessionLocalDate: index < 2 ? '2026-08-18' : '2026-08-11',
        sessionCompletedAt: now(),
        sessionName: index < 2 ? 'Lower A' : 'Lower B',
        setId: `history-set-${index + 1}`,
        exerciseLogId: index < 2 ? 'log-a' : 'log-b',
        setType: 'working',
        sortOrder: index % 2,
        weightValue: item.weightValue,
        weightUnit: 'lb',
        reps: item.reps,
        durationSeconds: null,
        distanceValue: null,
        distanceUnit: null,
        rpe: null,
        isPrWeight: item.isPrWeight,
        isPrReps: item.isPrReps,
        notes: null,
      })),
      nextCursor: null,
    }),
  ),

  http.get('*/v1/exercises/:exerciseId/progress', ({ params }) =>
    HttpResponse.json({
      exerciseId: params.exerciseId,
      points: [
        { sessionId: 's1', localDate: '2026-07-01', sessionName: 'Lower A', topWeight: 205, topReps: 4, estimatedOneRepMax: 220, volume: 4200, isWeightPr: false, isRepPr: false },
        { sessionId: 's2', localDate: '2026-07-15', sessionName: 'Lower A', topWeight: 210, topReps: 4, estimatedOneRepMax: 226, volume: 4350, isWeightPr: true, isRepPr: false },
        { sessionId: 's3', localDate: '2026-08-01', sessionName: 'Lower A', topWeight: 215, topReps: 4, estimatedOneRepMax: 230, volume: 4480, isWeightPr: false, isRepPr: true },
        { sessionId: 's4', localDate: '2026-08-18', sessionName: 'Lower A', topWeight: 217.5, topReps: 4, estimatedOneRepMax: 232, volume: 4510, isWeightPr: true, isRepPr: false },
      ],
    }),
  ),

  /* Shaped to `progressOverviewResponseSchema`, not to whatever the page
     happened to read when this was written. The previous fixture returned
     `cards`/`consistency` and body-weight points of `{ weightValue,
     weightUnit }` — a shape the contract has not used for some time — so
     `isProgressOverview` rejected it and Progress rendered its error state
     under `dev:mock`. The screen was un-reviewable, which is the same
     failure that let Training drift.

     Spans ~5 months of daily check-ins so every time range has something
     real to show, and each renders a visibly different picture. */
  http.get('*/v1/progress/overview', () => {
    const end = new Date();
    const bodyWeightPoints = Array.from({ length: 150 }, (_, index) => {
      const date = new Date(end.getTime() - (149 - index) * 86_400_000);
      // A gentle cut with day-to-day water noise, so smoothing has something
      // to smooth and a week bucket differs from a day bucket.
      const raw = 186 - index * 0.035 + Math.sin(index / 2.4) * 0.9;
      return {
        localDate: date.toISOString().slice(0, 10),
        raw: Number(raw.toFixed(1)),
        trend: Number((186 - index * 0.035).toFixed(1)),
        rollingAverage: index >= 6 ? Number((186 - index * 0.035).toFixed(1)) : null,
      };
    });

    /* Grouped from the same points rather than left empty: `weeks` drives the
       weekly average and the week-over-week comparison, so an empty array
       made both invisible under `dev:mock` — un-reviewable in the same way
       the old body-weight shape was. */
    const bodyWeightWeeks = Object.entries(
      bodyWeightPoints.reduce<Record<string, number[]>>((byWeek, point) => {
        const date = new Date(`${point.localDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - date.getUTCDay());
        const weekStart = date.toISOString().slice(0, 10);
        (byWeek[weekStart] ??= []).push(point.raw);
        return byWeek;
      }, {}),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, values]) => ({
        weekStart,
        average: Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1)),
        low: Math.min(...values),
        high: Math.max(...values),
        checkInCount: values.length,
      }));

    /* Story 50: 26 weeks of *daily* training, with the weekly buckets derived
       from it rather than declared alongside it, so the two can never
       disagree. A screenshot with two non-zero bars is not evidence that a
       range selector works, and 3M/6M/Y need real history behind them. */
    const DAY_MS = 86_400_000;
    const weekStartOf = (iso: string) => {
      const date = new Date(`${iso}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - date.getUTCDay());
      return date.toISOString().slice(0, 10);
    };

    const TRAINING_DAYS = 182;
    const trainingDays: { localDate: string; completedCount: number; volume: number | null }[] = [];
    for (let offset = TRAINING_DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date(end.getTime() - offset * DAY_MS);
      const weekIndex = Math.floor((TRAINING_DAYS - 1 - offset) / 7);
      // A deload week and a holiday fortnight, so a real zero is on screen
      // and can be told apart from a gap.
      if (weekIndex === 9 || weekIndex === 17 || weekIndex === 18) continue;
      const weekday = date.getUTCDay();
      const lifts = weekday === 1 || weekday === 2 || weekday === 4 || weekday === 5;
      // Saturday is a programmed conditioning session: a completed workout
      // that moves no external load, so its volume is null and never a 0 lb.
      const conditions = weekday === 6;
      if (!lifts && !conditions) continue;
      trainingDays.push({
        localDate: date.toISOString().slice(0, 10),
        completedCount: 1,
        volume: lifts ? 2_600 + weekIndex * 45 + ((weekIndex * 37 + weekday * 130) % 900) : null,
      });
    }

    const byWeek = new Map<string, { completed: number; volume: number | null }>();
    for (const day of trainingDays) {
      const weekStart = weekStartOf(day.localDate);
      const entry = byWeek.get(weekStart) ?? { completed: 0, volume: null };
      entry.completed += day.completedCount;
      if (day.volume != null) entry.volume = (entry.volume ?? 0) + day.volume;
      byWeek.set(weekStart, entry);
    }

    const currentWeekStart = weekStartOf(end.toISOString().slice(0, 10));
    const weekStarts: string[] = [];
    for (
      let cursor = weekStartOf(
        new Date(end.getTime() - (TRAINING_DAYS - 1) * DAY_MS).toISOString().slice(0, 10),
      );
      cursor <= currentWeekStart;

    ) {
      weekStarts.push(cursor);
      const next = new Date(`${cursor}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 7);
      cursor = next.toISOString().slice(0, 10);
    }

    const trainingWeeks = weekStarts.map((weekStart) => {
      const entry = byWeek.get(weekStart);
      const completedCount = entry?.completed ?? 0;
      return {
        weekStart,
        completedCount,
        plannedCount: 5,
        /* Uncapped, matching the API: clamping would erase the difference
           between hitting the plan and beating it, which is exactly what the
           adherence chart exists to show. */
        completionRatio: completedCount / 5,
        volume: entry?.volume ?? null,
        restCount: completedCount === 0 ? 5 : 1,
        isRestWeek: completedCount === 0,
        isCurrent: weekStart === currentWeekStart,
      };
    });

    const totalCompleted = trainingDays.reduce((sum, day) => sum + day.completedCount, 0);

    /* Composition is derived from the *same* trainingDays volume rather than
       invented alongside it, so the mock upholds the real API's invariant:
       a week's stacked bands sum to that week's volume. A fixture that broke
       that would make the chart look right while hiding the one defect the
       invariant exists to catch. One pattern (`carry`) is deliberately tiny
       and another (`cardio`) deliberately absent, so the remainder bucket and
       the untrained-pattern case are both on screen under dev:mock. */
    const patternSplit: Record<number, [string, number][]> = {
      1: [['squat', 0.55], ['hinge', 0.3], ['core', 0.15]],
      2: [['horizontal-push', 0.5], ['vertical-push', 0.35], ['isolation-arm', 0.15]],
      4: [['hinge', 0.6], ['squat', 0.25], ['carry', 0.15]],
      5: [['horizontal-pull', 0.45], ['vertical-pull', 0.4], ['isolation-arm', 0.15]],
    };

    const compositionByWeek = new Map<string, Record<string, number>>();
    let unclassifiedTotal = 0;
    for (const day of trainingDays) {
      if (day.volume == null) continue;
      const weekday = new Date(`${day.localDate}T00:00:00Z`).getUTCDay();
      const split = patternSplit[weekday];
      const weekStart = weekStartOf(day.localDate);
      if (!split) {
        unclassifiedTotal += day.volume;
        continue;
      }
      const values = compositionByWeek.get(weekStart) ?? {};
      let assigned = 0;
      split.forEach(([key, share], index) => {
        // The last band takes the rounding remainder, so the parts always
        // total exactly the day's volume rather than drifting by a pound.
        const amount =
          index === split.length - 1
            ? day.volume! - assigned
            : Math.round(day.volume! * share);
        assigned += amount;
        if (amount > 0) values[key] = (values[key] ?? 0) + amount;
      });
      compositionByWeek.set(weekStart, values);
    }

    const compositionWeeks = weekStarts.map((weekStart) => {
      const values = compositionByWeek.get(weekStart) ?? {};
      return {
        weekStart,
        values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
        isCurrent: weekStart === currentWeekStart,
      };
    });

    const patternTotals = new Map<string, number>();
    for (const week of compositionWeeks) {
      for (const [key, value] of Object.entries(week.values)) {
        patternTotals.set(key, (patternTotals.get(key) ?? 0) + value);
      }
    }
    const classifiedTotal = [...patternTotals.values()].reduce((sum, value) => sum + value, 0);

    return HttpResponse.json({
      training: {
        weeks: trainingWeeks,
        days: trainingDays,
        firstActivityDate: trainingDays[0]?.localDate ?? null,
        weeksTrained: trainingWeeks.filter((week) => week.completedCount > 0).length,
        windowWeeks: trainingWeeks.length,
        currentStreakWeeks: 7,
        longestStreakWeeks: 8,
        totalCompleted,
        totalRestDays: trainingWeeks.reduce((sum, week) => sum + week.restCount, 0),
        averageSessionsPerWeek: totalCompleted / trainingWeeks.length,
        volumeUnit: 'lb',
      },
      bodyWeight: {
        unit: 'lb',
        sufficiency: 'ready',
        checkInCount: bodyWeightPoints.length,
        currentAverage: bodyWeightPoints.at(-1)!.trend,
        latestCheckIn: {
          localDate: bodyWeightPoints.at(-1)!.localDate,
          weightValue: bodyWeightPoints.at(-1)!.raw,
        },
        ratePerWeek: -0.25,
        direction: 'falling',
        windowWeeks: 12,
        points: bodyWeightPoints,
        weeks: bodyWeightWeeks,
      },
      composition: {
        unit: 'lb',
        patterns: [...patternTotals.entries()]
          .map(([key, total]) => ({
            key,
            total,
            share: classifiedTotal > 0 ? total / classifiedTotal : 0,
          }))
          .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)),
        weeks: compositionWeeks,
        unclassifiedTotal,
        unclassifiedExerciseCount: unclassifiedTotal > 0 ? 2 : 0,
      },
      exercises: [
        {
          exerciseId: mockExercises[0]!.id,
          exerciseName: mockExercises[0]!.name,
          sessionCount: 12,
          metricKeys: ['estimatedOneRepMax'],
          points: Array.from({ length: 12 }, (_, index) => {
            const date = new Date(end.getTime() - (11 - index) * 7 * 86_400_000);
            return {
              sessionId: `sess-${index}`,
              localDate: date.toISOString().slice(0, 10),
              sessionName: 'Lower A',
              metrics: [
                { key: 'estimatedOneRepMax', value: 210 + index * 2, loadUnit: 'lb' },
              ],
              isWeightPr: index === 11,
              isRepPr: false,
            };
          }),
        },
      ],
      recentSessions: [
        { sessionId: '11111111-1111-4111-8111-111111111111', localDate: today(), completedAt: now(), sessionName: 'Lower A', exerciseCount: 5, setCount: 18, volume: 4510, prCount: 1 },
      ],
    });
  }),

  http.get('*/v1/programs', () => HttpResponse.json(hasProgram() ? mockPrograms : [])),
  http.post('*/v1/programs', async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        userId: mockUserId,
        name: body.name,
        description: null,
        isActive: true,
        startDate: null,
        cycleLengthWeeks: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { status: 201 },
    );
  }),

  /* Story 25 renamed this resource from `workouts` to `day-types` when it
     introduced explicit program membership, but the mock kept the old path.
     Nothing called `/workouts` any more, so Training could never resolve
     its queries under `dev:mock` and sat on its loading skeleton forever —
     which is why nobody could design-review the screen, and part of why
     mobile's Training was allowed to diverge from it unnoticed. */
  http.get('*/v1/programs/:programId/day-types', () => HttpResponse.json(mockTemplates)),
  http.get('*/v1/day-types/:dayTypeId', ({ params }) => {
    const dayType = mockTemplates.find((t) => t.id === params.dayTypeId) ?? mockTemplates[0];
    return HttpResponse.json({ ...dayType, exercises: mockDayTypeExercises });
  }),
  http.get('*/v1/programs/:programId/schedule-slots', () => HttpResponse.json(mockScheduleSlots)),

  http.get('*/v1/programs/:programId/workouts', () => HttpResponse.json(mockTemplates)),
  http.post('*/v1/programs/:programId/workouts', async ({ request }) => {
    const body = (await request.json()) as { name: string; dayLabel?: string | null };
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        programVersionId: '40000000-0000-0000-0000-000000000001',
        name: body.name,
        dayLabel: body.dayLabel ?? null,
        sortOrder: mockTemplates.length,
        description: null,
        estimatedDurationMinutes: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { status: 201 },
    );
  }),

  http.get('*/v1/progress/consistency', () =>
    HttpResponse.json([
      { weekStart: '2026-06-22', plannedCount: 4, completedCount: 4, completionRatio: 1 },
      { weekStart: '2026-06-29', plannedCount: 4, completedCount: 4, completionRatio: 1 },
      { weekStart: '2026-07-06', plannedCount: 4, completedCount: 3, completionRatio: 0.75 },
      { weekStart: '2026-07-13', plannedCount: 4, completedCount: 4, completionRatio: 1 },
      { weekStart: '2026-07-20', plannedCount: 4, completedCount: 4, completionRatio: 1 },
      { weekStart: '2026-07-27', plannedCount: 4, completedCount: 2, completionRatio: 0.5 },
      { weekStart: '2026-08-03', plannedCount: 4, completedCount: 3, completionRatio: 0.75 },
      { weekStart: '2026-08-10', plannedCount: 4, completedCount: 3, completionRatio: 0.75 },
    ]),
  ),

  http.get('*/v1/me', () =>
    HttpResponse.json({
      id: mockUserId,
      clerkUserId: 'user_mock',
      displayName: 'Mock User',
      preferredUnits: 'imperial',
      timezone: 'America/Chicago',
      createdAt: now(),
      updatedAt: now(),
    }),
  ),

  http.get('*/v1/me/notification-preferences', () =>
    HttpResponse.json({ workoutRemindersEnabled: true, weeklySummaryEnabled: true }),
  ),
  http.patch('*/v1/me/notification-preferences', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      workoutRemindersEnabled: true,
      weeklySummaryEnabled: true,
      ...(body as object),
    });
  }),

  http.get('*/v1/integrations/apple-health/sync-state', () =>
    HttpResponse.json({ status: 'ok', lastSuccessAt: now() }),
  ),

  /* Story 42.7 — a regression scenario may pin an exact session shape, so it
     can drive one exercise through several representations without every
     other test inheriting the change. */
  http.get('*/v1/workout-sessions/:sessionId', ({ params }) =>
    HttpResponse.json(mockControl.sessionOverride() ?? {
      id: params.sessionId,
      userId: mockUserId,
      templateId: '30000000-0000-0000-0000-000000000003',
      localDate: today(),
      timezone: 'America/Chicago',
      /* Only the analyst arrives at a finished session. Returning `completed`
         for everyone meant "Start workout" landed straight on the review
         surface, so the core logging loop could not be exercised at all —
         and the first UX review run duly reported a missing "Finish workout"
         that was correctly absent. */
      status: completedSessionsToday() ? 'completed' : 'in_progress',
      startedAt: now(),
      completedAt: completedSessionsToday() ? now() : null,
      notes: null,
      createdAt: now(),
      updatedAt: now(),
      exercises: [
        {
          id: 'exercise-log-1',
          sessionId: params.sessionId,
          exerciseId: mockExercises[0]!.id,
          templateExerciseId: null,
          sortOrder: 0,
          skipped: false,
          notes: null,
          createdAt: now(),
          updatedAt: now(),
          exercise: mockExercises[0]!,
          prescription: { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: null },
          previousSession: null,
          sets: [
            { id: 'set-1', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 0, setType: 'working', weightValue: completedSessionsToday() ? 185 : null, weightUnit: 'lb', reps: completedSessionsToday() ? 8 : null, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
            { id: 'set-2', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 1, setType: 'working', weightValue: completedSessionsToday() ? 185 : null, weightUnit: 'lb', reps: completedSessionsToday() ? 8 : null, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
            { id: 'set-3', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 2, setType: 'working', weightValue: completedSessionsToday() ? 185 : null, weightUnit: 'lb', reps: completedSessionsToday() ? 8 : null, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
          ],
        },
      ],
    }),
  ),

  /* Quick Log (stories 58/59). Absent until the UX reviewer walked the core
     journey and reported a P0 for a 400 — which was this fixture missing, not
     the product. A mock that 404s the primary action makes the main flow
     un-reviewable end to end. */
  http.post('*/v1/workout-exercise-logs/:exerciseLogId/quick-log', async ({ request, params }) => {
    const body = (await request.json()) as { setIds?: string[] };
    /* Deterministic latency and failure, so the optimistic path and its
       rollback can be observed rather than hoped for (story 42.7). */
    const behaviour = mockControl.quickLogBehaviour();
    if (behaviour?.delayMs) await new Promise((resolve) => setTimeout(resolve, behaviour.delayMs));
    if (behaviour?.fail) {
      return HttpResponse.json({ error: { code: 'MOCK_FAILURE', message: 'Simulated failure' } }, { status: 500 });
    }
    return HttpResponse.json({
      exerciseLogId: params.exerciseLogId,
      updated: body.setIds?.length ?? 0,
    });
  }),

  http.post('*/v1/workout-sessions', () => {
    mockSessionCounter += 1;
    return HttpResponse.json(
      {
        id: `session-${mockSessionCounter}`,
        userId: mockUserId,
        templateId: null,
        localDate: today(),
        timezone: 'America/Chicago',
        status: 'in_progress',
        startedAt: now(),
        completedAt: null,
        notes: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { status: 201 },
    );
  }),

  http.post('*/v1/workout-sessions/:sessionId/complete', ({ params }) =>
    HttpResponse.json({
      id: params.sessionId,
      userId: mockUserId,
      templateId: null,
      localDate: today(),
      timezone: 'America/Chicago',
      status: 'completed',
      startedAt: now(),
      completedAt: now(),
      notes: null,
      createdAt: now(),
      updatedAt: now(),
    }),
  ),

  http.post('*/v1/workout-sessions/:sessionId/exercises', async ({ params, request }) => {
    mockExerciseLogCounter += 1;
    const body = (await request.json()) as { exerciseId: string };
    return HttpResponse.json(
      {
        id: `exercise-log-${mockExerciseLogCounter}`,
        sessionId: params.sessionId,
        exerciseId: body.exerciseId,
        templateExerciseId: null,
        sortOrder: 0,
        skipped: false,
        notes: null,
        createdAt: now(),
        updatedAt: now(),
      },
      { status: 201 },
    );
  }),

  http.post('*/v1/workout-exercise-logs/:exerciseLogId/sets', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const existing = mockSets.find((s) => s.clientId === body.clientId);
    if (existing) return HttpResponse.json(existing);
    const created = {
      id: crypto.randomUUID(),
      exerciseLogId: params.exerciseLogId,
      clientId: body.clientId,
      sortOrder: mockSets.length,
      weightValue: body.weightValue ?? null,
      weightUnit: body.weightUnit ?? null,
      reps: body.reps ?? null,
      durationSeconds: body.durationSeconds ?? null,
      distanceValue: body.distanceValue ?? null,
      distanceUnit: body.distanceUnit ?? null,
      rpe: body.rpe ?? null,
      isPrWeight: false,
      isPrReps: false,
      createdAt: now(),
      updatedAt: now(),
    };
    mockSets = [...mockSets, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('*/v1/workout-sets/:setId', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockSets.findIndex((s) => s.id === params.setId);
    const base = idx >= 0 ? mockSets[idx] : { id: params.setId };
    const updated = { ...base, ...body, updatedAt: now() };
    if (idx >= 0) mockSets[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.delete('*/v1/workout-sets/:setId', ({ params }) => {
    mockSets = mockSets.filter((s) => s.id !== params.setId);
    return new HttpResponse(null, { status: 204 });
  }),
];
