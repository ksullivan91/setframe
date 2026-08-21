import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';

const { mockSelect, mockInsert, mockUpdate, mockDelete, db } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const db = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
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
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(queryChain(rows)) }),
      where: vi.fn().mockReturnValue(queryChain(rows)),
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function updateChain(rows: unknown[]) {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(rows) }) }) };
}

const ownerUser = {
  id: 'user-1',
  clerkUserId: 'clerk-user-1',
  displayName: null,
  preferredUnits: 'imperial',
  timezone: 'UTC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const dayTypeRow = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: ownerUser.id,
  name: 'Upper A',
  description: null,
  estimatedDurationMinutes: 60,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const exerciseRow = {
  id: '22222222-2222-4222-8222-222222222222',
  dayTypeId: dayTypeRow.id,
  exerciseId: '33333333-3333-4333-8333-333333333333',
  sortOrder: 0,
  prescription: { kind: 'duration', durationMinutes: 30 },
  progressionRuleId: null,
  notes: null,
  createdAt: new Date('2026-08-20T12:00:00Z'),
  updatedAt: new Date('2026-08-20T12:00:00Z'),
};

const authHeader = { authorization: 'Bearer test-token' };

describe('day type routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a day type exercise prescription via nested route', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([{ exercise: exerciseRow, owner: dayTypeRow }]));
    mockUpdate.mockReturnValueOnce(
      updateChain([{ ...exerciseRow, prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 } }]),
    );

    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/day-types/${dayTypeRow.id}/exercises/${exerciseRow.id}`,
      headers: authHeader,
      payload: {
        prescription: { kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().prescription).toEqual({ kind: 'distanceDuration', distanceMiles: 5, durationMinutes: 30 });
    await app.close();
  });

  it('reorders exercises only when payload matches owned day type exercises', async () => {
    mockSelect
      .mockReturnValueOnce(selectChain([ownerUser]))
      .mockReturnValueOnce(selectChain([dayTypeRow]))
      .mockReturnValueOnce(selectChain([{ id: exerciseRow.id }, { id: '44444444-4444-4444-8444-444444444444' }]));
    mockUpdate.mockReturnValue(updateChain([]));

    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/day-types/${dayTypeRow.id}/exercises/reorder`,
      headers: authHeader,
      payload: {
        exerciseIdsInOrder: ['44444444-4444-4444-8444-444444444444', exerciseRow.id],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
