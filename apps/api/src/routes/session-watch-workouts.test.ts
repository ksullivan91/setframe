import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockDelete = vi.fn();
  const db = { select: mockSelect, insert: mockInsert, update: vi.fn(), delete: mockDelete };
  return { mockSelect, mockInsert, mockDelete, db };
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
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const sessionRow = { id: SESSION_ID, userId: userRow.id, status: 'completed' };
const attached = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: userRow.id,
  sessionId: SESSION_ID,
  externalId: 'hk-strength-1',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: new Date('2026-09-01T17:32:00.000Z'),
  endedAt: new Date('2026-09-01T18:36:00.000Z'),
  durationSeconds: 3840,
  activeEnergyKcal: '612',
  totalEnergyKcal: '842',
  avgHeartRateBpm: 142,
  peakHeartRateBpm: 171,
  minHeartRateBpm: 96,
  distanceValue: null,
  distanceUnit: null,
  deviceName: 'Apple Watch Series 9',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function selectChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  const chain = {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }) };
}
function insertChain(rows: unknown[]) {
  const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) });
  return { values, returning: vi.fn().mockResolvedValue(rows) };
}

const body = {
  externalId: 'hk-strength-1',
  activityType: 'other',
  appleActivityType: 50,
  title: 'Traditional Strength Training',
  startedAt: '2026-09-01T17:32:00.000Z',
  endedAt: '2026-09-01T18:36:00.000Z',
  durationSeconds: 3840,
  activeEnergyKcal: 612,
  avgHeartRateBpm: 142,
  peakHeartRateBpm: 171,
  series: [{ kind: 'heart_rate' as const, offsets: [0, 5, 10], values: [120, 134, 141] }],
};

beforeEach(() => vi.clearAllMocks());

describe('POST watch-workouts', () => {
  it('attaches a workout and stores its series', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))   // auth
      .mockReturnValueOnce(selectChain([sessionRow])) // session ownership
      .mockReturnValueOnce(selectChain([]));          // not already attached
    const workoutInsert = insertChain([attached]);
    const seriesInsert = { values: vi.fn().mockResolvedValue([]) };
    mockInsert.mockReturnValueOnce(workoutInsert).mockReturnValueOnce(seriesInsert);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${SESSION_ID}/watch-workouts`,
      headers: authHeader,
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    expect(seriesInsert.values).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'heart_rate', offsets: [0, 5, 10], values: [120, 134, 141] }),
    ]);
    await app.close();
  });

  it('attaching the same workout twice is a no-op, not a 500', async () => {
    /* The unique index on (user_id, external_id) would otherwise surface as
       a server error, and the client re-reads HealthKit on every foreground
       — it will offer the same workout again until it sees it stored. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionRow]))
      .mockReturnValueOnce(selectChain([attached]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${SESSION_ID}/watch-workouts`,
      headers: authHeader,
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
    await app.close();
  });

  it('refuses to attach to a session that is not yours', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([])); // ownership query scopes by userId
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${SESSION_ID}/watch-workouts`,
      headers: authHeader,
      payload: body,
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('rejects a series whose offsets and values disagree', async () => {
    /* Parallel arrays are the storage contract; a mismatched pair is a
       corrupt series, not a partial one, and would misalign every reading
       after the gap. */
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${SESSION_ID}/watch-workouts`,
      headers: authHeader,
      payload: { ...body, series: [{ kind: 'heart_rate', offsets: [0, 5, 10], values: [120, 134] }] },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('DELETE watch-workouts', () => {
  it('detaching deletes the samples too', async () => {
    /* Our snapshot outlives HealthKit by design, so detach is the only way
       back out — leaving the series behind would orphan per-five-second
       heart-rate data under a user who asked for it gone. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([attached]));
    const seriesDelete = { where: vi.fn().mockResolvedValue([]) };
    const workoutDelete = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValueOnce(seriesDelete).mockReturnValueOnce(workoutDelete);

    const app = buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/workout-sessions/${SESSION_ID}/watch-workouts/${attached.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(204);
    expect(seriesDelete.where).toHaveBeenCalled();
    expect(workoutDelete.where).toHaveBeenCalled();
    await app.close();
  });
});

describe('user scoping (ADR 0002)', () => {
  /**
   * A source-level guard, because mocked drizzle answers every query the
   * same way regardless of its WHERE clause — removing `eq(userId, ...)`
   * from the detach lookup broke nothing, and this table holds
   * per-five-second heart-rate data.
   */
  it('every query against the watch tables scopes by request.userId', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, 'session-watch-workouts.ts'), 'utf8');

    // Each db.select()/insert()/delete() chain, up to its terminator.
    const chains = source
      .split(/await db\s*\n?\s*\./)
      .slice(1)
      .map((chunk) => chunk.split(';')[0] ?? '');

    const offenders: string[] = [];
    for (const chain of chains) {
      const touchesWatchTable = /sessionWatchWorkout|sessionWatchSeries/.test(chain);
      if (!touchesWatchTable) continue;
      // An insert carries userId in its values rather than a where clause.
      const isInsert = /^\s*insert/.test(chain);
      const scoped = isInsert
        ? /userId:\s*request\.userId!/.test(chain)
        : /request\.userId!/.test(chain);
      if (!scoped) offenders.push(chain.slice(0, 90).replace(/\s+/g, ' '));
    }
    expect(offenders).toEqual([]);
  });
});
