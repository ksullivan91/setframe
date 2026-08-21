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
  notes: '[pr_weight]',
  createdAt: new Date('2026-08-21T10:05:00Z'),
  updatedAt: new Date('2026-08-21T10:05:00Z'),
};

describe('workout session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a set with provided setType and weight PR flag', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ loadValue: '205', reps: 5 }, { loadValue: '215', reps: 3 }]));
    mockInsert.mockReturnValueOnce(insertChain([{ ...setRow, notes: '[pr_weight]' }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workout-exercise-logs/${logRow.id}/sets`,
      headers: authHeader,
      payload: { clientId: setRow.clientId, setType: 'top', weightValue: 225, weightUnit: 'lb', reps: 5, rpe: 9 },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ setType: 'top', isPrWeight: true, isPrReps: false, weightValue: 225, reps: 5 });
    await app.close();
  });

  it('does not flag weight or reps PR for warmup sets', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ log: logRow, session: sessionRow }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]));
    mockInsert.mockReturnValueOnce(insertChain([{ ...setRow, setType: 'warmup', notes: null, loadValue: '225' }]));

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

  it('recomputes rep PR on set update', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, session: sessionRow, log: logRow }]))
      .mockReturnValueOnce(selectChain([{ loadValue: '225', reps: 4 }, { loadValue: '235', reps: 3 }]))
    mockUpdate.mockReturnValueOnce(updateChain([{ ...setRow, reps: 5, notes: '[pr_reps]' }]));

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/workout-sets/${setRow.id}`,
      headers: authHeader,
      payload: { reps: 5, setType: 'top' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ isPrWeight: false, isPrReps: true, reps: 5, setType: 'top' });
    await app.close();
  });

  it('does not flag rep PR when history already matches or beats it', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([userRow]))
      .mockReturnValueOnce(selectChain([{ set: setRow, session: sessionRow, log: logRow }]))
      .mockReturnValueOnce(selectChain([{ loadValue: '225', reps: 5 }, { loadValue: '235', reps: 6 }]))
    mockUpdate.mockReturnValueOnce(updateChain([{ ...setRow, setType: 'backoff', reps: 5, notes: null }]));

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
});
