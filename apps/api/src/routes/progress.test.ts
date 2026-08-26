import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const db = { select: mockSelect, insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  return { mockSelect, db };
});

vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
}));

vi.mock('../lib/db', () => ({
  getDb: () => db,
}));

function queryChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  // `orderBy` returns the chain rather than resolving, so a query that goes on
  // to `.limit(1)` still works; `then` keeps it awaitable for those that stop.
  const chain: Record<string, unknown> = {
    limit: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  chain.orderBy = vi.fn().mockReturnValue(chain);
  return chain;
}

function selectChain(rows: unknown[]) {
  const chain = queryChain(rows);
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }),
        where: vi.fn().mockReturnValue(chain),
      }),
      where: vi.fn().mockReturnValue(chain),
      orderBy: vi.fn().mockReturnValue(chain),
    }),
  };
}

const authHeader = { authorization: 'Bearer test-token' };
const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  displayName: null,
  preferredUnits: 'imperial',
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// One completed session, one exercise, one working set — the minimal shape
// that makes it through workoutSession -> workoutExerciseLog -> workoutSet.
const sessionSetRow = {
  sessionId: '22222222-2222-4222-8222-222222222222',
  localDate: '2026-08-24',
  completedAt: new Date('2026-08-24T16:00:00Z'),
  sessionName: 'Recovery Day A',
  logId: '33333333-3333-4333-8333-333333333333',
  exerciseId: '44444444-4444-4444-8444-444444444444',
  exerciseName: 'Bench Press',
  prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 },
  setId: '55555555-5555-4555-8555-555555555555',
  setType: 'working',
  completed: true,
  loadValue: '135',
  loadUnit: 'lb',
  reps: 8,
  durationSeconds: null,
  distanceValue: null,
  distanceUnit: null,
  isPrWeight: false,
  isPrReps: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Story 45 — Additional Activity must never inflate scheduled-workout
 * metrics. `additional_activity` isn't imported by this route at all (see
 * apps/api/src/routes/progress.ts's imports), so there is structurally no
 * path for it to reach `training.totalCompleted`/`weeksTrained` — these
 * tests pin the actual number a real completed session produces, so any
 * future change that accidentally starts folding activities in here would
 * break an explicit assertion instead of silently inflating a session
 * count.
 */
describe('GET /v1/progress/overview training summary', () => {
  it('counts exactly one scheduled session for a week with one completed workout', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow])) // auth
      .mockReturnValueOnce(selectChain([sessionSetRow])) // setRows
      .mockReturnValueOnce(selectChain([])) // restRows
      .mockReturnValueOnce(selectChain([{ localDate: '2026-08-24' }])) // firstSession
      .mockReturnValueOnce(selectChain([])); // bodyWeightRows

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/progress/overview?weeks=4&localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // A recovery day with (hypothetically) several Additional Activities
    // logged the same day must still read as exactly one completed
    // session — 1 workout is not "N workouts" no matter how much
    // supplemental movement happened alongside it.
    expect(body.training.totalCompleted).toBe(1);
    expect(body.recentSessions).toHaveLength(1);
    expect(body.recentSessions[0]).toMatchObject({ sessionId: sessionSetRow.sessionId, exerciseCount: 1, setCount: 1 });
    await app.close();
  });
});

/**
 * Story 50 — the daily rollup the sub-weekly ranges chart from, and the bound
 * that decides where an empty period may honestly be drawn as zero.
 */
describe('GET /v1/progress/overview daily training series', () => {
  it('returns a per-day rollup alongside the weekly one', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionSetRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ localDate: '2026-08-24' }]))
      .mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/progress/overview?weeks=4&localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.training.days).toEqual([
      { localDate: '2026-08-24', completedCount: 1, volume: 1080 },
    ]);
    await app.close();
  });

  it('reports a first-activity date that predates the requested window', async () => {
    /* The load-bearing case. `firstActivityDate` must come from its own
       unbounded query, not from the windowed session rows — derived from
       those it would always equal the window's own start, and every range
       would look like the user began at its left edge. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionSetRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ localDate: '2024-03-05' }]))
      .mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/progress/overview?weeks=4&localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().training.firstActivityDate).toBe('2024-03-05');
    await app.close();
  });

  it('reports a null first-activity date for a user who has never trained', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/progress/overview?weeks=4&localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.training.firstActivityDate).toBeNull();
    expect(body.training.days).toEqual([]);
    await app.close();
  });

  it('accepts a window long enough for the Y and ALL ranges', async () => {
    // The old cap was 52, one week short of a full year plus the partial
    // current one, and far short of any real history for ALL.
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionSetRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ localDate: '2024-03-05' }]))
      .mockReturnValueOnce(selectChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/progress/overview?weeks=53&localDate=2026-08-24',
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().training.windowWeeks).toBe(53);
    await app.close();
  });
});
