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
      /* save-as-workout joins sets onto logs with a LEFT join, so an
         exercise with no sets still appears (and is then dropped). */
      leftJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(chain) }),
      where: vi.fn().mockReturnValue(chain),
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function insertChain(rows: unknown[]) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) };
}

/** `insert().values()` with no `.returning()` — the day-type exercise batch. */
function insertNoReturningChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
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

  /**
   * Story 34 — "remove from today's workout" is implemented as the
   * pre-existing `skipped` flag, not a delete: it's a single update on
   * `workout_exercise_log` and nothing else, so the session's sets, the
   * day type it came from, and the parent program are all untouched by
   * construction (this route never references any of those tables).
   */
  it('marks an exercise log skipped with a single scoped update, leaving everything else untouched', async () => {
    const skippedRow = { ...logRow, skipped: true, updatedAt: new Date('2026-08-21T11:00:00Z') };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }])) // getOwnedExerciseLog
      .mockReturnValueOnce(selectChain([sessionRow])) // getOwnedSession (completed-session guard)
      .mockReturnValueOnce(selectChain([])) // recalculateLogPrFlags: history baseline
      .mockReturnValueOnce(selectChain([])); // recalculateLogPrFlags: this log's own sets
    mockUpdate.mockReturnValueOnce(updateChain([skippedRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-exercise-logs/${logRow.id}`,
      headers: authHeader,
      payload: { skipped: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: logRow.id, skipped: true });
    // No sets came back from the recalculate pass, so nothing needed a
    // flag update — the only write is the log's own `skipped` column.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    await app.close();
  });

  it('undoes a removal by flipping skipped back off', async () => {
    const restoredRow = { ...logRow, skipped: false };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: { ...logRow, skipped: true }, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([sessionRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]));
    mockUpdate.mockReturnValueOnce(updateChain([restoredRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-exercise-logs/${logRow.id}`,
      headers: authHeader,
      payload: { skipped: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: logRow.id, skipped: false });
    await app.close();
  });

  /**
   * Story 34 — the UI only offers removal/undo while a session is in
   * progress; without a server-side check, a direct request could still
   * change a finished session's exercise/set counts, volume and PR
   * history after the fact.
   */
  it('rejects toggling skipped once the session is completed', async () => {
    const completedSessionRow = { ...sessionRow, status: 'completed', completedAt: new Date('2026-08-21T11:00:00Z') };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: completedSessionRow }]))
      .mockReturnValueOnce(selectChain([completedSessionRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-exercise-logs/${logRow.id}`,
      headers: authHeader,
      payload: { skipped: true },
    });

    expect(response.statusCode).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it('allows a non-skipped edit (e.g. notes) on a completed session without the removal guard', async () => {
    const completedSessionRow = { ...sessionRow, status: 'completed', completedAt: new Date('2026-08-21T11:00:00Z') };
    const notedRow = { ...logRow, notes: 'Felt heavy today' };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: completedSessionRow }]));
    mockUpdate.mockReturnValueOnce(updateChain([notedRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-exercise-logs/${logRow.id}`,
      headers: authHeader,
      payload: { notes: 'Felt heavy today' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ notes: 'Felt heavy today' });
    await app.close();
  });
});

/**
 * Story 59 — Quick Log writes one set of exercise-level values across several
 * sets in a single request, replacing N sequential client PATCHes.
 */
