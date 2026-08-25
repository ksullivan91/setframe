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
const mockDayTypeExercises = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    dayTypeId: '30000000-0000-0000-0000-000000000001',
    exerciseId: '20000000-0000-0000-0000-000000000001',
    exercise: { id: '20000000-0000-0000-0000-000000000001', name: 'Barbell Bench Press' },
    sortOrder: 0,
    prescription: { kind: 'sets_reps', sets: 3, repsMin: 8, repsMax: 10 },
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    dayTypeId: '30000000-0000-0000-0000-000000000001',
    exerciseId: '20000000-0000-0000-0000-000000000002',
    exercise: { id: '20000000-0000-0000-0000-000000000002', name: 'Pull-Up' },
    sortOrder: 1,
    prescription: { kind: 'bodyweight_reps', sets: 3, repsMin: 6 },
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

  http.get('*/v1/dashboard/today', () =>
    HttpResponse.json({
      localDate: today(),
      sessions: [],
      manualEntry: null,
      activitySummary: {
        steps: 8412,
        walkingRunningDistanceM: null,
        activeEnergyKcal: '410',
        exerciseMinutes: 32,
      },
      nutritionSnapshot: { caloriesKcal: '2180' },
      syncState: { status: 'ok', lastSuccessfulSyncAt: now(), lastAttemptAt: now(), latestCompleteLocalDate: today() },
      weekLabel: 'Week 2',
      dayLabel: 'Day 3',
      dayTypeId: '30000000-0000-0000-0000-000000000003',
      estimatedDurationMinutes: 50,
      scheduleSource: 'program',
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

  http.get('*/v1/progress/overview', () =>
    HttpResponse.json({
      cards: [
        { key: 'weekly-sessions', label: 'Sessions this week', value: '3', detail: '+1 vs last week', trend: [4, 4, 3, 4, 4, 2, 3, 3], status: 'positive' },
        { key: 'consistency-streak', label: 'Current streak', value: '8 weeks', detail: 'Longest streak: 8 weeks', trend: [1, 1, 1, 1, 1, 1, 1, 1], status: 'positive' },
        { key: 'weekly-volume', label: 'Weekly volume', value: '13,540 lb', detail: '14,210 lb avg', trend: [12800, 13120, 11900, 14010, 14620, 10120, 13330, 13540], status: 'informational' },
        { key: 'body-weight', label: 'Body weight', value: '182.4 lb', detail: '-1.6 lb over 5 check-ins', trend: [184, 183.5, 183.2, 182.8, 182.4], status: 'neutral' },
        { key: 'strength-trend', label: 'Back Squat est. 1RM', value: '232 lb', detail: '+12 lb over 4 sessions', trend: [220, 226, 230, 232], status: 'positive' },
      ],
      consistency: {
        weeks: [
          { weekStart: '2026-06-22', plannedCount: 4, completedCount: 4, completionRatio: 1 },
          { weekStart: '2026-06-29', plannedCount: 4, completedCount: 4, completionRatio: 1 },
          { weekStart: '2026-07-06', plannedCount: 3, completedCount: 3, completionRatio: 1 },
          { weekStart: '2026-07-13', plannedCount: 4, completedCount: 4, completionRatio: 1 },
          { weekStart: '2026-07-20', plannedCount: 4, completedCount: 4, completionRatio: 1 },
          { weekStart: '2026-07-27', plannedCount: 2, completedCount: 2, completionRatio: 1 },
          { weekStart: '2026-08-03', plannedCount: 3, completedCount: 3, completionRatio: 1 },
          { weekStart: '2026-08-10', plannedCount: 3, completedCount: 3, completionRatio: 1 },
        ],
        summary: { currentStreakWeeks: 8, longestStreakWeeks: 8, totalCompleted: 27, totalPlanned: 27 },
      },
      bodyWeight: {
        points: [
          { localDate: '2026-07-20', weightValue: 184, weightUnit: 'lb' },
          { localDate: '2026-07-27', weightValue: 183.5, weightUnit: 'lb' },
          { localDate: '2026-08-03', weightValue: 183.2, weightUnit: 'lb' },
          { localDate: '2026-08-10', weightValue: 182.8, weightUnit: 'lb' },
          { localDate: '2026-08-17', weightValue: 182.4, weightUnit: 'lb' },
        ],
        trendLabel: '-1.6 lb over 5 check-ins',
      },
      featuredExercise: {
        exerciseId: mockExercises[0]!.id,
        exerciseName: mockExercises[0]!.name,
        trendLabel: '+12 lb over 4 sessions',
        points: [
          { sessionId: 's1', localDate: '2026-07-01', sessionName: 'Lower A', topWeight: 205, topReps: 4, estimatedOneRepMax: 220, volume: 4200, isWeightPr: false, isRepPr: false },
          { sessionId: 's2', localDate: '2026-07-15', sessionName: 'Lower A', topWeight: 210, topReps: 4, estimatedOneRepMax: 226, volume: 4350, isWeightPr: true, isRepPr: false },
          { sessionId: 's3', localDate: '2026-08-01', sessionName: 'Lower A', topWeight: 215, topReps: 4, estimatedOneRepMax: 230, volume: 4480, isWeightPr: false, isRepPr: true },
          { sessionId: 's4', localDate: '2026-08-18', sessionName: 'Lower A', topWeight: 217.5, topReps: 4, estimatedOneRepMax: 232, volume: 4510, isWeightPr: true, isRepPr: false },
        ],
      },
      recentSessions: [
        { sessionId: 's4', localDate: '2026-08-18', completedAt: now(), sessionName: 'Lower A', exerciseCount: 5, setCount: 18, volume: 4510, prCount: 1 },
        { sessionId: 's3', localDate: '2026-08-15', completedAt: now(), sessionName: 'Upper A', exerciseCount: 4, setCount: 16, volume: 3720, prCount: 0 },
      ],
    }),
  ),

  http.get('*/v1/programs', () => HttpResponse.json(mockPrograms)),
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

  http.get('*/v1/workout-sessions/:sessionId', ({ params }) =>
    HttpResponse.json({
      id: params.sessionId,
      userId: mockUserId,
      templateId: '30000000-0000-0000-0000-000000000003',
      localDate: today(),
      timezone: 'America/Chicago',
      status: 'completed',
      startedAt: now(),
      completedAt: now(),
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
            { id: 'set-1', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 0, setType: 'working', weightValue: 185, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
            { id: 'set-2', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 1, setType: 'working', weightValue: 185, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
            { id: 'set-3', exerciseLogId: 'exercise-log-1', clientId: crypto.randomUUID(), sortOrder: 2, setType: 'working', weightValue: 185, weightUnit: 'lb', reps: 8, durationSeconds: null, distanceValue: null, distanceUnit: null, rpe: null, isPrWeight: false, isPrReps: false, createdAt: now(), updatedAt: now() },
          ],
        },
      ],
    }),
  ),

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
