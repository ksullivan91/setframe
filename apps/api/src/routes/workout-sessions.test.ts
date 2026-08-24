import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockUpdate, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const db = { select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete };
  return { mockSelect, mockInsert, mockUpdate, mockDelete, db };
});

vi.mock('../lib/clerk', () => ({
  verifyBearerToken: vi.fn(async () => ({ sub: 'clerk-user-1' })),
}));

vi.mock('../lib/db', () => ({
  getDb: () => db,
}));

function queryChain(rows: unknown[]) {
  const resolved = Promise.resolve(rows);
  return {
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows), then: resolved.then.bind(resolved) }),
    returning: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
  };
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
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function insertChain(rows: unknown[]) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) };
}

function updateChain(rows: unknown[]) {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) }) };
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
const sessionRow = {
  id: '22222222-2222-4222-8222-222222222222',
  userId: userRow.id,
  templateId: null,
  programId: null,
  localDate: '2026-08-21',
  timezone: 'America/Chicago',
  startedAt: new Date('2026-08-21T10:00:00Z'),
  completedAt: null,
  status: 'in_progress',
  sessionNameSnapshot: 'Upper A',
  notes: null,
  createdAt: new Date('2026-08-21T10:00:00Z'),
  updatedAt: new Date('2026-08-21T10:00:00Z'),
};
const logRow = {
  id: '33333333-3333-4333-8333-333333333333',
  sessionId: sessionRow.id,
  exerciseId: '44444444-4444-4444-8444-444444444444',
  exerciseNameSnapshot: 'Bench Press',
  sortOrder: 0,
  prescriptionSnapshot: { kind: 'sets_reps', sets: 3, repsMin: 8 },
  notes: null,
  skipped: false,
  createdAt: new Date('2026-08-21T10:00:00Z'),
  updatedAt: new Date('2026-08-21T10:00:00Z'),
};
const setRow = {
  id: '55555555-5555-4555-8555-555555555555',
  exerciseLogId: logRow.id,
  clientId: '66666666-6666-4666-8666-666666666666',
  sortOrder: 0,
  setType: 'top',
  loadValue: '225',
  loadUnit: 'lb',
  reps: 5,
  durationSeconds: null,
  distanceValue: null,
  distanceUnit: null,
  rir: null,
  rpe: '9',
  side: null,
  completed: true,
  isPrWeight: true,
  isPrReps: false,
  notes: null,
  createdAt: new Date('2026-08-21T10:05:00Z'),
  updatedAt: new Date('2026-08-21T10:05:00Z'),
};