describe('POST /v1/workout-exercise-logs/:exerciseLogId/quick-log', () => {
  /* Own reset, and a full one. This block is a sibling of the suite above, so
     it inherits no beforeEach — and `clearAllMocks` would not be enough
     anyway: it clears recorded calls but leaves queued `mockReturnValueOnce`
     values in place, so a test whose route makes fewer queries than it queued
     leaks the rest into the next test and shifts every positional mock. */
  beforeEach(() => {
    mockSelect.mockReset();
    mockUpdate.mockReset();
  });

  const setA = { ...setRow, id: '77777777-0001-4000-8000-000000000001', loadValue: null, reps: 8, completed: false, setType: 'working' };
  const setB = { ...setRow, id: '77777777-0002-4000-8000-000000000002', loadValue: null, reps: 8, completed: false, setType: 'working' };

  function mockQuickLog(existingSets: unknown[], updated: unknown[]) {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))                              // auth
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }])) // getOwnedExerciseLog
      .mockReturnValueOnce(selectChain(existingSets))                           // sets on this log
      .mockReturnValue(selectChain([]));                                        // PR baseline
    /* One `db.update` per target set. Returning by call index rather than by
       id because the mock never sees the id — so the queue length must match
       the number of targets the test passes. */
    const queue = [...updated];
    mockUpdate.mockImplementation(() => updateChain([queue.shift() ?? updated.at(-1)]));
  }

  it('applies the values to every named set and marks them performed', async () => {
    mockQuickLog(
      [setA, setB],
      [
        { ...setA, loadValue: '135', reps: 8, completed: true },
        { ...setB, loadValue: '135', reps: 8, completed: true },
      ],
    );

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/quick-log`,
      headers: authHeader,
      payload: { setIds: [setA.id, setB.id], values: { weightValue: 135, weightUnit: 'lb', reps: 8 } },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body.map((set: { weightValue: number }) => set.weightValue)).toEqual([135, 135]);
    /* `completed` is not part of the set response schema, so it is asserted on
       the write rather than the body. Quick Log *is* the act of logging, and
       without this the sets would stay `completed: false` and never become
       PR-eligible — the same rule the single-set PATCH applies. */
    for (const result of mockUpdate.mock.results) {
      expect(result.value.set.mock.calls[0][0]).toMatchObject({ completed: true });
    }
    await app.close();
  });

  it('refuses a set id that does not belong to this exercise log', async () => {
    /* A caller could otherwise pass someone else's set ids alongside their
       own; ownership is checked per set, not just on the log. */
    mockQuickLog([setA], [setA]);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/quick-log`,
      headers: authHeader,
      payload: { setIds: [setA.id, '99999999-9999-4999-8999-999999999999'], values: { reps: 8 } },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('rejects an empty target list rather than silently doing nothing', async () => {
    mockSelect.mockReturnValueOnce(selectChain([userRow]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/quick-log`,
      headers: authHeader,
      payload: { setIds: [], values: { reps: 8 } },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('keeps stored values for fields the representation does not carry', async () => {
    /* A bodyweight quick log sends only reps. Nulling the other columns would
       wipe a weight someone had entered by hand. */
    const withWeight = { ...setA, loadValue: '45', loadUnit: 'lb' };
    mockQuickLog([withWeight], [{ ...withWeight, reps: 12, completed: true }]);

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/quick-log`,
      headers: authHeader,
      payload: { setIds: [withWeight.id], values: { reps: 12 } },
    });

    expect(response.statusCode).toBe(200);
    /* Asserted on the write, not the response: the mock returns a fixed row
       whatever the route does, so checking the body passed even when the
       route nulled the column. Mutation testing caught that. */
    const written = mockUpdate.mock.results[0]!.value.set.mock.calls[0][0];
    expect(written.loadValue).toBe('45');
    expect(written.reps).toBe(12);
    await app.close();
  });

  it('never changes set type, which is per-set', async () => {
    mockQuickLog([setA], [{ ...setA, loadValue: '135', completed: true }]);

    const app = buildApp();
    await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/quick-log`,
      headers: authHeader,
      payload: { setIds: [setA.id], values: { weightValue: 135, reps: 8 } },
    });

    const written = mockUpdate.mock.results[0]!.value.set.mock.calls[0][0];
    expect(written).not.toHaveProperty('setType');
    await app.close();
  });
});

/**
 * Story 82 — saving a performed session as a reusable workout.
 *
 * The only new backend surface in Training v2, and the one place intent is
 * authored FROM fact. ADR 0005 is the constraint: this must create new intent
 * and never write back into the day type a session started from.
 */
describe('POST /v1/workout-sessions/:sessionId/save-as-workout', () => {
  /* This block sits outside the file's other describe, so it needs its own
     reset — without it `mockInsert` carries calls from the previous test and
     a "was never called" assertion reads the wrong count. */
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
  });

  const savedDayType = {
    id: '77777777-7777-4777-8777-777777777777',
    userId: userRow.id,
    name: 'Leg Day',
    description: null,
    estimatedDurationMinutes: null,
    createdAt: new Date('2026-08-30T10:00:00Z'),
    updatedAt: new Date('2026-08-30T10:00:00Z'),
  };

  const performedRow = (over: Record<string, unknown> = {}) => ({
    logId: '33333333-3333-4333-8333-333333333333',
    exerciseId: '44444444-4444-4444-8444-444444444444',
    sortOrder: 0,
    skipped: false,
    setType: 'working',
    reps: 8,
    loadValue: '225',
    completed: true,
    ...over,
  });

  it('saves the session as a new day type', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow])) // auth
      .mockReturnValueOnce(selectChain([sessionRow])) // getOwnedSession
      .mockReturnValueOnce(selectChain([performedRow(), performedRow(), performedRow()]));
    mockInsert
      .mockReturnValueOnce(insertChain([savedDayType])) // day_type
      .mockReturnValueOnce(insertNoReturningChain()); // day_type_exercise batch

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${sessionRow.id}/save-as-workout`,
      headers: authHeader,
      payload: { name: 'Leg Day' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: 'Leg Day', exerciseCount: 1 });

    /* Three working sets of 8 become "3 x 8", and no weight is carried. */
    const values = mockInsert.mock.results[1]!.value.values.mock.calls[0][0];
    expect(values).toEqual([
      {
        dayTypeId: savedDayType.id,
        exerciseId: performedRow().exerciseId,
        sortOrder: 0,
        prescription: { kind: 'sets_reps', sets: 3, repsMin: 8 },
      },
    ]);
    expect(JSON.stringify(values)).not.toContain('225');
    await app.close();
  });

  it('refuses a session with nothing performed rather than creating an empty workout', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionRow]))
      .mockReturnValueOnce(selectChain([performedRow({ reps: null, setType: 'warmup' })]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${sessionRow.id}/save-as-workout`,
      headers: authHeader,
      payload: { name: 'Empty' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
    await app.close();
  });

  it('never writes back into the day type the session started from', async () => {
    /* ADR 0005. A session WITH a templateId still produces a separate
       workout — the original is untouched. */
    const fromTemplate = { ...sessionRow, templateId: '88888888-8888-4888-8888-888888888888' };
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([fromTemplate]))
      .mockReturnValueOnce(selectChain([performedRow()]));
    mockInsert
      .mockReturnValueOnce(insertChain([savedDayType]))
      .mockReturnValueOnce(insertNoReturningChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${fromTemplate.id}/save-as-workout`,
      headers: authHeader,
      payload: { name: 'Copy' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBe(savedDayType.id);
    expect(response.json().id).not.toBe(fromTemplate.templateId);
    /* No UPDATE at all — the original day type is not touched. */
    expect(mockUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it('drops an exercise that was skipped, which never happened', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([sessionRow]))
      .mockReturnValueOnce(
        selectChain([
          performedRow(),
          performedRow({ logId: 'skipped-log', skipped: true, exerciseId: 'gone' }),
        ]),
      );
    mockInsert
      .mockReturnValueOnce(insertChain([savedDayType]))
      .mockReturnValueOnce(insertNoReturningChain());

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-sessions/${sessionRow.id}/save-as-workout`,
      headers: authHeader,
      payload: { name: 'Leg Day' },
    });

    expect(response.statusCode).toBe(201);
    const values = mockInsert.mock.results[1]!.value.values.mock.calls[0][0];
    expect(values).toHaveLength(1);
    await app.close();
  });
});

/**
 * Production bug report, session f74e54e0: a 5 x 8 deadlift arrived at the
 * gym as one set, already marked complete, with no way to add a set or edit
 * an input — and every blur returned
 * `body/rpe Invalid input: expected number, received null`.
 *
 * Four distinct defects, each pinned here.
 */
describe('workout logger regressions (production report)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
  });

  const setRow = {
    id: '44444444-4444-4444-8444-444444444444',
    exerciseLogId: logRow.id,
    clientId: '55555555-5555-4555-8555-555555555555',
    sortOrder: 0,
    setType: 'working',
    reps: 8,
    loadValue: '225',
    loadUnit: 'lb',
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    rpe: '8',
    completed: true,
    isPrWeight: false,
    isPrReps: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a null rpe, because the logger sends one for every empty field', async () => {
    /* The row is sent as a whole unit with nulls for the blanks. `optional()`
       accepted an absent key but rejected null, so leaving RPE blank — what
       almost everyone does — failed every save with a 400. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, log: logRow, session: sessionRow }]))
      .mockReturnValue(selectChain([]));
    mockUpdate.mockReturnValue(updateChain([{ ...setRow, rpe: null }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { weightValue: 225, reps: 8, rpe: null },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('treats an absent field as "leave alone" and an explicit null as "clear"', async () => {
    /* Conflating the two made an optional value impossible to remove once
       set — `?? existing` silently kept the old RPE forever. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, log: logRow, session: sessionRow }]))
      .mockReturnValue(selectChain([]));
    mockUpdate.mockReturnValue(updateChain([setRow]));

    const app = buildApp();
    await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { rpe: null },
    });

    const written = mockUpdate.mock.results[0]!.value.set.mock.calls[0][0];
    expect(written.rpe).toBeNull();
    /* reps was absent from the body, so the stored value survives. */
    expect(written.reps).toBe(setRow.reps);
    await app.close();
  });

  it('rejects a set update that is not a number, so the loosening did not open a hole', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, log: logRow, session: sessionRow }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { reps: -3 },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

/**
 * A set added after a deletion must land at the END of the list.
 *
 * Reported: "a new/added set shouldn't be at the top of the list."
 * `sortOrder: existing.length` collides once anything has been deleted —
 * sets at 0, 1, 2 minus the middle leaves 0 and 2, and the next add also
 * takes 2. The session reads back ordered by sortOrder, so two rows sharing
 * one appear in an arbitrary order.
 */
describe('POST /v1/workout-exercise-logs/:id/sets ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReset();
    mockInsert.mockReset();
  });

  /* Ids and clientIds must be real UUIDs — workoutSetSchema validates both,
     and a fixture that fails validation 500s the route while an assertion on
     the INSERT still passes: a test that cannot fail for the reason it
     exists. */
  const existingSet = (sortOrder: number) => ({
    id: `11111111-1111-4111-8111-1111111111${sortOrder}${sortOrder}`,
    exerciseLogId: logRow.id,
    /* A real UUID: workoutSetSchema validates it, and a fixture that fails
       validation makes the route 500 while an assertion on the INSERT still
       passes — a test that cannot fail for the reason it exists. */
    clientId: `00000000-0000-4000-8000-0000000000${sortOrder}${sortOrder}`,
    sortOrder,
    setType: 'working',
    reps: null,
    loadValue: null,
    loadUnit: null,
    durationSeconds: null,
    distanceValue: null,
    distanceUnit: null,
    rpe: null,
    completed: false,
    isPrWeight: false,
    isPrReps: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('takes one past the highest sortOrder, not the row count', async () => {
    /* A gap left by a deletion: 0 and 2 present, so the next is 3 — never 2,
       which already exists. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      /* The clientId dedupe lookup runs first and finds nothing… */
      .mockReturnValueOnce(selectChain([]))
      /* …then the sets are read to pick the next sortOrder. A gap at 1. */
      .mockReturnValueOnce(selectChain([existingSet(0), existingSet(2)]))
      .mockReturnValue(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([existingSet(3)]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: '99999999-9999-4999-8999-999999999999' },
    });

    expect(response.statusCode).toBe(201);
    const written = mockInsert.mock.results[0]!.value.values.mock.calls[0][0];
    expect(written.sortOrder).toBe(3);
    await app.close();
  });

  it('does not mark an empty new set as completed', async () => {
    /* Same "complete before you lifted anything" defect as the planned-set
       expansion: a row created with no values has not been performed. */
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValue(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([existingSet(0)]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: '99999999-9999-4999-8999-999999999999' },
    });

    expect(response.statusCode).toBe(201);
    const written = mockInsert.mock.results[0]!.value.values.mock.calls[0][0];
    expect(written.completed).toBe(false);
    expect(written.sortOrder).toBe(0);
    await app.close();
  });

  it('marks a set created WITH values as performed', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValue(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([existingSet(0)]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: '99999999-9999-4999-8999-999999999999', weightValue: 225, reps: 8 },
    });

    expect(response.statusCode).toBe(201);
    const written = mockInsert.mock.results[0]!.value.values.mock.calls[0][0];
    expect(written.completed).toBe(true);
    await app.close();
  });
});
