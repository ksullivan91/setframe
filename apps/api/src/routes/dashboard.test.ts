import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const db = { select: mockSelect, insert: vi.fn(), update: vi.fn(), delete: vi.fn() };
  return { mockSelect, db };
});
vi.mock('../lib/clerk', () => ({ verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })) }));
vi.mock('../lib/db', () => ({ getDb: () => db }));

const authHeader = { authorization: 'Bearer t' };
const userRow = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'clerk-user-1',
  email: 'a@b.c',
  preferredUnits: 'imperial',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** A `.from().where()` that also supports `.limit()` and `.innerJoin()`. */
function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const tail = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  const where = vi.fn().mockReturnValue(tail);
  return {
    from: vi.fn().mockReturnValue({
      where,
      innerJoin: vi.fn().mockReturnValue({ where }),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('GET /v1/dashboard/today', () => {
  it('reports which Watch workouts are already attached to a session', async () => {
    /* Today uses these to stop offering a Watch workout as an Additional
       Activity once it is attached in the logger — logging the same hour
       twice double-counts the day. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow])) // auth: resolve user
      .mockReturnValueOnce(selectChain([])) // sessions
      .mockReturnValueOnce(selectChain([])) // manual entry
      .mockReturnValueOnce(selectChain([])) // activity summary
      .mockReturnValueOnce(selectChain([])) // nutrition
      .mockReturnValueOnce(selectChain([])) // sync state
      .mockReturnValueOnce(selectChain([])) // resolveScheduledDayType
      .mockReturnValueOnce(selectChain([])) // ... its inner reads
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValue(selectChain([{ externalId: 'hk-strength-1' }, { externalId: 'hk-cooldown' }]));

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/today?localDate=2026-09-02',
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.attachedWatchExternalIds)).toBe(true);
  });

  it('scopes the attached-workout read by user on both sides of the join', async () => {
    /* ADR 0002: a join reaches a second table, and the session side needs
       its own user_id predicate — otherwise another user's session id
       would expose their attached workouts. */
    const fs = await import('node:fs');
    const path = await import('node:path');
    const here = path.dirname(new URL(import.meta.url).pathname);
    const source = fs.readFileSync(path.join(here, 'dashboard.ts'), 'utf8');
    const join = source.slice(source.indexOf('sessionWatchWorkout.externalId'));
    expect(join).toContain('eq(sessionWatchWorkout.userId, userId)');
    expect(join).toContain('eq(workoutSession.userId, userId)');
  });
});

describe('what the day plans', () => {
  /* The Log card showed a bare title because this endpoint returned the day
     type's id, name and duration and nothing else — no exercises to name,
     and no planned total to measure progress against. */
  it('names the day’s exercises and totals its planned sets', async () => {
    const dayTypeRow = { id: 'day-1', name: 'Upper Body — Push', estimatedDurationMinutes: 52 };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow])) // auth
      .mockReturnValueOnce(selectChain([])) // sessions
      .mockReturnValueOnce(selectChain([])) // manual entry
      .mockReturnValueOnce(selectChain([])) // activity summary
      .mockReturnValueOnce(selectChain([])) // nutrition
      .mockReturnValueOnce(selectChain([])) // sync state
      // resolveScheduledDayType: an override supplies the day type directly
      .mockReturnValueOnce(selectChain([{ override: { dayTypeId: 'day-1' }, dayType: dayTypeRow }]))
      .mockReturnValueOnce(selectChain([])) // schedule override read
      .mockReturnValueOnce(selectChain([])) // rest day
      .mockReturnValueOnce(selectChain([])) // attached watch workouts
      // the planned read, ordered by sortOrder
      .mockReturnValue(
        selectChain([
          { name: 'Barbell Bench Press', prescription: { kind: 'sets_reps', sets: 4, reps: 8 } },
          { name: 'Incline DB Press', prescription: { kind: 'sets_reps', sets: 3, reps: 10 } },
        ]),
      );

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/today?localDate=2026-09-02',
      headers: authHeader,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plannedExercises).toEqual(['Barbell Bench Press', 'Incline DB Press']);
    /* 4 + 3, counted by the same expansion session-start uses to create
       them — not by re-reading `sets` off the prescription here. */
    expect(body.plannedSetCount).toBe(7);
  });

  it('plans nothing on a day with no day type', async () => {
    mockSelect.mockReturnValue(selectChain([]));
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/dashboard/today?localDate=2026-09-02',
      headers: authHeader,
    });

    expect(res.json().plannedExercises).toEqual([]);
    expect(res.json().plannedSetCount).toBe(0);
  });
});