describe('workout session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * PR flags are derived, not incremental: every mutation re-resolves the
   * whole exercise log against all-time history. These mocks therefore feed
   * the recompute two selects — the history baseline, then the log's sets.
   */
  it('creates a set and resolves it as a weight PR against all-time history', async () => {
    const insertedRow = { ...setRow, isPrWeight: false, isPrReps: false };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      // Recompute: history, then every persisted set for this exercise.
      .mockReturnValueOnce(selectChain([{ loadValue: '205', reps: 5, setType: 'working' }, { loadValue: '215', reps: 3, setType: 'top' }]))
      .mockReturnValueOnce(selectChain([{ set: insertedRow, logSortOrder: 0 }]));
    mockInsert.mockReturnValueOnce(insertChain([insertedRow]));
    mockUpdate.mockReturnValue(updateChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: setRow.clientId, setType: 'top', weightValue: 225, weightUnit: 'lb', reps: 5, rpe: 9 },
    });

    expect(response.statusCode).toBe(201);
    // 225 beats the 215 all-time best. It is not a rep PR: 225 has never been
    // lifted before, so there is no rep count at that load to beat.
    expect(response.json()).toMatchObject({ setType: 'top', isPrWeight: true, isPrReps: false, weightValue: 225, reps: 5 });
    await app.close();
  });

  it('does not flag weight or reps PR for warmup sets', async () => {
    const warmupRow = { ...setRow, setType: 'warmup', isPrWeight: false, isPrReps: false, notes: null, loadValue: '225' };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ loadValue: '205', reps: 5, setType: 'working' }]))
      .mockReturnValueOnce(selectChain([{ set: warmupRow, logSortOrder: 0 }]));
    mockInsert.mockReturnValueOnce(insertChain([warmupRow]));
    mockUpdate.mockReturnValue(updateChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: setRow.clientId, setType: 'warmup', weightValue: 225, weightUnit: 'lb', reps: 12 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ setType: 'warmup', isPrWeight: false, isPrReps: false });
    await app.close();
  });

  it('awards no PR at all when the exercise has no prior history', async () => {
    // The bug this guards: an empty baseline used to compare against zero, so
    // the very first set of a brand new exercise always looked like a record.
    const insertedRow = { ...setRow, loadValue: '1', reps: 1, isPrWeight: false, isPrReps: false };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ set: insertedRow, logSortOrder: 0 }]));
    mockInsert.mockReturnValueOnce(insertChain([insertedRow]));
    mockUpdate.mockReturnValue(updateChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: setRow.clientId, setType: 'top', weightValue: 1, weightUnit: 'lb', reps: 1 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ isPrWeight: false, isPrReps: false });
    await app.close();
  });

  it('recomputes rep PR on set update', async () => {
    const updatedRow = { ...setRow, reps: 5, isPrWeight: false, isPrReps: false };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, session: sessionRow, log: logRow }]))
      .mockReturnValueOnce(selectChain([{ loadValue: '225', reps: 4, setType: 'top' }, { loadValue: '235', reps: 3, setType: 'top' }]))
      .mockReturnValueOnce(selectChain([{ set: updatedRow, logSortOrder: 0 }]));
    mockUpdate.mockReturnValue(updateChain([updatedRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { reps: 5, setType: 'top' },
    });

    expect(response.statusCode).toBe(200);
    // 5 reps at 225 beats the 4 previously done at that exact load; 235 is
    // heavier but only ever went for 3.
    expect(response.json()).toMatchObject({ isPrWeight: false, isPrReps: true, reps: 5, setType: 'top' });
    await app.close();
  });

  it('does not flag rep PR when history already matches or beats it', async () => {
    const updatedRow = { ...setRow, setType: 'backoff', reps: 5, isPrWeight: false, isPrReps: false, notes: null };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, session: sessionRow, log: logRow }]))
      .mockReturnValueOnce(selectChain([{ loadValue: '225', reps: 5, setType: 'top' }, { loadValue: '235', reps: 6, setType: 'top' }]))
      .mockReturnValueOnce(selectChain([{ set: updatedRow, logSortOrder: 0 }]));
    mockUpdate.mockReturnValue(updateChain([updatedRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { reps: 5, setType: 'backoff' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ isPrWeight: false, isPrReps: false, setType: 'backoff' });
    await app.close();
  });

  /**
   * Story 23 — closes a server/client validation-parity gap: the client's
   * own `validateSessionSet` already rejected a negative value, but the API
   * had no floor of its own, so a negative could still reach the DB via a
   * direct request. Relevant now that a completed set's values are
   * editable, not just a new one's.
   */
  it('rejects a negative weight correction with a validation error', async () => {
    // Zod body validation runs before the auth preHandler, so no `userId`
    // lookup ever happens for a request this malformed — no select mock
    // needed (and queuing an unconsumed one would leak into the next test).
    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { weightValue: -10 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('includes previous completed session sets on session detail', async () => {
    const completedSessionRow = {
      ...sessionRow,
      id: '77777777-7777-4777-8777-777777777777',
      status: 'completed',
      completedAt: new Date('2026-08-19T10:30:00Z'),
      updatedAt: new Date('2026-08-19T10:30:00Z'),
      localDate: '2026-08-19',
    };
    const previousLogRow = {
      ...logRow,
      id: '88888888-8888-4888-8888-888888888888',
      sessionId: completedSessionRow.id,
    };
    const previousSetRow = {
      ...setRow,
      id: '99999999-9999-4999-8999-999999999999',
      exerciseLogId: previousLogRow.id,
      setType: 'working',
      loadValue: '215',
      reps: 8,
      isPrWeight: false,
      isPrReps: false,
      updatedAt: new Date('2026-08-19T10:10:00Z'),
      createdAt: new Date('2026-08-19T10:10:00Z'),
    };

    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, exercise: { id: logRow.exerciseId, name: 'Bench Press', isSystem: true, createdByUserId: null, archivedAt: null, createdAt: new Date('2026-08-20T10:00:00Z'), updatedAt: new Date('2026-08-20T10:00:00Z') } }]))
      .mockReturnValueOnce(selectChain([{ workout_set: setRow }]))
      .mockReturnValueOnce(selectChain([{ log: previousLogRow, session: completedSessionRow }]))
      .mockReturnValueOnce(selectChain([previousSetRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/workout-sessions/${sessionRow.id}`,
      headers: authHeader,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().exercises[0].previousSession).toMatchObject({
      sessionId: completedSessionRow.id,
      localDate: '2026-08-19',
      sets: [{ weightValue: 215, reps: 8, setType: 'working' }],
    });
    await app.close();
  });
});
